# Cangjie Runtime Garbage Collection — Full Reference

All paths relative to `runtime/src/`. Symbols are given with their defining file; line numbers drift, so trust symbol names.

---

## 1. Top-level architecture

### 1.1 GC mode selection

- `Heap::GetGCMode()` (`Heap/Heap.cpp`) reads the `cjEnableGC` environment variable once at startup:
  - `0` → `GCMode::DISABLED`
  - `1` → `GCMode::WGC` (whole-heap collector, the default when unset/invalid)
  - `2` → `GCMode::GENERATIONAL`
- Mode decides two object graphs:
  - **Allocator**: `Allocator::NewAllocator()` (`Heap/Allocator/Allocator.cpp:76`) returns `MixedRegionSpace` for `GENERATIONAL`, plain `RegionSpace` otherwise.
  - **Collector**: `CollectorProxy::Init()` (`Heap/Collector/CollectorProxy.cpp:11`) initializes and selects `youngCollector` (generational) or `wCollector` (WGC) as `currentCollector`.
- `HeapImpl` (`Heap/Heap.cpp`) owns everything: the allocator space, `CollectorResources`, `CollectorProxy`, one barrier object per GC phase, the static-root table, and the export-root table.

### 1.2 Class hierarchy

```
Collector  (Heap/Collector/Collector.h)               — interface: phases, RequestGC, ForwardObject, TryUpdateRefField…
└── CollectorProxy (Heap/Collector/CollectorProxy.h)  — facade holding all real collectors; dispatches per GCReason
    ├── WCollector  : CopyCollector (Heap/WCollector/WCollector.h)      — "Smooth Collector" (WGC full GC)
    ├── YoungCollector : WCollector (Heap/GenerationalGC/YoungCollector.h)  — generational young GC
    └── MixedCollector : YoungCollector (Heap/GenerationalGC/MixedCollector.h) — generational full/mixed GC
TracingCollector (Heap/Collector/TracingCollector.h)  — abstract root-enumeration + marking engine
CopyCollector (Heap/Collector/CopyCollector.h)        — abstract GC driver (RunGarbageCollection template)
```

`CollectorType` values (`Collector.h:46`): `NO_COLLECTOR`, `PROXY_COLLECTOR`, `COPY_COLLECTOR` (Regional-Copying), `SMOOTH_COLLECTOR` (WGC), `YOUNG_COLLECTOR`, `MIXED_COLLECTOR`.

Supporting machinery (not collectors, but GC-owned):

| Component | File | Role |
|---|---|---|
| `CollectorResources` | `Heap/Collector/CollectorResources.h/.cpp` | GC main thread, task queue, thread pool, finalizer processor, GCStats, sync/async request plumbing |
| `TaskQueue<GCExecutor>` / `GCTask` / `GCExecutor` | `Heap/Collector/TaskQueue.h/.cpp` | Sync queue (ordered, cond-var) + lockless async priority bitmap queue |
| `GCThreadPool` | `Heap/GcThreadPool.h/.cpp` | Parallel mark/forward/sweep workers (`HeapWork` tasks) |
| `GCStats` / `GenerationalGCStats` | `Heap/Collector/GcStats.h/.cpp` | Live bytes, garbage ratio, collection rate, young/mixed thresholds, allocation speed |
| `GcRequest.h/.cpp` | `Heap/Collector/GcRequest.h/.cpp` | `GCReason` enum + `GCRequest` throttling policy (`g_gcRequests[]`) |
| `FinalizerProcessor` | `Heap/Collector/FinalizerProcessor.h/.cpp` | Dedicated thread running finalizers; resurrection handling |
| `SatbBuffer` / `WeakRefBuffer` | `Mutator/SatbBuffer.h/.cpp` | Per-mutator SATB node pools; weakref fixup list |
| `RememberSet` | `Heap/GenerationalGC/RememberSet.h/.cpp` | Old→young pointer registry backed by per-region card tables |
| `HeapVerifier` | `Heap/HeapVerifier.h/.cpp` | `cjEnableHeapVerify` PRE_GC/POST_GC checkpoints |

### 1.3 Phases

`GCPhase` (`Heap/Collector/Collector.h:23`). WGC phases: `IDLE → ENUM → TRACE → CLEAR_SATB_BUFFER → POST_TRACE → PREFORWARD → FORWARD → RECLAIM_SATB_NODE`; generational phases mirror them (`GC_PHASE_GENERATION_*`, values 15–21). Any phase past `GC_PHASE_INIT` activates the corresponding barrier.

Barrier install (`HeapImpl::InstallBarrier`, `Heap/Heap.cpp`): each phase maps to a barrier object:

