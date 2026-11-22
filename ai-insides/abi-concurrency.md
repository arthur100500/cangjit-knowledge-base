# [ABI INFO] Concurrency and synchronization

Scope: current checked-out `cangjie_runtime` and `cangjit`, 2026-11-23, Linux x86-64. Runtime implementation entry points below are not a guarantee that arbitrary callers may construct internal synchronization objects or call managed functions directly.

## CJThreads and host tasks

```text
host thread                  scheduler / CJThread
-----------                  --------------------
RunCJTask(fn, arg) ------->  UserFuncExecutor
  returns opaque handle        -> establish managed context
                               -> ExecuteCangjieStub(fn, arg, thread data)
GetTaskRet(handle, &ret) <--  -> store result, signal condition variable
ReleaseHandle(handle)        -> transition mutator to exit
```

`cangjie_runtime:runtime/src/CangjieRuntimeApi.cpp` (`RunCJTaskImpl`, `UserFuncExecutor`, `GetTaskRetWithTimeout`, `ReleaseHandle`) allocates a `FutureImpl` and returns it as a `CJThreadHandle`; internally it creates a scheduled CJThread. A `CJThreadHandle` is an opaque API handle, not a pthread ID or a pointer the host should dereference. The executor enters the managed function through `ExecuteCangjieStub`, checks for pending exceptions and transitions its mutator before publishing the result. See the declarations and caller requirements in `cangjie_runtime:runtime/src/Cangjie.h`.

Concrete host sequence: call `RunCJTask(fn, arg)`, check for null, call `GetTaskRet(handle, &result)`, check its status, then `ReleaseHandle(handle)`. `GetTaskRet` calls the timeout form with zero, which waits indefinitely; a positive timeout is in nanoseconds and returns `E_TIMEOUT` on expiry. Releasing an unfinished handle marks its future released for deletion after completion; do not subsequently wait on or reuse it. `cangjit:src/JIT/X86_64/X86_64Compiler.cpp` (`RunUserMain`) uses this sequence with the compiled entry and a null argument. The JIT's use is not evidence that every managed function is callable with this task signature.

`cangjie_runtime:runtime/src/CjScheduler.cpp` (`MCC_NewCJThread`, `MCC_NewCJThreadNoReturn`) creates language-level CJThreads on the runtime scheduler; `MRT_NewForeignCJThread` and `MRT_EndForeignCJThread` handle a distinct foreign-thread attachment path with thread-local and mutator state. An OS thread is therefore not automatically a valid managed execution context. Semi-CJThread handles are a separate API and must not be mixed with normal task handles (`Cangjie.h`, `CreateCJThread` and its comments).

## Mutexes, monitors and futures

```text
mutex:  unlocked --CAS--> owned --contended--> wait on semaphore
                           |                        |
                           +-- final unlock ------> wake/handoff
monitor: hold mutex -> fully unlock + suspend -> notified/timeout
         -> reacquire previous recursive hold count -> return
future:  incomplete -> suspend on wait queue -> completion -> notify all
```

* `cangjie_runtime:runtime/src/Sync/Sync.cpp` (`MCC_MutexInit`, `MCC_MutexLockImpl`, `MCC_MutexTryLock`, `MRT_MutexUnlockImpl`) uses atomic state and an owner CJThread ID. The uncontended lock uses compare-exchange; same-owner try-lock increments the hold count. The contended path uses a semaphore, and starvation mode hands off to a waiter. The last unlock clears ownership and may wake a waiter. The comment on `LOCKED` says LLVM mutex optimization depends on that value: it is a compiler/runtime coupling, not an invitation for user code to depend on the bit layout.
* `MonitorWait` saves the recursive hold count, releases the mutex as part of suspension, and reacquires the saved count before returning. `MCC_MonitorWait` returns true for notification and false for timeout; the timeout argument is nanoseconds. `MCC_MonitorNotify` wakes one and `MCC_MonitorNotifyAll` wakes all. The comments require the Cangjie caller to check lock ownership first. Correct condition-variable usage still rechecks the application predicate after wakeup.
* `MCC_FutureInit`, `MRT_FutureWait` and `MCC_FutureNotifyAll` implement a separate language future: its wait queue is lazily initialized, completion is atomic, and completion notifies all waiters if a queue exists. This is distinct from the embedding API's C++ `FutureImpl` handle. During future and monitor waits, the runtime registers raw-pointer objects with the collector and removes them afterwards. This protects runtime-held objects while suspended; it does not make arbitrary native pointers GC roots.

Example interleaving: CJThread A holds a monitor while `ready` is false, waits (releasing its mutex), CJThread B acquires it, sets `ready`, notifies and unlocks. A reacquires its mutex before `MCC_MonitorWait` returns and checks `ready` again. Timeouts and competing waiters mean notification alone is not the application predicate.

## Limits and sources

Do not assume a one-to-one CJThread/pthread mapping, stable internal structure offsets, fairness beyond the described implementation, or that internal `MCC_` calls form a public C synchronization API. TSAN acquire/release annotations in `Sync.cpp` are conditional on `CANGJIE_TSAN_SUPPORT`. The API lifecycle and shutdown ownership are described in `abi-runtime-lifecycle.md`.
