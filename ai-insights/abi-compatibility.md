# [ABI INFO] Compatibility and verification

Scope: x86-64 Linux native runtime and x86-64 JIT source inspected 2026-11-23. Source agreement is not an unconditional stable ABI, nor proof that independently built binaries match. No runtime ABI-version negotiation is established by the cited binding code; do not assume that matching names alone verifies layouts or calling conventions.

```text
compiler / JIT  ----generated code---->  runtime + native libraries
     |       register and stack contract       |
     |       symbols and signatures           |
     +-------metadata and object layout--------+
             GC, unwinding, transitions
```

All edges must agree for a particular configuration. An exported symbol with a matching spelling may still have a different signature or semantics; a successful `dlsym` cannot check them. In `cangjit/src/JIT/Runtime/JitRuntimeBindings.cpp`, `LoadRequiredSymbols` eagerly checks only catalogue entries marked required, while generated getters resolve others on demand. Initialization success therefore does not establish that all features will work. `RuntimeFunctions.inc` even stores many function addresses as `void*`: inspect both caller and runtime definition. The complete inventory is in `abi-runtime-functions.md`.

## Concrete compatibility hazards

* `TypeInfoEmitter::LoadTypeInfo` in `cangjit/src/JIT/X86_64/Compilers/Context/TypeInfoEmitter.cpp` hardcodes native `TypeInfo.typeArgs` at offset 48 and eight-byte indexing, and decodes an instance receiver's first word by clearing its top 16 bits. A changed runtime layout or object header encoding can break JIT code despite successful symbol resolution. See `abi-runtime-types.md`.
* The same emitter calls the type-instantiation helper with a template, 32-bit argument count and argument array. Compare it with `CJ_MCC_GetOrCreateTypeInfo` in `cangjie_runtime/runtime/src/CompilerCalls.h`, including the target's calling convention. Native code generation has its own producer path; do not assume identical lowering merely because both use the same runtime.
* Optional bindings can be missing until a particular type, allocator, exception or dispatch operation is compiled. A library search may also find a symbol in a loaded CJ library before falling back to the runtime (`JitRuntimeBindings::Resolve`). Check provenance, not just presence.
* Runtime object metadata is not the same as the interpreter mirror. In `cangjie_runtime/runtime/src/ObjectModel/MClass.cpp`, `TypeInfoLayoutCheck::CheckInterpreterMirror` has static assertions for size and selected field offsets, including `typeArgs`, but only under `INTERPRETER_ENABLED`. This is a useful build-time check of those two runtime structures, not a check of JIT hardcoded offsets or a general compatibility proof.

## Verification workflow

1. Record compiler/JIT and runtime revisions, build options, architecture, operating system, and actual loaded shared libraries. Compare declarations, implementation, and generated caller for each cross-boundary operation in the matching sources. Do not apply x86-64 offsets to another target.
2. Inspect dynamic exports, for example `readelf -Ws /path/to/runtime.so` or `nm -D /path/to/runtime.so`, and compare exact spellings with `cangjit/src/JIT/Runtime/RuntimeFunctions.inc`. Quote symbols containing `$` when using a shell. Distinguish required startup entries from optional feature-specific ones. Presence does not establish callable compatibility.
3. Compare field offsets, header masks, calling convention, argument and return representation, lifetime, exception/unwind and GC/safepoint expectations in actual producer and consumer code. Check conditional compilation. A useful minimal example is the JIT's `typeArgs` offset versus the matching runtime `TypeInfo` definition, not an offset copied from an older release.
4. Exercise the specific intended cross-boundary paths with the matching build: initialization and shutdown, native-to-JIT and JIT-to-native calls, generic metadata and dispatch, allocation/GC, exceptions and unwinding. Check failure behavior for a missing optional symbol. Relevant source examples include `cangjit-tests/tests/exception.cj` and `cangjit-tests/tests/float_calls.cj`; their existence alone does not prove coverage or a passing result. Use the project's actual test harness and configuration.
5. Keep artifacts and results with the exact pair of builds. Retest after changes to the compiler, runtime, architecture, toolchain or build flags. A source-level assertion, export listing or a single passing example is evidence for only the property it actually checks.

This is a procedure, not a claim that any checks were executed for a particular binary.
