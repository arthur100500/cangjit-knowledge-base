# [ABI INFO] Interoperability and boundaries

Scope: x86-64 Linux, source snapshot inspected 2026-11-23; paths are relative to sibling repository roots `cangjit` and `cangjie_runtime`. C ABI, Cangjie managed ABI, runtime entry stubs and imported Cangjie libraries are different boundaries.

## Native C FFI versus JIT calls

```text
CJNative C function declaration
  -> LinuxAmd64CJNativeCGCFFI: C-compatible LLVM signature/attributes
  -> native C ABI callee

JIT CHIR Apply to imported Cangjie function
  -> EnsurePackage -> Resolve exported identifier -> managed ABI call
  (not an arbitrary C FFI call)
```

`cangjit/src/CodeGen/CJNative/CJNativeCGCFFI.cpp`, `IsMetCType` and `LinuxAmd64CJNativeCGCFFI::GetCFuncType`, handle C-compatible scalar types, C pointers, strings, C functions and C structs, with array handling and per-struct processing. `AddFunctionAttr` adds appropriate sret, byval, and boolean zero-extension attributes. The function type preserves `HasVarArg`; exact allowed source declarations and platform aggregate classification require the semantic checks and full implementation, not a rule that every C struct can be passed unchanged.

By contrast, `cangjit/src/JIT/X86_64/Compilers/Expression/CompileApply.cpp`, `ValidateCall`, explicitly rejects C functions and varargs. `SystemVCallingConvention.cpp` has a C classifier, but that alone does not make C FFI calls supported by `CompileApply`. For example, a native C `double f(double)` can be represented via the CJNative FFI path, while an attempted direct JIT Apply of a C function is rejected by this implementation. Do not extrapolate JIT support from shared scalar registers.

## Runtime transition and library boundaries

`cangjit/src/JIT/X86_64/Compilers/Function/CompileFunctionStub.cpp`, `ResolverStubEmitter::ResolveAndJump`, invokes the native resolver via `CJ_MCC_C2NStub` while preserving managed arguments. `cangjie_runtime/runtime/src/arch/x86_64_linux/C2NStub.S` and `N2CStub.S` implement opposite runtime transition stubs and managed-context/frame handling; register placement alone is not sufficient to cross this boundary safely. This example does not prove every runtime helper uses the same stub.

For a JIT imported Cangjie function, `JitRuntimeBindings::EnsurePackage` maps e.g. `std.foo` to `libcangjie-std-foo.so`, searches configured paths and loads the library through runtime APIs. `Resolve` first consults its symbol cache and loaded libraries, then `dlsym` on the runtime handle. The direct caller uses `GetIdentifierWithoutPrefix` (`CompileApply::ResolveAddress`). Missing package or symbol causes an unresolved-symbol compilation failure, not automatic compilation of the imported function. Sources: `cangjit/src/JIT/X86_64/JitRuntimeBindings.cpp` and `RuntimeFunctions.inc`.

Matching register names do not guarantee compatible managed object layout, hidden generic metadata, GC roots, exception unwinding, ownership, or library version. Consult [calling conventions](abi-calling-conventions.md), [call paths](abi-call-paths.md), and [virtual tables](abi-virtual-tables.md); no general binary stability promise follows from these implementation details.
