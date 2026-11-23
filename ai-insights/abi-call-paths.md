# [ABI INFO] Call paths and dispatch

Scope: x86-64 Linux source snapshot inspected 2026-11-23; paths are relative to sibling `cangjit` and `cangjie_runtime` roots. The paths below describe current JIT lowering, not every optimization or every native AOT call.

## Direct versus dynamic

```text
CHIR Apply / TryApply
  -> validate signature -> local record: ready target OR lazy entry stub
                        -> imported function: load package, resolve symbol
  -> place ABI arguments -> mov target, r11; call r11 -> result / unwind

CHIR Invoke / TryInvoke
  -> receiver -> dynamic TypeInfo -> class or interface method table lookup
  -> select method slot + outer TypeInfo -> place arguments -> call r11
```

In `cangjit/src/JIT/X86_64/Compilers/Expression/CompileApply.cpp`, `ResolveAddress` selects a compiled target or `CompileFunctionStub::Compile` for a local function. Imported functions go through `EnsurePackage` and `Resolve`; they are not local lazy materialization. `EmitCall` emits a full-width immediate move into R11 followed by indirect call and records a safepoint. `TryApply` supplies normal/unwind edges; `EmitCall` registers the exceptional landing path, while ordinary Apply does not supply these edges.

`CompileInvoke.cpp`, `EmitTarget` and `CompileCall`, implement dynamic calls. Instance dispatch takes the receiver's first word and clears its upper 16 bits to obtain the runtime TypeInfo; static dispatch starts from a TypeInfo input instead. Interface dispatch calls `CJ_MCC_GetMTable` and indexes by the CHIR virtual-method offset. Class dispatch follows the runtime TypeInfo extension array, updates the selected extension table with `CJ_MCC_UpdateVMT`, and indexes its function table. Both obtain the method's outer type-info through `CJ_MCC_GetMethodOuterTI`. Auto-environment closures have a separate object-slot path. See [virtual tables](abi-virtual-tables.md) for offsets and constraints.

## Example: interface call

```text
x: I  -- x.f() --> runtime type of x
                        |  + introducing interface I + slot k
                        v
                   GetMTable(type, I)[k] ----> target
                   GetMethodOuterTI(type, I, k) -> hidden metadata
                        | ABI argument placement
                        +----------------------> call target
```

The method slot is supplied by CHIR, not a name lookup at each call. `cangjie_runtime/runtime/src/ObjectModel/MClass.cpp`, `TypeInfo::GetMTable` and `GetMethodOuterTI`, show lookup, refresh and caching. The JIT rejects unsupported receiver/signature combinations rather than making arbitrary indirect calls. `CompileApply::ValidateCall` requires a CHIR function callee, and rejects C functions and varargs. The existence of a general C ABI therefore does not imply arbitrary C function pointers are supported by this JIT path. See [calling conventions](abi-calling-conventions.md), [lazy compilation](abi-lazy-compilation.md), and [interoperability](abi-interoperability.md).