| Phase (WGC) | Barrier | Write-path behavior |
|---|---|---|
| `IDLE` (and start of GC) | `IdleBarrier` | Plain store; no remembered object |
| `ENUM` | `EnumBarrier` | SATB enqueue of overwritten + new values; tags ref fields |
| `TRACE` | `TraceBarrier` | SATB enqueue; resolves old pointers to latest version |
| `CLEAR_SATB_BUFFER` (uses trace barrier) | — | Remark loop drains SATB |
| `POST_TRACE` | `PostTraceBarrier` | No enqueue (tracing done); just tag/untag via collector |
| `PREFORWARD` | `PreforwardBarrier` | Read barrier forwards tagged current pointers through forwarding table |
| `FORWARD` | `ForwardBarrier` | Read barrier forwards; untag unmovable from-objects |
| `RECLAIM_SATB_NODE` | stays `idleBarrier` for WGC |

Generational variants (`Heap/GenerationalGC/Generation*Barrier.cpp`) wrap the WGC barrier and add `RSetUpdateBarrier` on every reference write (`RSetUpdateBarrier.cpp`): if the owning object is in an old region and the target is not old, mark the slot in the region's card table (`RegionInfo::MarkRSetSlot`) and add the region to the mutator's `localRSetRegions` (merged into the global `RememberSet` at GC start or mutator exit, `Mutator.cpp:655`, `Mutator::GcPhaseEnum`).

`Heap::GetBarrier()` is a pointer swap (`Heap::currentBarrierPtr`), so mutators pick up the new barrier at the next field access after the phase transition publishes it.

### 1.4 Phase transition to mutators

`TracingCollector::TransitionToGCPhase` → `MutatorManager::TransitionAllMutatorsToGCPhase` (`Mutator/MutatorManager.cpp:486`):

1. `Heap::GetHeap().InstallBarrier(phase)` then `SetGCPhase(phase)`.
2. Broadcasts `SUSPENSION_FOR_GC_PHASE` to every mutator (plus `SetSafepointActive(true)`).
3. `EnsurePhaseTransition` spins: mutators already in a saferegion are transitioned by the GC thread; running mutators transition themselves at the next safepoint/saferegion crossing (`Mutator::HandleSuspensionRequest`, `Mutator::TransitionGCPhase` in `Mutator.inline.h` — a `transitionState` CAS machine: `NO_TRANSITION → NEED_TRANSITION → IN_TRANSITION → FINISH_TRANSITION`).

Mutators read the new phase/barrier only after their own transition completes, giving each phase a consistent view. During copying, `WCollector::Preforward` uses `ScopedLightSync` (`MutatorManager.h:296`): full STW to switch into `PREFORWARD`, then the world resumes with the forwarding read barrier active (this is what makes the copy mostly concurrent).

---

## 2. The collectors and their algorithms

### 2.1 `CopyCollector` — the GC driver template

`Heap/Collector/CopyCollector.cpp`. `RunGarbageCollection(gcIndex, reason)` is the frame every collector executes:

1. `ScopedSTWLock` — excludes other STW attempts.
2. `PreGarbageCollection(isConcurrent=true)` (`TracingCollector.cpp`): optional `HeapVerifier::VerifyAt(PRE_GC)`, records `liveBytesBeforeGC`, resets mutator-assist budgets, `SatbBuffer::Init()`, sizes/priorities the thread pool, fills stats reason/async flags.
3. `DoGarbageCollection()` — the collector-specific body.
4. `GC_REASON_OOM` → `ReclaimGarbageMemory(true)` (release pages to OS immediately).
5. `PostGarbageCollection(gcIndex)`: transitions to `*_RECLAIM_SATB_NODE`, `SatbBuffer::ReclaimALLPages()`, `PagePool::Trim()`, optional POST_GC verify, `NotifyGCFinished` (wakes sync waiters), `DestroyExpiredMutators`.
6. `UpdateGCStats()` — retunes thresholds (see §2.5).
7. Global counters `g_gcCount`, `g_gcTotalTimeUs`, `g_gcCollectedTotalBytes` updated.

### 2.2 `WCollector` ("Smooth Collector", WGC full GC)

Regional-copying full GC over the whole heap. Core files: `Heap/WCollector/WCollector.h/.cpp`.

`DoGarbageCollection()` (`WCollector.cpp:556`) sequence:

1. **`TraceHeap()`** (`:397`)
   - `RegionSpace::AssembleGarbageCandidates()` — merges `rawPointerPinnedRegionList`, `recentFullRegionList`, `unmovableFromRegionList` into `fromRegionList` (small candidates), `recentPinnedRegionList` into pinned candidates, `recentLargeRegionList` into large candidates (`RegionManager.cpp:636-652`). All candidate regions get live info cleared.
   - `TransitionToGCPhase(GC_PHASE_ENUM)` → `DoEnumeration(workStack, foreignRootsSet)` — enumerate all roots (§3.1). Enum barrier active; enum also *tags* static/ref fields with the current tag ID (§2.4).
   - `TransitionToGCPhase(GC_PHASE_TRACE)` → `PrepareTrace()`, `DoTracing(...)` — parallel concurrent mark (§3.2) + `ProcessFinalizers()`.
