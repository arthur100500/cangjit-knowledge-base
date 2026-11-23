# [ABI INFO] Lazy compilation and resolution

Scope: x86-64 Linux JIT as inspected 2026-11-23; repository paths are relative to sibling `cangjit` and `cangjie_runtime` roots. This mechanism is distinct from CJNative AOT symbol relocation and from runtime method-table refresh.

## State and first call

```text
UNINITIALIZED --initialize stub--> UNCOMPILED --resolve--> COMPILING
                                                       |--> READY(target)
                                                       +--> FAILED(error)
caller: mov stub, r11; call r11 -> save args -> resolve/compile
        -> optionally patch this caller's immediate -> restore -> jmp target
```

`cangjit/src/JIT/X86_64/LazyCalls/FunctionRecord.cpp` owns these transitions. `FunctionResolver::Resolve` in `FunctionResolver.cpp` returns the cached target for READY, returns the cached error for FAILED, rejects uninitialized and recursive COMPILING resolution, and invokes the materializer for an UNCOMPILED record. Invalid zero or self-stub targets fail. These observations alone do not establish a general multi-thread synchronization guarantee.

`cangjit/src/JIT/X86_64/Compilers/Function/CompileFunctionStub.cpp`, `CompileFunctionStub::Compile`, reuses an existing entry or allocates one with a metadata prefix; executable entry is allocation + 4. `ResolverStubEmitter::SaveArguments` saves RDI, RSI, RDX, RCX, R8, R9 and XMM0–XMM7 in a runtime frame. `ResolveAndJump` calls the resolver via `CJ_MCC_C2NStub`, restores the incoming registers and tail-jumps to the compiled target. The original caller's stack arguments remain in place. Object-reference argument slots are described for GC by `SupportedSignature`; only its accepted signatures can use this stub.

## Patching is per call site

`CompileApply::EmitCall` in `cangjit/src/JIT/X86_64/Compilers/Expression/CompileApply.cpp` records the immediate offset and return offset for a local call targeting an entry stub, checking the expected 13-byte instruction sequence. `LazyCallSiteRegistry::Register` indexes by return address. `ResolveAndPatch` checks that the matching site refers to the same record, then writes the resolved 64-bit target into that site's immediate through the JIT allocator. No matching registered site means resolution still succeeds but that site is not patched. A READY record allows later-generated direct calls to target compiled code immediately; do not assume every previous call site is patched in one operation.

On lazy resolution or patch failure `ResolveAndPatch` prints an error and aborts; it is not a recoverable language exception in this path. Imported calls instead use `JitRuntimeBindings::EnsurePackage`/`Resolve` during call compilation (`CompileApply::ResolveAddress`); dynamic method dispatch is separately described in [call paths](abi-call-paths.md).
