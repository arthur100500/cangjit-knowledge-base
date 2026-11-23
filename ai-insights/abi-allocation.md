# [ABI INFO] Allocation and object lifetime

Scope: current checked-out sources, inspected 2026-11-23, x86-64 Linux. Paths are relative to `cangjie_runtime/` or `cangjit/` as named. Allocation entry points and layouts are implementation details, not a cross-version public ABI.

## Heap object allocation

The compiler-facing runtime calls are `extern "C"`; `cangjie_runtime/runtime/src/CompilerCalls.cpp` states that MCC calls follow the C calling convention. `MCC_NewObject(const TypeInfo*, MSize)` calls `ObjectManager::NewObject`; its debug check expects `AlignUp(klass->GetInstanceSize(), 8) + TYPEINFO_PTR_SIZE`. For example, if the instance payload size is 12 bytes and the type-info word is 8 bytes, that expression requests 24 bytes. This is a hypothetical payload size, not the layout of any particular source class.

```text
compiler code -> MCC_NewObject(type, size)
              -> ObjectManager::NewObject
              -> MObject::NewObject
              -> HeapManager::Allocate(size, allocation kind)
              -> initialize type info in state word -> return object reference
```

The runtime source `runtime/src/ObjectManager.inline.h`, `NewObject`, and `runtime/src/ObjectModel/MObject.cpp`, `MObject::NewObject`, show this chain. Failure returns null internally; the MCC wrapper calls `ExceptionManager::CheckAndThrowPendingException` on failure. It is incorrect to model this as an ordinary `malloc`/`free` pair, or to assume the wrapper simply returns null on every failure.

`runtime/src/Heap/Allocator/Allocator.h` specifies an 8-byte allocation alignment and `HEADER_SIZE = 0` for an *additional allocator header*. This does **not** remove the managed `BaseObject` state word at the beginning of an object. Physical allocated bytes may include alignment/roundup and differ from logical payload or resident memory (`runtime/src/Heap/Heap.h`, size comments).

The x86-64 JIT uses runtime bindings including `CJ_MCC_NewObject` (`cangjit/src/JIT/Runtime/RuntimeFunctions.inc`); `Compilers/Expression/CompileObject.cpp`, `CompileAllocation`, selects allocation helpers and records a safepoint. This evidence is for that JIT path, not a guarantee that native code always emits exactly the same sequence.

## Arrays and special allocations

`runtime/src/CompilerCalls.cpp` provides `MCC_NewArray`, `MCC_NewObjArray`, and width-specific `MCC_NewArray8/16/32/64`. `runtime/src/ObjectModel/MArray.inline.h`, `CalculateArraySize` and `NewKnownWidthArray`, compute content offset plus element count times element width, reject overflow/oversize against heap capacity, allocate, install array type info, then set length. Example: an array of three 8-byte references requests `GetContentOffset() + 3*8` bytes before allocator rounding; element width and content offset are determined by the actual type/build.

`runtime/src/Common/TypeDef.h` defines `MOVEABLE_OBJECT`, `PINNED_OBJECT`, and `RAW_POINTER_OBJECT` allocation kinds. `MObject::NewPinnedObject` requests `PINNED_OBJECT`, and `MCC_NewPinnedObject` has an `isFinalizer` parameter. Pinning is a distinct allocation path; it is not proof that an arbitrary ordinary object can be pinned by retaining a raw address. Local objects are another distinct path: `MObject::NewLocalObject` uses `HeapManager::AllocateLocal` and `SetLocalClassInfo`; `StateWord.h` describes `LOCAL_OBJECT` as not participating in GC forwarding or object locking. The JIT also emits start/end local-region helpers (`CompileObject.cpp`, `CompileLocalRegion`). Local-region ownership, escape restrictions and exact cleanup semantics must be determined from the applicable region implementation, not inferred as ordinary stack allocation.

## Lifetime and finalization

```text
allocated -> reachable -> unreachable -> collector processes -> reclaim
                  \                         /
                   +-- finalizer registration --+-> finalizable queue -> run later
```

`BaseObject::OnFinalizerCreated` in `runtime/src/Common/BaseObject.cpp` marks the new object and registers it with the mutator or finalizer processor. `runtime/src/Heap/Collector/FinalizerProcessor.h` says a dead registered finalizer is moved to a finalizable list and run by the processor thread; it also accounts for resurrection. Thus no deterministic collection time, finalizer order, or immediate release of external resources follows from losing a reference. Use the relevant explicit resource-management API when timely release matters. GC configuration, barriers and root metadata are covered in [garbage collection](abi-garbage-collection.md); representation is covered in [object/value representation](abi-value-representation.md).
