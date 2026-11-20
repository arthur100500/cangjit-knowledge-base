# JIT object allocation dispatch

Keep scalar `Allocate` on the existing stack-slot path. Dispatch class `Allocate`
and `TryAllocate` to the object allocator, and `StartRegion` and `EndRegion` to
local-region lowering. A `TryAllocate` must preserve its success and exception
edges. Reject unsupported types and unresolved runtime type information; local
finalizers remain unsupported until their lifetime frontiers are implemented.

The alternative of routing all allocations through object lowering would break
scalar stack allocations. Fabricating type metadata for JIT-defined classes would
violate the runtime ABI; only already-loaded types can currently be resolved.

Object allocations, including pinned objects, use the runtime-required size
`align_up(TypeInfo::GetInstanceSize(), 8) + 8`; it must not be a constant
shared by unrelated classes.

## Imported standard packages

Before resolving an imported standard-library type or function, load its
package through `LoadCJLibraryWithInit`. Derive the library name from the
CHIR package name, retain it in the runtime bindings for symbol lookup, and
unload libraries in reverse load order. Do not load the same package twice.
This follows the runtime loader's package initialization contract without
eagerly initializing unrelated packages. JIT-defined package metadata and
arbitrary external package discovery remain separate concerns.

## Catch type checks

Lower `InstanceOf` for class references by resolving the target type in loaded
runtime metadata, obtaining the object's runtime type, and calling
`CJ_MCC_IsSubType`. Store the Boolean result. Reject unresolved types and
non-class operands: generic and tuple tests require different native semantics.
This enables catch type dispatch without inventing metadata for JIT-defined types.

## Native calls for object construction

Use the optimized CHIR return type for the native ABI, as CodeGen does: an
imported constructor can return `Void`, while ordinary `Unit` functions use
the usual indirect return. Resolve imported functions in loaded native
libraries. Use `ApplyBase::GetInstParentCustomTyOfCallee` with a JIT-owned
CHIR context and builder to obtain the enclosing type, then pass its runtime
type info at the native parameter location. Preserve GC safepoint and unwind
metadata. Class-reference static casts preserve the reference, matching
native `GenerateTypeCast`.

The separate CHIR context must handle input-package types, including inherited
and instantiated parents. Runtime type info is still unavailable for
JIT-defined classes; never substitute an uninstantiated parent.

## Override signatures

Classify `OverrideSrcFuncType` as CodeGen does. Permit a call or lazy stub
only when its body and override signatures have the same native
representation, including class-reference upcasts. Reject conversions that
need boxing, unboxing, or aggregate layout handling rather than equating
unrelated types by size.
Scalar integer and Boolean call results are normalized to their declared
width; object references retain their native pointer representation.

## Virtual calls

Use CodeGen's virtual dispatch ABI: interface method tables are obtained from
`CJ_MCC_GetMTable`, class vtables are updated with `CJ_MCC_UpdateVMT`, and
auto-environments dispatch through their stored method slots. Derive the
instantiated introducing type with the CHIR builder and provide the same
supplementary TypeInfo arguments, calling convention, GC safepoints, and
exceptional edges as native CodeGen. `GetRTTI` and `GetRTTIStatic` provide
the runtime type operands used by virtual calls.
Generic functions preserve their supplementary TypeInfo arguments in dedicated
frame slots; callers pass concrete or enclosing generic TypeInfos at the
native ABI locations. RTTI and virtual-call lowering read those same values.
Dynamic generic TypeInfos use the native type template and
`CJ_MCC_GetOrCreateTypeInfo`, including `Closure.tt` for auto-environments.
Stage supplementary TypeInfos before loading ordinary call operands when
instantiation can invoke the helper. The native
`llvm.cj.get.type.info` intrinsic is `nounwind` and `readonly`; its helper is
not treated as a managed safepoint.
Generic class and extension methods also recover enclosing parameters from
the outer TypeInfo's `typeArgs`, following the extended type's nested argument
path as native CodeGen does. On x86-64 that field is at byte offset 48.
For a concrete generic TypeInfo missing from the runtime registry, resolve its
template and recursively materialize its concrete arguments during JIT
compilation; the runtime canonicalizes the resulting TypeInfo.
Class allocation uses the same concrete TypeInfo resolver. For a dynamic
generic class, resolve its TypeInfo at runtime and derive the aligned payload
size from it before calling the normal allocation helper.

For an owned runtime, stop the runtime and its collector before unloading
native libraries: unreachable heap objects may still reference their TypeInfos.
Borrowed-runtime callers must quiesce GC and ensure no heap object references
those libraries before shutdown.

## Checked arithmetic exceptions

Match native CodeGen's exception path: construct deduplicated, stable literal
`String` records backed by static-layout `RawArray<UInt8>` data, call the
corresponding `rt$CreateOverflowException_msg` or
`rt$CreateArithmeticException_msg` factory, and throw the resulting object.
Use CodeGen's exact operation, division, shift, and cast messages. Record a
safepoint and unwind entry for each call that can throw. Keep literal storage
alive with the JIT global context and preserve wrapping and saturating paths.

No-message runtime throw helpers are not equivalent: they lose observable
native exception messages.

## Unit returns through lazy resolution

Accept native `Unit` and `Nothing` indirect returns in lazy resolver stubs.
Preserve the hidden sret argument with the other argument registers and, when
stack growth is enabled, mark its saved location as a stack-interior root.
The native Unit type is empty; Unit stack allocation and constants have no
payload, and Unit stores perform no memory write. Other aggregate sret forms
remain unsupported until their layouts and roots are implemented.

On the current SDK, `cjStackGrow=1` runs this path. Forcing `cjStackGrow=0`
aborts while loading std.core because its stack-map configuration differs;
testing that mode requires a matching runtime and standard library.
