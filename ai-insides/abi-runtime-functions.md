# [ABI INFO] Runtime function catalogue

Scope: source snapshot inspected 2026-11-23, x86-64 Linux JIT bindings, not a promise of a stable public ABI. The authoritative list is `cangjit/src/JIT/X86_64/RuntimeFunctions.inc`; native compiler calls are not necessarily limited to this list. The first eight entries have types inferred with `decltype` from runtime declarations; all other entries are stored as `void*`, which does **not** specify a callable signature. Names below classify the intended family, not a complete behavioral contract.

## Binding and lifecycle

```text
runtime .so --dlopen(RTLD_NOW|RTLD_GLOBAL)--> required dlsym checks
                                             |
                              getter for optional symbol
                                             v
                              loaded CJ libraries, then runtime dlsym
```

`JitRuntimeBindings::LoadRequiredSymbols` fails initialization on a missing required address. Optional means not required **at initialization**, not safe to omit for every program: `GetName()` resolves on demand and returns an error if unavailable. `Resolve` searches loaded libraries through `FindCJSymbol`, then the runtime through `dlsym`, and caches successes. See `cangjit/src/JIT/X86_64/JitRuntimeBindings.cpp`, `LoadRuntime`, `LoadRequiredSymbols`, `Resolve`, and generated getters.

## Typed entries: required

Signatures are from `cangjie_runtime/runtime/src/Cangjie.h`; typedefs and error codes are defined there. `const` on a by-value handle is omitted below.

| Binding | Export | Declared signature | Family |
|---|---|---|---|
| InitRuntime | `InitCJRuntime` | `enum RTErrorCode (const struct RuntimeParam*)` | runtime lifecycle |
| FiniRuntime | `FiniCJRuntime` | `enum RTErrorCode (void)` | runtime lifecycle |
| LoadLibrary | `LoadCJLibraryWithInit` | `int (const char*)` | library lifecycle |
| UnloadLibrary | `UnloadCJLibrary` | `int (const char*)` | library lifecycle |
| FindSymbol | `FindCJSymbol` | `void* (const char*, const char*)` | symbol lookup |
| RunTask | `RunCJTask` | `CJThreadHandle (CJTaskFunc, void*)` | task |
| TaskReturn | `GetTaskRet` | `int (CJThreadHandle, void**)` | task result |
| ReleaseTask | `ReleaseHandle` | `void (CJThreadHandle)` | task handle |

For an embedding usage sequence, the example beside `FindCJSymbol` in `Cangjie.h` initializes the runtime, loads a library, finds a function and runs a task; consult that header for the full lifecycle and error conditions. A found address is not automatically a function of an arbitrary signature.

## Untyped entries

Every row in this section is `void*` in the catalogue: its callable signature is unresolved **by the catalogue**. Consult the relevant runtime definition and actual call site before calling; platform stubs in particular must not be treated as ordinary C functions. R = required at initialization, O = optional at initialization.

| Binding | Export | Need | Family |
|---|---|---|---|
| NativeToCangjieStub | `CJ_MCC_N2CStub` | R | transition stub |
| ThrowException | `CJ_MCC_ThrowException` | R | exception |
| ExceptionWrapper | `CJ_MCC_GetExceptionWrapper` | R | exception |
| PostThrowException | `CJ_MCC_PostThrowException` | R | exception |
| CangjieToNativeStub | `CJ_MCC_C2NStub` | O | transition stub |
| TypeByName | `CJ_MCC_GetTypeByMangledName` | O | type lookup |
| CreateTypeInfo | `CJ_MCC_GetOrCreateTypeInfo` | O | type metadata |
| RemoveLocalFinalizer | `CJ_MCC_RemoveLocalFinalizer` | O | finalization |
| MethodOuterTypeInfo | `CJ_MCC_GetMethodOuterTI` | O | method metadata |
| MethodTable | `CJ_MCC_GetMTable` | O | method dispatch metadata |
| UpdateVTable | `CJ_MCC_UpdateVMT` | O | virtual dispatch metadata |
| IsSubType | `CJ_MCC_IsSubType` | O | type relationship |
| IsTupleTypeOf | `CJ_MCC_IsTupleTypeOf` | O | type relationship |
| NewLocalObject | `CJ_MCC_NewLocalObject` | O | allocation |
| NewFinalizer | `CJ_MCC_NewFinalizer` | O | finalization |
| NewLocalWeakRefObject | `CJ_MCC_NewLocalWeakRefObject` | O | weak reference allocation |
| NewWeakRefObject | `CJ_MCC_NewWeakRefObject` | O | weak reference allocation |
| NewPinnedObject | `CJ_MCC_NewPinnedObject` | O | pinned allocation |
| NewObject | `CJ_MCC_NewObject` | O | allocation |
| AddLocalFinalizer | `CJ_MCC_AddLocalFinalizer` | O | finalization |
| StartLocalRegion | `CJ_MCC_StartLocalRegion` | O | local region |
| EndLocalRegion | `CJ_MCC_EndLocalRegion` | O | local region |
| TypeInstanceSize | `_ZNK12MapleRuntime8TypeInfo15GetInstanceSizeEv` | O | type size; C++ mangled symbol |
| CreateOverflowException | `rt$CreateOverflowException_msg` | O | exception construction |
| CreateArithmeticException | `rt$CreateArithmeticException_msg` | O | exception construction |

For two concrete examples, `TypeInfoEmitter::ResolveConcreteTypeInfo` casts TypeByName to `void* (*)(const char*)` and CreateTypeInfo to `void* (*)(void*, uint32_t, void**)`. Runtime definitions use `TypeInfo*` and `TypeTemplate*` (`cangjie_runtime/runtime/src/CommonAlias.h`, `CompilerCalls.h`). These examples do not determine signatures of the other untyped entries. See `abi-runtime-types.md` for the metadata path and `abi-compatibility.md` for verification.
