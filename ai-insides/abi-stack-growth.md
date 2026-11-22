# [ABI INFO] Stack growth and overflow

Scope: x86-64 Linux, inspected 2026-11-23. Managed cjThread stack growth is conditional on runtime configuration and call path; OS thread stacks, interpreter transitions, native-generated functions and the JIT are not interchangeable. In particular, the current JIT ordinary `CompileFunction::MakePrologue` allocates a fixed frame and does **not** itself emit a stack-limit check or a call to the growth stub. Enabling its stack-growth metadata is not proof that JIT recursion is protected by a prologue check.

```text
checked transition/prologue (where implemented)
    | insufficient room; frame remains walkable; required bytes in rax
    v
CJ_MCC_StackGrowStub -> MRT_StackGrow -> Mutator::FixExtendedStack
    | successful move: fix stack pointers using maps, adjust rsp/rbp,
    |                  free old stack, refresh managed thread data (r15)
    v
resume caller; failure follows runtime overflow/exception path
```

The interpreter runtime interface describes the contract: a caller checks the limit first, preserves a regular frame and passes the required size in `rax`. The x86-64 stub saves general-purpose registers and xmm0–xmm15, establishes unwind context, passes its frame base, saved input `rax` and return PC to `MRT_StackGrow`, then adds the returned byte displacement to `rsp` and `rbp`. It frees the old stack and reloads `r15` from runtime thread-local data. Transition code must initialize callee-saved slots that the stack-map visitor may examine and check pending exception state afterward. The interface describes a pending `StackOverflowError` if growth fails; the actual native overflow path calls `ExceptionManager::StackOverflow`, which constructs and throws the implicit exception. Exact routing therefore depends on the caller/path.

In `Mutator::FixExtendedStack`, ordinary checked managed growth starts at twice the current stack size and doubles until the required frame fits, then asks `CJThreadStackGrow`; an FFI request with `frameBase == 0` requests the configured maximum instead. The interpreter has a separate sizing branch when enabled. Failure (`0` or `-1` in the checked branches) invokes overflow handling. On success the runtime visits stack maps to find stack-resident pointers and applies the displacement, also updating the unwind anchor. This relocation explains why metadata for stack pointers and derived pointers matters: blindly copying bytes would leave pointers into the old stack.

Example: a checked frame on a 1 MiB stack that fits within the next size can request 2 MiB, subject to the reserved area and runtime limits; this illustrates the doubling algorithm, not a guaranteed allocation. If growth is disabled or unavailable, do not assume the stack can move. `X86_64Compiler::ConfigureStackGrowth` accepts `cjStackGrow=0` or `1` and chooses a platform-dependent default; JIT safepoint recording omits stack-root sets when disabled. The setting alone does not add a missing check to the JIT prologue.

Sources: `cangjie_runtime/runtime/include/Interpreter/RTInterface.h` (`DYN_StackGrowStubFn`); `cangjie_runtime/runtime/src/arch/x86_64_linux/StackGrowStub.S` (`CJ_MCC_StackGrowStub`); `cangjie_runtime/runtime/src/Mutator/Mutator.cpp` (`MRT_StackGrow`, `Mutator::FixExtendedStack`); `cangjie_runtime/runtime/src/ExceptionManager.cpp` (`StackOverflow`); `cangjit/src/JIT/X86_64/Compilers/Function/CompileFunction.cpp` (`MakePrologue`); `cangjit/src/JIT/X86_64/X86_64Compiler.cpp` (`ConfigureStackGrowth`); `cangjit/src/JIT/X86_64/Compilers/Context/SafepointRecorder.cpp` (`Record`). See [stack frames](abi-stack-frames.md) and [metadata](abi-code-metadata.md).