2. **`PostTrace()`** (`:421`)
   - `GC_PHASE_POST_TRACE` (post-trace barrier: writes no longer enqueue to SATB).
   - `RegionManager::HandleTraceRegions()`, `WeakRefBuffer::ClearWeakRefBuffer()` (clears dead referents via `ReadWeakRef`), `SatbBuffer::ClearBuffer()`.
   - `PrepareCycleRef()`, `CollectPinnedGarbage()`, `RefineFromSpace()` → `RegionManager::ExemptFromRegions()` (`RegionManager.cpp:658`): per from-region decision —
     - live bytes > `exemptedRegionThreshold` of region size → **exempt** (become unmovable; swept in place; no copy),
     - contains raw-pointer (externally exposed, unmovable) objects → **pinned** region (becomes sweepable),
     - otherwise → **copy** candidate (`forwardBytes`).
   - `fwdTable.PrepareForwardTable(true)` → `RegionSpace::PrepareFromSpace` establishes region routes (`RegionManager` decides per-region copy destinations).
   - `CollectLargeGarbage()` — unmarked large regions released/collected immediately.
3. **`Preforward()`** (`:441`)
   - `ScopedLightSync` STW → `GC_PHASE_PREFORWARD` (preforward barrier installed), world resumes.
   - Thread-pool jobs: forward-fix concurrency-model roots (cj futures), finalizer-processor raw pointers, export roots (`ForwardUpdateRawRef` CAS-fixes each root to its forwarded to-version), discovered extern objects, resurrected export objects (`Preforward*` at `WCollector.cpp:328-396`).
4. **`ForwardFromSpace()`** (inherited, `CopyCollector.cpp`)
   - `GC_PHASE_FORWARD`, `RegionManager::ForwardFromSpace(threadPool)` → `ForwardTask` workers call `RegionManager::ForwardRegion(region)` (`RegionManager.cpp:1348`): empty region → collect; else route region, then `region->VisitLiveObjectsUntilFalse(collector.ForwardObject)`, set route state `FORWARDED`, collect the region (its garbage bytes are gone without a sweep).
5. Wrap-up (`:565-573`): `GC_PHASE_IDLE`, `MergeResurrectExportObjects`, `PostResolveCycleTask` (OHOS cycle-reference resolution through interop hooks, `ResolveCycleRef` `:504`), **`FlipTagID()`** (§2.4), `SetTagID`, `CollectSmallSpace()` (reclaim from-space garbage regions — `CollectFromSpaceGarbage` merges them into `garbageRegionList`/reclaims on OHOS, `RegionManager.h:272`), `UnbindPreviousLiveInfo`.

Object forwarding (`ForwardObjectImpl`, `WCollector.cpp:625`): per-object state-word lock protocol — already forwarded → route lookup; locked → spin; else lock and `ForwardObjectExclusive` → `RouteObject` (region route = precomputed to-space address by pre-live bytes, `LiveInfo.h` `CopyRouteInfo`), `CopyObject` (memmove_s), set to-state `NORMAL`, release fence, mark from-object `FORWARDED`.

`WCollector` also resolves interop cycles: during marking, `DFSTraceExportObject` (`TracingCollector.cpp`) records dead foreign-referenced groups into `discoveredExternObjects`; `ResolveCycleRef` (OHOS only) invokes the foreign side's `CrossRefHandler` stub to break/collect the cycle.

### 2.3 Generational collectors

Heap layout when `GCMode::GENERATIONAL`: `MixedRegionSpace` + `MixedRegionManager` (`Heap/Allocator/MixedRegionSpace/`). Regions are either **old** (`oldRegionList`, `oldFromRegionList`, `sweptOldRegionList`, `ghostOldFromRegionList`) or **young** (everything else: TL regions, `recentFullRegionList`, `fromRegionList`, `sweepableYoungRegionList`, `sweptYoungRegionList`, `discreteForwardingRegionList`, `ghostPromoteRegionList`). Allocations go through `GenerationAllocBuffer` (`Heap/GenerationalGC/GenerationAllocBuffer.h/.cpp`): young objects on thread-local young regions or slot-region caches; long-lived/pinned-friendly allocations can take old regions (`AllocateOld`).

#### 2.3.1 `YoungCollector` — young GC

`Heap/GenerationalGC/YoungCollector.h/.cpp`. Overrides:

