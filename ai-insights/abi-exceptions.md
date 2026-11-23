# [ABI INFO] Exceptions and unwinding

Scope: x86-64 Linux managed runtime and current JIT, inspected 2026-11-23. The JIT exception table is runtime-consumed metadata, not a claim that the JIT emits conventional system DWARF `.eh_frame` or that arbitrary native C++ frames can be unwound through it. Interpreter and transition frames have distinct handling.

```text
throw / pending exception
  -> runtime walks machine and managed frames
  -> frame's call-site PC selects exception table entry
  -> catch type/action matching selects landing pad, if any
  -> restore caller contexts through intervening frames
  -> resume at landing pad (or continue toward runtime boundary)
```

`ExceptionHandling::BuildEHFrameInfo` obtains an exception stack trace and processes frames in order. For a managed frame `ProcessEHFrame` constructs `EHFrameInfo`, records a matching type index and landing pad when caught, and stops the search. With interpreter support, an interpreter frame routes to its common interpreter landing pad. `ExceptionWrapper::RestoreContext` restores intervening contexts using frame information until a catching frame; `MRT_RestoreContext` also refreshes x86-64 `r15` with current runtime thread-local data. `ChangeEHStackInfoLR` redirects the last runtime frame's return address to the restore stub. An uncaught exception has a different boundary path; a diagram of the happy catch case is not a complete exception semantics specification.

For a JIT call with a landing-pad block, `ExceptionLandingEmitter::Emit` records a call-site start, length, landing offset, and catch types, all code-entry-relative (`assembler` offsets subtract the 4-byte prefix). An empty exception list produces a catch type value of zero; explicit classes resolve to runtime type-info addresses and unresolved types fail compilation. The emitted landing code reestablishes `rsp = rbp - frameSize` and jumps to the local finalizer edge. Thus a handler has a deliberate stack restoration point, not a metadata object placed on the stack.

Example: if a call spans entry-relative `[40,45)` and its generated landing pad is at 96, the table records start 40, length 5, landing 96 and its action index. These numbers are illustrative, not a fixed instruction layout. `JitMetadataBuilder::BuildExceptionTable` writes call-site fields as ULEB128, action records and a reversed table of 8-byte absolute type pointers; it rejects more than 255 type entries. It validates nonempty, nonoverlapping, in-range call sites and landing offsets. The exact PC lookup and catch matching rules are runtime-defined; do not treat the illustration as specifying them.

The LLVM native path uses `invoke` when an unwind destination is active (`cangjit/src/CodeGen/IRBuilder.cpp`); its platform-generated exception machinery is distinct from the JIT builder's encoding. Stack overflow is also routed through runtime exception state, with special adjusted-stack handling; see [stack growth](abi-stack-growth.md).

Sources: `cangjit/src/JIT/X86_64/Compilers/Context/ExceptionLandingEmitter.cpp` (`GetExceptionTypes`, `Emit`); `cangjit/src/JIT/Runtime/JitMetadataBuilder.cpp` (`ValidateMetadataInputs`, `BuildExceptionTable`); `cangjie_runtime/runtime/src/Exception/Exception.cpp` (`BuildEHFrameInfo`, `ProcessEHFrame`, `RestoreContext`, `MRT_RestoreContext`, `ChangeEHStackInfoLR`); `cangjit/src/CodeGen/IRBuilder.cpp`. See [generated-code metadata](abi-code-metadata.md).
