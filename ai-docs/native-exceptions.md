# Exception handling in Cangjie native (codegen + runtime)

Question answered: how do exceptions (especially arithmetic-overflow throws)
flow through the cangjit compiler pipeline and the cangjie_runtime library, and
how does unwinding actually happen at machine level?

Sources: `cangjit/` (paths relative to repo root) and `cangjie_runtime/runtime/`
(paths relative to that root). Predecessor research with LLVM-IR excerpts:
`main/exceptions.md` (still accurate; this file adds the runtime side, which
that doc marked `[UNKNOWN]`).

## 1. Pipeline overview

```
AST ── OverflowStrategy stamping (Sema)
  └─ CHIR: plain CFG, Try* terminators (success/error successors)
      └─ LLVM IR: invoke + landingpad (Itanium style), personality stub
          └─ machine code: gc "cangjie" frames + LSDA + stackmaps
              └─ runtime: single-pass unwind via rbp chain + return-address hijack
```

## 2. Compiler side (cangjit)

- Overflow strategy: `THROWING` default, `@Overflow[...]` annotation overridable
  (`include/cangjie/Utils/ConstantsUtils.h:23`, `src/Sema/TypeCheckOverflow.cpp`).
  Plain `Int64` arithmetic may throw by default.
- CHIR has **no EH tables/personality**: a `Try*` terminator has two successors
  — success block and the error block of the innermost enclosing `try`
  (`src/CHIR/AST2CHIR/TranslateASTNode/TranslateTryExpr.cpp`,
  `Terminator.h:216-543`). `throw` = `RaiseException` node, catch selection =
  `GetException` + `InstanceOf` + `Branch`; `finally` bodies are duplicated per
  exit path. Consequence: a JIT could lower EH with plain branches if it had a
  way to receive the in-flight exception.
- CodeGen lowering: while a `CodeGenUnwindBlockScope` is active, every call
  (including the throw intrinsic) becomes `invoke ... unwind %unwindBlock`
  (`src/CodeGen/IRBuilder.cpp:53-87`). Overflow check is pure LLVM
  (`llvm.sadd.with.overflow` etc.), the throwing path calls a std.core factory
  (`rt$CreateOverflowException_msg`) then `llvm.cj.throw_exception`
  (`src/CodeGen/CJNative/CJNativeIntrinsicsCall.cpp:659-687, 791-808`).
- Landing pads are **always catch-all** (`landingpad ... catch i8* null`,
  `src/CodeGen/EmitBasicBlockIR.cpp:117-143`); type dispatch happens in
  Cangjie code: `CJ_MCC_GetExceptionWrapper` → `CJ_MCC_PostThrowException` →
  `llvm.cj.is.instance.of` chain, non-matches re-thrown via
  `CJ_MCC_ThrowException`. Reference IR shape:
  `src/CodeGen/CJNative/EmitPackageIR.cpp:52-202`.
- Personality `__cj_personality_v0$` is a Linux-side `ret i32 0` stub
  (`src/CodeGen/CGModule.cpp:459-481`) — it does not do typeinfo matching.
  The runtime, not the personality, decides where to resume.
- Intrinsic → runtime symbol mapping (`third_party/llvmPatch.diff:86688-86743`):
  `llvm.cj.throw_exception` → `CJ_MCC_ThrowException` (noreturn),
  `llvm.cj.get_exception_wrapper` → `CJ_MCC_GetExceptionWrapper`,
  `llvm.cj.post_throw_exception` → `CJ_MCC_PostThrowException`,
  `llvm.cj.is.subtype` → `CJ_MCC_IsSubType`. All plain C ABI, GC-heap pointers
  (`i8 addrspace(1)*`) are just machine pointers.

## 3. Runtime side (cangjie_runtime/runtime/src)

### 3.1 Throw

- `CJ_MCC_ThrowException(obj)` → `ExceptionManager::ThrowException`
  (`ExceptionManager.cpp:356-384`): stores the object ref in the per-thread
  `ExceptionWrapper` (mutator TLS, `Exception/Exception.h:40-218`); if an
  unwind is already in flight → fatal abort (double throw); then constructs
  `ExceptionHandling` (`Exception.cpp:100`), which performs the whole unwind
  *synchronously inside the throw call*.

### 3.2 Single-pass unwind (no libunwind `_Unwind_RaiseException`)

1. `EHStackInfo::FillInStackTrace` (`UnwindStack/EhStackInfo.cpp:15-44`) walks
   the rbp chain frame by frame, classifying each (`StackInfo.cpp:96-156`);
   stops at the N2C boundary or anchor frame.