- **Candidate assembly** (`AssembleCandidates` → `MixedRegionSpace::AssembleYoungCandidates`): `MixedRegionManager::AssembleYoungRegions` (`MixedRegionManager.h:60`) — merges `recentFullRegionList` into `fromRegionList` (copy candidates); if the young space is heavy (`ShouldSplit` + swept young ≤ ⅓ of young capacity) it splits into movable (copy) vs swept (sweep-only) parts; promoted regions move to `discreteForwardingRegionList`. Plus pinned and large candidates.
- **Phases**: `GC_PHASE_GENERATION_ENUM/TRACE/PREFORWARD/FORWARD/POST_TRACE/IDLE`.
- **Root scoping** (`EnumRefFieldRoot`, `EnumAndTagRawRoot`, `IsTargetAddress = IsYoungHeapAddress`, `IsTargetRegion = !IsOldRegion`): static/raw fields pointing into old regions are skipped — *unless* the field holds an old (previous-cycle) tagged pointer, which must be fixed because its target may have been promoted last cycle (`YoungCollector.cpp:90-137`).
- **Remembered set**: `EnumAllCommonRoots` adds `EnumRememberedRoots` (`YoungCollector.cpp:265`): every recorded old→young slot is re-enumerated as a root (the mutator-side RSet barrier guarantees old→young pointers are registered since the region was swept).
- **Marking**: `MarkObject` skips non-young objects (returns "marked" without touching bits), and for young objects also **increments object age** via `RegionInfo::IncObjectAge` (`RegionInfo.h:267`, `AgeBitmap`, 4 bits per 8-byte slot). Age ≥ `OLD_AGE = 3` (`YoungCollector.h:70`) ⇒ `TagPromoteRegion` sets the region's promoted flag.
- **Promotion**: two forms —
  - whole-region in-place promotion: `MixedRegionManager::PromoteRegionInPlace` (`MixedRegionManager.cpp`) flips the region old, records young-referencing slots into the RSet, enlists it in `oldRegionList` — no object copying at all;
  - per-object promotion: `YoungCollector::TryForwardObject` (`:222`) — for a promoted from-region, routes objects through `MixedRegionManager::PromoteObject` into an old region, tracked by an `ObjectForwardingTable` per region (`Heap/GenerationalGC/ObjectForwardingTable.h`), else falls back to plain region copy.
  - `ClassifyYoungRegions` (`MixedRegionManager.cpp:99`) in PostTrace picks the strategy per from-region: non-thread-local-sized regions and promoted regions with no raw pointers → promote; others → copy or exempt as in WGC.
- **`CopyObject`** (`:210`) copies age along with bytes (`toRegion->SetObjectAge`).
- **Sweep** (`ConcurrentSweep`, `:379`): parallel `SweepTask`s over `sweepableYoungRegionList` (10 regions/task): zero-live regions are collected outright; others `SweepRegion()` into free-slot lists and join `sweptYoungRegionList` (which feed `AllocateYoungOnSlot` re-compaction).
- **Stats** (`UpdateGCStats`, `:294`): young threshold = young used + min(predicted allocation over `PREDICT_WINDOW_MS` (20 ms) at current allocation speed, headroom to `youngCapacity * 2/3`).

Finalizers: only unmarked objects **outside old regions** are finalized (`ProcessFinalizers`, `:39`).

#### 2.3.2 `MixedCollector` — full/mixed GC in generational mode

`Heap/GenerationalGC/MixedCollector.h/.cpp`. Extends `YoungCollector` with:

- `IsTargetAddress` = any heap address; `IsTargetRegion` = true → traces young **and** old regions.
- `AssembleCandidates` → `AssembleMixedRegions` = young assembly + `AssembleOldRegions` (old from-regions prepared via `PrepareMixedFromRegionList`).
- Remembered-set handling differs: `EnumRememberedRoots` (`MixedCollector.cpp:102`) doesn't re-add slots as roots (everything is traced anyway) — it only **fixes** old tagged pointers found in RSet slots to their latest versions.
- Sweep: young sweep **plus** `OldSweepTask`s over `sweepableOldRegionList` (`MixedCollector.cpp:195-243`): zero-live old regions get `RememberSet::Instance().RemoveRegion(region)` + card-table reset before collection.
- `ClearDeadObjectRSetSlots` (`:228`): after sweeping old regions, any RSet slot inside a now-dead object's byte range is cleared, so the RSet never grows unboundedly.
- `ResetForwardingData` → `fwdTable.PrepareForwardTable(true)` (mixed run forwards old regions too; young-only runs pass `false`).
- Stats (`UpdateGCStats`, `:26`): mixed threshold = max(used + min(predicted, headroom to `maxCapacity * 2/3`), youngCapacity * 6/5 floor).

Finalizers: any unmarked object (young or old).

`ConcurrentSweep` runs *between* PostTrace and Preforward in `DoGarbageCollection` (`MixedCollector.cpp:47`), same position as the young collector's.

### 2.4 Tagged-pointer two-version algorithm (shared by WGC and generational)

The copying collectors run concurrently with mutators using a 1-bit alternating tag instead of a classic forwarding pointer:

- `RefField` (`ObjectModel/RefField.h:164`) packs `address:48 | isTagged:1 | tagID:1 | padding:14`.
- Each collector keeps `currentTagID` (`WCollector.cpp:16`), flipped at the end of every cycle (`FlipTagID`, `WCollector.cpp:568`).
- During enum/trace, every traced reference field is rewritten to `RefField(target, tagged=1, tagID=current)` (`GetAndTryTagRefField`, `WCollector.cpp:169`; `TryUntagRefField` restores raw pointers).
- A field whose tag ≠ current is an **old pointer**: its target object may already have been moved by the previous cycle; `FindLatestVersion`/`FindToVersion` routes it through the region forwarding info (`WCollector.cpp:110-149`, `YoungCollector.cpp:239` handles promoted regions via forwarding tables).
- Barrier reads in trace/forward phases resolve old pointers and forward current tagged pointers through the region route (`TraceBarrier::ReadReference`, `PreforwardBarrier::ReadReference`, `ForwardBarrier::ReadReference`); writes CAS-fix the field (`WCollector::TryUpdateRefFieldImpl<forward>`, `WCollector.cpp:56-107`).
- CAS failure semantics: a competing write can only produce another to-version or a newer tagged field, so failures are treated as "someone fixed it for us" (`WCollector.cpp:310`, `:318`).

