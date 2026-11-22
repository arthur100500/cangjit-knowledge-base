# [ABI INFO] Runtime type information

Scope: current source inspected 2026-11-23, x86-64 Linux, distinguishing the native runtime object model from the JIT's code that consumes it. These are implementation details, not a cross-version binary compatibility guarantee.

## Metadata is not the object

`cangjie_runtime/runtime/src/ObjectModel/MClass.h` defines native `MapleRuntime::TypeInfo`, including `typeArgs` and `GetTypeArgs`; `TypeInfoManager` manages concrete and generic type information (`cangjie_runtime/runtime/src/TypeInfoManager.h`). A type template and a concrete type's metadata are distinct: `TypeInfoManager::GetOrCreateTypeInfo(TypeTemplate*, U32, TypeInfo*[])` takes the template and its concrete argument metadata. It also exposes operations for fields, GC information and method tables; their internal formats must be read from the matching runtime revision, not inferred from this diagram.

```text
TypeTemplate  +  [TypeInfo(A), TypeInfo(B), ...]
                    |               |
                    +------ runtime-+----> TypeInfo for Template<A,B>
                                               |
                                               +--> typeArgs array
```

For example, a generic `Box<T>` needs the metadata for its actual `T` to obtain metadata for `Box<T>`; this describes the type, not the bytes in an individual `Box` instance. Name-based lookup and template instantiation are separate paths, and neither diagram promises allocation, identity, or reflection behavior beyond the code referenced below.

## JIT resolution

`cangjit/src/JIT/X86_64/Compilers/Context/TypeInfoEmitter.cpp`, `ResolveConcreteTypeInfo`, strips reference wrappers, ensures a custom type's package is available, and attempts `CJ_MCC_GetTypeByMangledName` using `CHIR::GetTypeQualifiedName`. If no metadata is found, it prepares a template, resolves each argument recursively, and calls `CJ_MCC_GetOrCreateTypeInfo(template, count, args)`. Missing bindings, packages, symbols or arguments can fail compilation with `UnresolvedSymbol`; unsupported shapes can fail with `UnsupportedCall`. The binding catalogue marks both helpers optional at initialization, not optional for every use.

```text
concrete CHIR type -> strip Ref -> ensure package -> lookup mangled name
                                                  | found -> TypeInfo*
                                                  | not found
                                                  v
                       template + recursively resolved arguments -> helper
```

`LoadTypeInfo` handles function-generic types via hidden stack slots, enclosing-type generics via the enclosing type's metadata, and generic-related types by emitting a helper call. `FunctionContext::ReserveHiddenTypeInfoSlots` reserves slots for function generic parameters, a parent custom type when present, and static `This` metadata. The exact calling path depends on the function; a slot reservation alone does not imply every slot is populated in every call.

For an outer generic, the JIT loads the enclosing `TypeInfo*` from its hidden slot and follows `typeArgs` at byte offset 48, then an eight-byte indexed element. For nested generic paths it repeats that step. `LoadTypeInfo` also extracts instance `This` type information from the first word of the receiver by shifting left and right 16 bits. These are concrete x86-64 code-generation assumptions, not portable C++ layout rules. A runtime layout or header encoding change requires a matching JIT change.

For generic-related constructed types, the emitter places argument metadata in a 16-byte-rounded temporary stack area; it passes the template in `rdi`, argument count in `esi`, array in `rdx`, calls the helper and takes its result from `rax`. This is the JIT's x86-64 call sequence; the runtime declaration is `CJ_MCC_GetOrCreateTypeInfo(TypeTemplate*, U32, TypeInfo*[])` in `cangjie_runtime/runtime/src/CompilerCalls.h`. The source comments identify this helper as not a managed safepoint; do not generalize that property to other runtime calls.

Native code generation also produces metadata-related functions (`cangjit/src/CodeGen/CJNative/CGTypeInfo.h`, `GenTypeInfoFns` and `GenSuperFnOfTypeTemplate`); that is separate from JIT emission even though both must agree with the runtime. See `abi-runtime-functions.md` and `abi-compatibility.md`.
