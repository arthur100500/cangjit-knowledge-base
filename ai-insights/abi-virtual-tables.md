# [ABI INFO] Virtual tables and interface tables

Scope: x86-64 Linux source snapshot inspected 2026-11-23. Paths are relative to sibling `cangjit` and `cangjie_runtime` roots. This describes Cangjie metadata, not the C++ Itanium vtable ABI.

## What is stored

`cangjit/include/cangjie/CHIR/Utils/UserDefinedType.h` defines `VTableInDef` and per-parent `VTableInType`; `cangjit/src/CHIR/Transformation/GenerateVTable/VTableGenerator.cpp` constructs the CHIR tables. The parent type matters: the same signature may have different indices in different parent tables (`CustomTypeDef.h`, `GetFuncIndexInVTable`). CJNative's `cangjit/src/CodeGen/CJNative/CGTypes/CJNativeCGExtensionDef.cpp`, `CGExtensionDef::GenerateFuncTableForType`, emits function pointers followed by corresponding outer-type-info entries in its generated function table.

```text
receiver -> runtime TypeInfo
             +-> extension data for introducing type
                    +-> funcTable: [method0, method1, ...]
                    +-> corresponding outer type metadata
```

This is conceptual: interface lookup has its own map and generic type-info can be resolved dynamically. Do not treat the diagram as an object header layout or one global vtable per class.

## Current JIT lookup

`cangjit/src/JIT/X86_64/Compilers/Expression/CompileInvoke.cpp`, `EmitTarget`, gets the runtime type from an instance header, clearing the upper 16 bits, or takes the RTTI value for static dispatch. For an interface it calls `CJ_MCC_GetMTable(dynamicTI, introducingTI)` and reads `table[index]`. For a class it indexes `dynamicTI->vExtensionDataStart` by introducing-class inheritance depth minus one, invokes `CJ_MCC_UpdateVMT`, reads the extension's function table, then indexes the slot. The current JIT hard-codes TypeInfo offset 72 and ExtensionData function-table offset 32; these are build/layout-specific x86-64 implementation assumptions, not portable ABI constants. It then calls `CJ_MCC_GetMethodOuterTI(dynamicTI, introducingTI, index)` for hidden metadata. Auto-environment closures use a separate object-slot route.

`cangjie_runtime/runtime/src/ObjectModel/MClass.cpp`, `TypeInfo::GetMTable`, uses a cached map keyed by interface UUID when available and otherwise finds extension data and refreshes the table. `TypeInfo::GetMethodOuterTI` also caches or resolves outer metadata. `ExtensionData.h` describes the function table and outer-TI data. The runtime's `TryUpdateExtensionData` comment gives a conditional compatibility example: adding a method at the end of an interface table can refresh an older implementing module's table. It is not a blanket promise for reordering, removal, layout changes, or arbitrary library versions.

For example, old `I` has `[foo]`; newer `I` has `[foo, goo]`. The source's specific refresh example produces an implementing class table `[foo, goo]` without recompiling that class. Call slot 0 still denotes `foo`; slot 1 resolves the added method under the stated runtime conditions. See [call paths](abi-call-paths.md).