This design means "collection of live objects" is simultaneously a *marking* pass and a *pointer-version-migration* pass.

### 2.5 Threshold/pace adaptation (WGC)

`TracingCollector::UpdateGCStats` (`TracingCollector.cpp`, tail): computes four candidate thresholds from live bytes, previous threshold, garbage ratio, and target size; weighted mean (low utilization: 1/4/2/1; high: 2/1/2/3, OHOS uses growth factor 1.8 below 25% utilization), capped at 98% max capacity and `gcParam.gcThreshold`; also derives the adaptive min-interval for `GC_REASON_HEU` (`g_gcRequests[GC_REASON_HEU].SetMinInterval`). Additionally, when live bytes exceed ⅔ of heap size, async allocation is disabled (`space.EnableAsyncAllocation(false)`).

Allocation pacing itself: `RegionManager::RequestForRegion` (`RegionManager.cpp:1143`) throttles region requests by `heuAllocRate = cos(π/2 · allocated/available) · collectionRate` vs. the configured `allocationRate`, sleeping up to `allocationWaitTime` before conceding.

---

## 3. How live objects are found (marking)

### 3.1 Root enumeration (`DoEnumeration`, `TracingCollector.cpp:372`)

Two stacks: `workStack` (GC roots) and `foreignRootsSet` (export roots). `EnumAllCommonRoots` (`TracingCollector.cpp`) fans out over the thread pool:

1. **Static roots** — `StaticRootTable` (`TracingCollector.h:78`), registered by compiled units via `Heap::RegisterStaticRoots`; visited under `gcRootsLock` with a per-run de-dup set (`TracingCollector.cpp:50`).
2. **Concurrency-model roots** — cj futures etc., `Runtime::Current().GetConcurrencyModel().VisitGCRoots`.
3. **Finalizer-processor roots** — `FinalizerProcessor::VisitGCRoots` (`Heap/Collector/FinalizerProcessor.h:43`): *finalizables* and *workingFinalizables* are roots so that objects queued for finalization don't die mid-flight (the objects themselves, `finalizers`, are not roots — they are candidates; see resurrection).
4. **Resurrected export + cycle-ref work stacks** — `EnumAllSurrectedExportRoots`.
5. **Mutator roots** — `MergeMutatorRoots` (`TracingCollector.cpp:360`): under the mutator-management write lock, every thread's `AllocBuffer::MergeRoots` (`Heap/Allocator/AllocBuffer.h:54`) drains the stack roots pushed by the mutator's enum-phase handler.

Stack roots themselves: `Mutator::GcPhaseEnum` (`Mutator.cpp:606`) — when a mutator transitions into ENUM phase it walks its own stack via stack maps (`StackManager::VisitStackRoots` using `StackMapBuilder`/`RootMap`, `TracingCollector::VisitStackRoots`), pushing each heap reference into `AllocBuffer::stackRoots` and walking object children reachable purely from stack values. Register roots come from the stackmap's register table (`rootMap.VisitRegRoots`).

Generational additions: remembered-set slots (`YoungCollector::EnumRememberedRoots`) and local RSet merge (`Mutator::GcPhaseEnum` at `GC_PHASE_GENERATION_ENUM`, `Mutator.cpp:636-642`).

Foreign/export roots (`EnumAllExportRoots` → `ExportRootTable::VisitGCRoots`, `TracingCollector.h:108`) go into the separate foreign set traced by `ExportRootsTracingWork`, which uses DFS (`DFSTraceExportObject`) and records foreign-object back-edges for cycle resolution.

Every root is also *tagged*: `EnumRefFieldRoot`/`EnumAndTagRawRoot` CAS the field to `(target, tagged=1, currentTagID)` (WGC: `WCollector.cpp:133-204`; young: `YoungCollector.cpp:90-176`; mixed: `MixedCollector.cpp`).

### 3.2 Marking (`DoTracing`, `TracingCollector.cpp:454`)