2. For each MANAGED frame, `EHFrameInfo` (`Exception/EhFrameInfo.h:43-62`)
   resolves startPC → FuncDesc → LSDA and scans the **Itanium-format** tables
   with `EHTable` (`Exception/EhTable.cpp`):
   - `ScanEHTable` (`:120-162`): call-site table lookup by
     `ip-1 - funcStart`, ordered non-overlapping entries
     `(start, length, landingPad, actionEntry)` ULEB128-encoded.
   - `actionEntry == 0` → cleanup-only frame, `landingPad` recorded, not caught.
   - otherwise `MatchActionTable` (`:165-215`): walks (typeIndex, nextOffset)
     action pairs; ttype encodings ABS_PTR / U_DATA_4 / INDIR_PC_REL_S_DATA_4/8
     supported; `catchType == nullptr` = catch-all; match via
     `TypeInfo::IsSubType`.
   First catching frame wins → `isCaught`, `typeIndex`, `landingPad` stored in
   the wrapper; also accumulates `liteFrameInfos` (PC/startPC pairs) for the
   stack trace.
3. If nothing catches, the landing pad is set to the outermost managed frame's
   return address (`Exception.cpp:189-193`) — the pending-exception protocol
   at the C2N boundary then dumps the trace / terminates
   (`ExceptionManager::DumpException`, `ExceptionManager.cpp:203-316`).

### 3.3 Control transfer: return-address hijack + context restore

Not a two-phase unwinder; instead:

- `ExceptionHandling::ChangeEHStackInfoLR` (`Exception.cpp:179-211`):
  overwrites the return-address slot of the outermost **runtime** frame (the
  frame through which managed code called the runtime) with
  `RestoreContextForEH`. All runtime frames then return normally; the final
  `ret` lands in `RestoreContextForEH`, executing on the *thrower's* stack.
- `RestoreContextForEH` (`src/arch/x86_64_linux/RestoreContextForEH.S`):
  builds a `CalleeSavedRegisterContext` {rbx, r12-r15, rbp, rsp} on the stack,
  calls `MRT_RestoreContext`, reloads those registers, `jmp *landingPad`.
- `MRT_RestoreContext` / `ExceptionWrapper::RestoreContext`
  (`Exception.cpp:25-98`): replays callee-saved state frame-by-frame using
  each frame's stackmap (VarInt callee-save bitmap, `EhFrameInfo.h:110-164`);
  SOF frames restore with an adjusted size; x86-64 re-pins TLS register
  `r15` (`context.r15 = tls`); interpreter catch PC special-cased when
  INTERPRETER_ENABLED. Only *callee-saved* state is rebuilt — argument
  registers are not; landing pads must not depend on them.
- The landing pad then calls `CJ_MCC_PostThrowException` =
  `ExceptionManager::BeginCatch` (`ExceptionManager.cpp:386-401`): returns the
  exception object, clears the wrapper, recovers the stack guard for SOF.
  Catch ends with a no-op `CJ_MCC_EndCatch` (`CompilerCalls.cpp:595-599`).

### 3.4 Implicit exceptions (OOM / SOF / incompatible package)

`ExceptionManager::ThrowImplicitException` (`ExceptionManager.cpp:322-334`)
routes through a registered std.core raiser (`rt$ThrowImplicitException`,
registered via `CJ_MCC_RegisterImplicitExceptionRaisers`) through
`ExecuteCangjieStub` — runtime→managed re-entry is treated like N2C, so the
caller must re-throw the pending exception afterwards
(`MRT_ThrowPendingException`). SOF records the faulting frame PC +
compensation size in the wrapper for the adjusted restore
(`ExceptionManager.cpp:121-144`).

## 4. What a JIT must reproduce (see also `main/exceptions.md` §8)

- Raising is easy: C-ABI call to `CJ_MCC_ThrowException` with the object.
- Catching inside JIT frames is the hard part: the frame must be walkable by
  the rbp chain (mandatory frame pointer), resolvable to a FuncDesc (LSDA +
  stackmap pointers), and keep callee-saves/SP recoverable at every potential
  unwind point. The current `cangjit/src/JIT` frames satisfy none of this;
  they also reject throwing arithmetic outright (`UnsupportedBinaryOverflow`,
  `src/JIT/X86_64/Compilers/Expression/CompileBinaryExpression.h`).
- Alternative shape allowed by the runtime: since landing pads are catch-all
  and dispatch is in-language, a JIT without LSDA could still register a
  FuncDesc whose single call-site covers the whole body with a catch-all
  action, letting the standard unwind machinery resume at its landing pad.
