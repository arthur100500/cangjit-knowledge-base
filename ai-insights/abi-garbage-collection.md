# [ABI INFO] Garbage collection and managed references

Scope: current checked-out sources, inspected 2026-11-23, x86-64 Linux. Runtime paths below are relative to `cangjie_runtime/`; JIT paths are relative to `cangjit/`. These are implementation contracts, not a promise that every build or every future compiler uses the same collector.

## Reachability, roots, and metadata

Managed objects begin with a runtime state word and contain reference fields described by their type's GC metadata. `runtime/src/Common/BaseObject.cpp`, `BaseObject::ForEachRefField`, dispatches using `TypeInfo::HasRefField()` and `GetGCTib()`: for ordinary objects the bitmap describes payload after `TYPEINFO_PTR_SIZE`; for raw arrays it visits reference elements, or applies a struct element's bitmap to each element. A primitive-only value is not automatically a pointer just because its bits resemble an address.

```text
stack/register root --+--> object A --reference field--> object B
static/export root ----+       | GC bitmap says where references are
                              +--integer field: not followed as a pointer
unreachable object C ------------------------------------> candidate garbage
```

A moving collector must find **locations** containing roots and update them, not merely discover object addresses. `runtime/src/Heap/Collector/TracingCollector.cpp`, `VisitStackRoots`, visits slot and register roots from frame maps; its derived-pointer handling runs after base roots. `runtime/src/Heap/Heap.h` exposes static and export root registration. Other runtime/concurrency and finalizer roots are visited by collector code; a raw pointer held only in unregistered native storage is not thereby a GC root.

For the x86-64 JIT, `src/JIT/X86_64/Compilers/Context/SafepointRecorder.cpp`, `Record`, computes liveness and records GC registers, slots and derived roots through `JitMetadataBuilder::RecordSafepoint`. `src/JIT/Runtime/JitMetadataBuilder.cpp`, `BuildStackMap`, encodes these records. This is the current JIT mechanism; native AOT metadata has its own producer, so do not assume JIT internals describe native compiler emission. Exact supported expression and root shapes are conditional on JIT lowering and liveness checks.

## Phases and barriers

`runtime/src/Heap/Heap.cpp` selects `cjEnableGC=0` disabled, `1` WGC, `2` generational; unset or invalid values select WGC. Selection is initialized from the environment; it is not proof that every deployed runtime uses WGC. In WGC, `runtime/src/Heap/WCollector/WCollector.cpp`, `TraceHeap`, enumerates roots, traces live objects, and processes finalizers; `PostTrace` clears weak-reference and SATB buffers, handles regions and prepares forwarding. Subsequent forwarding/fixing can move eligible objects. This is a simplified view, not a synchronization schedule or a description of every generational phase.

```text
roots -> ENUM -> TRACE -> POST_TRACE -> forwarding / pointer fixup -> reclaim
                 ^           |
       mutator barriers   weak refs / finalizers
```

`runtime/src/Heap/Heap.h`, `Heap::GetBarrier` and `InstallBarrier`, expose a phase-dependent barrier; `runtime/src/ObjectModel/MArray.inline.h`, `GetRefElement` / `SetRefElement`, call its reference read/write operations. Bypassing these operations for managed reference stores can violate collector invariants. Primitive loads and reference loads have different treatment; do not infer that all memory access is barrier-free or that every store has the same barrier in every phase.

## Lifetime implications

Reachability is not lexical scope: after the last relevant root disappears, a normal object can become collectible, but collection and finalization have no demonstrated immediate timing guarantee. `runtime/src/Common/BaseObject.cpp`, `OnFinalizerCreated`, registers pending finalizers; `runtime/src/Heap/Collector/FinalizerProcessor.h` distinguishes registered finalizers from finalizables and working finalizables, which it visits as roots. The processor can run later and its comments explicitly account for resurrection. Weak references are not strong ownership; WGC's post-trace path clears its weak-reference buffer. Neither weak-reference clearing timing nor finalizer ordering should be generalized beyond the relevant runtime path.

A pinned allocation is a distinct runtime allocation request, not a general declaration that all references remain at fixed addresses. See [allocation and object lifetime](abi-allocation.md) and [object/value representation](abi-value-representation.md).