- Work distribution: `TracingImpl` splits the root set into `ConcurrentMarkingWork` tasks (`MAX_MARKING_WORK_SIZE=16` → give half the stack to the pool; `MIN_MARKING_WORK_SIZE=8` → give ⅛ only if workers are idle; `TracingCollector.cpp:139-186`).
- Mark algorithm per object (`ConcurrentMarkingWork::Execute`): pop → `collector.MarkObject(obj)` → if newly marked, either weak-ref handling or `TraceObjectRefFields` (walks each `RefField`, resolving tagged pointers and pushing unmarked targets; WGC version `WCollector.cpp:207`, tags the field with the current tag ID).
- `PrefetchQueue` (`TracingCollector.h:41`): 32-entry ring that `__builtin_prefetch`es object headers `MARK_PREFETCH_DISTANCE=16` ahead.
- Mark bits: per-region `RegionInfo` metadata (`Heap/Allocator/RegionInfo.h:455-583`) holds lazily-allocated `LiveInfo` with three `RegionBitmap`s — **mark**, **resurrect**, **enqueue** (1 bit per 8 bytes, `kMarkedBytesPerBit=8`, `Heap/Collector/LiveInfo.h`). Large regions use a single region-level flag instead of a bitmap. `MarkBits` does the head-word `fetch_or` fast path with partitioned `partLiveBytes` counters to make live-byte counting cheap.
- SATB re-mark (`MarkSatbBuffer`, `TracingCollector.cpp:517`): loop of `visitSatbObj` (drain per-mutator SATB nodes + retired nodes) → trace newly found objects → transition to `GC_PHASE_CLEAR_SATB_BUFFER` and re-check → repeat until the buffer stays empty. Guard: if it exceeds 10 iterations *and* 100 ms, it forces a `ScopedStopTheWorld` and finishes the remark under STW.
- Extern/cycle detection: `FindUselessExternObjects` marks surviving members of `discoveredExternObjects`; non-surviving export groups go to `cycleRefWorkStack` for `ResolveCycleRef`.
- Finalizer resurrection (`DoResurrection`, `TracingCollector.cpp:560`): visits pending finalizers (`FinalizerProcessor::VisitFinalizers`); unmarked finalizable objects are **resurrected** — set in the resurrect bitmap (`ResurrectObject`), their children traced into the work stack. So an object with a finalizer survives one extra cycle; the next GC that sees it still unmarked finalizes it for real. (Live = mark ∪ resurrect bits: `RegionSpace::IsSurvivedObject`.)
- Weak references: live weakrefs recorded in `WeakRefBuffer` during mark (`TracingCollector.cpp:170`); `PostTrace` clears dead referents (`SatbBuffer.h:305`).

Concurrency invariants: marking is concurrent under the trace barrier; `MarkSatbBuffer` closes the SATB race; the subsequent `PostTrace` → `Preforward` sequence runs under a `ScopedLightSync` so that the forwarding phase starts from a consistent world, then runs concurrently with the preforward/forward read barriers.

### 3.3 Reclamation

- Empty from-regions and swept garbage regions are collected (`CollectRegion` → garbage cache → `freeRegionManager`), large regions above `LARGE_OBJECT_RELEASE_THRESHOLD` are returned to the OS (`ReleaseRegion`, `RegionManager.cpp:560`).
- Non-empty from-regions are either copied (region route) or exempted (swept in place — they keep their garbage as *floating garbage* until a later cycle).
- Pinned regions reclaim free slots into `freePinnedSlotLists` (`CollectPinnedGarbage`, `RegionManager.cpp:860`).
- `ReclaimGarbageMemory`/`TryReclaimGarbageMemory` (`RegionSpace.h`) decide when to actually unmap/return pages, based on `heapUtilization` and usage since the last GC.
- `FinalizerProcessor::NotifyToReclaimGarbage` makes the finalizer thread also run heap maintenance (`ReclaimHeapGarbage`, `FeedHungryBuffers`).

---

## 4. What triggers collection

### 4.1 Request plumbing

`Collector::RequestGC(reason, async)` (`Collector.cpp:55`) → `CollectorResources::RequestGC` (`CollectorResources.cpp:171`):

1. `IsGCActive()` gate (`Heap::IsGCEnabled()` && not hot-update-disabled).
2. Record `prevRequestTime`; `collectorProxy.ShouldIgnoreRequest(request)` → `GCRequest::ShouldBeIgnored` (`GcRequest.cpp:38`):
   - `HEU`/`NATIVE`: ignored if a GC finished less than their min-interval ago (`LONG_MIN_HEU_GC_INTERVAL_NS = 200 ms`, `MIN_ASYNC_GC_INTERVAL_NS = 1 s`);
   - `OOM`/`FORCE`/`HEU_EAGER`: ignored only if *this same request* fired within its own interval;
   - `MIXED` and everything else: never ignored.
3. Ignored + sync request → `PostIgnoredGcRequest`: still wait for the already-running GC.
4. `async` → `RequestAsyncGC`: push onto the lockless priority queue (`LocklessTaskQueue::Push`, one bit per priority; terminate/timeout tasks override lower-priority tasks, `TaskQueue.h:130`) and notify the GC main thread.
5. sync → `RequestGCAndWait` (`CollectorResources.cpp:139`): enter saferegion, enqueue into the ordered sync queue with dedup filter (same reason already queued → piggyback on its index), block on `gcFinishedCondVar` until `finishedGcIndex` passes the assigned index.

The GC main thread (`GCMainThreadEntry`, thread name `gc-main-thread`) runs `TaskQueue::DrainTaskQueue` (`TaskQueue.h:266`): sync tasks first, then async; `Dequeue` waits 1 s at a time and injects a `TASK_TYPE_TIMEOUT_GC` when it times out (the backup-GC timer).

`GCExecutor::Execute` (`TaskQueue.cpp:15`):
- `TASK_TYPE_INVOKE_GC` → `SetPrevGCStartTime`, `collectorProxy->RunGarbageCollection(taskIndex, reason)`, `SetPrevGCFinishTime`.
- `TASK_TYPE_TIMEOUT_GC` → backup GC **only if** `now - prevGcStartTime > backupGCInterval` (default 240 s, `CangjieRuntimeApi.cpp:251`, tunable `cjBackupGCInterval`, `CjScheduler.cpp:644`).
- Heap dump task types (`DUMP_HEAP`, `DUMP_HEAP_OOM` on OOM via `ExceptionManager`, `DUMP_HEAP_IDE` for OHOS profiler) share the same thread.
- `TASK_TYPE_TERMINATE_GC` → `return false` stops the loop.

### 4.2 Reasons and their sources

| `GCReason` | Trigger sites | Sync/Async default | Collector picked |
|---|---|---|---|
| `GC_REASON_USER` | `MCC_InvokeGCImpl(sync)` (`CompilerCalls.cpp:527`, the managed `System.gc()`-equivalent); `CJ_MRT_ForceFullGC` (`CangjieRuntimeApi.cpp:898`) | sync=false, concurrent | `mixedCollector` (generational) / `wCollector` (WGC) |
| `GC_REASON_OOM` | `RegionSpace::ShouldRetryAllocation` after 5 failed attempts (`RegionSpace.cpp:50`) | sync, stop-the-world mark | `mixedCollector` |
| `GC_REASON_BACKUP` | 1 s task-queue timeout + `backupGCInterval` elapsed (`TaskQueue.cpp:27`) | sync | `mixedCollector` |
| `GC_REASON_HEU` | (a) `RegionManager::CheckGC` when `allocated ≥ heapThreshold` on any region request (`RegionManager.cpp:706`); (b) allocation retry path (`RegionSpace.cpp:43`); (c) `MixedRegionManager::CheckGC` young threshold crossed below max-young (`MixedRegionManager.h:194`); (d) profiler agent (`Inspector/ProfilerAgentImpl.cpp:91`) | async, concurrent, 200 ms min interval | `youngCollector` |
| `GC_REASON_HEU_EAGER` | young threshold crossed **above** max-young (heap nearly full of young objects) — cannot be ignored | async | `youngCollector` |
| `GC_REASON_MIXED` | `MixedRegionManager::CheckGC` whole-heap used ≥ mixed threshold, below max-mixed | async, concurrent, 200 ms min interval | `mixedCollector` |
| `GC_REASON_FORCE` | mixed threshold crossed **above** max-mixed (`2/3` of max capacity) | sync | `mixedCollector` |
| `GC_REASON_NATIVE`, `GC_REASON_NATIVE_SYNC` | Native-Allocation-Registry paths (declared in `GcRequest.h:31-33`; 1 s async / sync-min-wait policies) | async / sync | `youngCollector` (default arm) |

Collector dispatch — `CollectorProxy::RunGarbageCollection` (`CollectorProxy.cpp:34`): WGC mode always uses `wCollector`; generational mode maps USER/BACKUP/MIXED/OOM/FORCE → `mixedCollector`, HEU (and default) → `youngCollector`.

### 4.3 Allocation-path triggers in detail

`RegionSpace::Allocate` (`RegionSpace.cpp:60`) loops `TryAllocateOnce` and on repeated failure calls `ShouldRetryAllocation` (`RegionSpace.cpp:30`) with thresholds `RESCHEDULE=3`, `TRIGGER_OOM=5`:

- ≤3 tries: `CJThreadResched()` and retry.
- 4th try: if a GC is running, wait for it in a saferegion; else request `GC_REASON_HEU` (sync — the allocating thread then waits for GC to free space).
- 5th try: request `GC_REASON_OOM` (sync STW GC) and wait; if allocation still fails afterwards → `ExceptionManager::OutOfMemory()`.

Generational pacing (`MixedRegionManager::CheckGC`, `MixedRegionManager.h:171`) runs on every region take (`TakeRegion` → `CheckGC`, `RegionManager.cpp:710`):

- `mixedReached = usedRegionSize ≥ mixedThreshold` → `GC_REASON_MIXED` (async) or `GC_REASON_FORCE` (sync) if `used ≥ maxCapacity·2/3`.
- else `youngReached = youngUsedSize ≥ youngThreshold` → `GC_REASON_HEU` or `GC_REASON_HEU_EAGER` if `youngUsed ≥ youngCapacity·2/3`.
- Young capacity = `min(maxCapacity/3, 512 MB)`; thresholds retuned after each GC from allocation speed (§2.3.1/§2.3.2/§2.5).

During a running generational GC, mutators pay "allocation assist": `MixedRegionSpace::TryAllocateOnce` (`MixedRegionSpace.h`) accumulates allocation bytes per thread and every `assistBaseInterval=16 KB` (shrinking as the budget `min(max(gcStartAllocated/2, 100 MB), 256 MB)` is consumed) executes one GC thread-pool task — allocation-funded parallel marking.

### 4.4 Mutator-side participation

- Safepoints: `SetSafepointActive(true)` during phase transitions makes compiled code poll the safepoint page; `Mutator::HandleSuspensionRequest` (`Mutator.cpp:201`) performs phase transitions, sync waits, preemption.
- Enum-phase work: on transition into `*_ENUM`, each mutator enumerates its own stack (§3.1) — the reason stack enumeration is cheap for the GC thread.
- SATB: `EnumBarrier/TraceBarrier::WriteReference` remember the overwritten value and the new value into the mutator's `SatbBuffer::Node` (`Mutator::RememberObjectImpl`, `Mutator.h:553`; enqueue filter `SatbBuffer::ShouldEnqueue` skips already-marked/trace-region objects, `SatbBuffer.cpp:19`).
- RSet (generational): `Generation*Barrier` write paths call `RSetUpdateBarrier::WriteReference`; old→young writes are recorded per-region (`Mutator::RecordLocalRSetSlot`, `Mutator.cpp:655`).
- New-object marking: `BaseObject::OnFinalizerCreated` → `collector.MarkNewObject` (`Common/BaseObject.cpp:155`); `WCollector::MarkNewObject` (`WCollector.cpp:575`) immediately marks finalizer objects allocated during enum/trace/clear-SATB so they can't be seen as dead.

---

## 5. End-to-end sequence (generational young GC)

```mermaid
sequenceDiagram
    participant M as Mutator threads
    participant RM as RegionManager/MixedRegionManager
    participant GT as GC main thread (gc-main-thread)
    participant YC as YoungCollector (on GT + pool)

    M->>RM: Allocate → TakeRegion → CheckGC
    RM->>GT: RequestGC(GC_REASON_HEU, async)
    Note over GT: EnqueueAsync (lockless priority queue)
    GT->>YC: RunGarbageCollection (CopyCollector driver)
    YC->>YC: PreGarbageCollection (SATB init, stats, pool sizing)
    YC->>M: TransitionAllMutatorsTo(GENERATION_ENUM) — barrier: GenerationEnumBarrier
    M-->>YC: each mutator enumerates own stack, pushes AllocBuffer roots
    YC->>YC: Enum roots (static, futures, finalizers, RSet) + tag fields
    YC->>M: Transition to GENERATION_TRACE — GenerationTraceBarrier (SATB)
    YC->>YC: Parallel mark (ConcurrentMarkingWork), age++, promote-tag regions
    YC->>YC: MarkSatbBuffer remark (→ CLEAR_SATB_BUFFER), resurrection, weakrefs
    YC->>M: Transition to GENERATION_POST_TRACE
    YC->>YC: Exempt/promote/copy classify, RSet cleanup, reset fwd tables
    YC->>YC: ConcurrentSweep (SweepTask per 10 regions)
    YC->>M: ScopedLightSync STW → GENERATION_PREFORWARD, resume
    YC->>YC: Preforward raw/export/finalizer roots (fix to-versions)
    YC->>M: Transition to GENERATION_FORWARD — GenerationForwardBarrier
    YC->>YC: ForwardFromSpace: region copies + promotions (object/region)
    YC->>YC: FlipTagID, GC_PHASE_GENERATION_IDLE, CollectSmallSpace
    YC->>YC: UpdateGCStats (retune young threshold)
    YC->>GT: PostGarbageCollection → NotifyGCFinished
    GT-->>M: sync waiters wake; async requesters observe isGcStarted=false
```

---

## 6. Quick facts worth remembering

- **Two GC modes, one code base**: WGC (`cjEnableGC=1`, default) = whole-heap `WCollector`; `cjEnableGC=2` = generational with `YoungCollector` + `MixedCollector` over `MixedRegionSpace`.
- **Everything is region-based**: allocation, marking, promotion, copy-vs-sweep decisions are all per-region (`RegionInfo` metadata + `LiveInfo` bitmaps + route info). There is no object-level forwarding pointer for region copies — routing is computed from the mark bitmap's pre-live-byte counts (`CopyRouteInfo::GetRoute`), except promoted regions which use per-region `ObjectForwardingTable`s.
- **Copy or sweep, decided per region**: live fraction above `exemptedRegionThreshold` (or containing raw-pointer objects) ⇒ sweep in place (floating garbage retained); otherwise ⇒ copy live objects out and recycle the whole region.
- **SATB + 1-bit tag ID + light sync** are the three concurrency primitives; the heavy STW moments are enum (mutators self-enumerate), preforward entry, and the SATB-remark timeout fallback.
- **All triggers funnel through one queue**: every GC (user, heuristic, OOM, backup, mixed, force, native) is a `GCExecutor` task on `gc-main-thread`; the only difference is priority, sync-vs-async wait, throttling, and which collector the proxy picks.
