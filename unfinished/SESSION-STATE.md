# Continuation status (2026-11-21)

## Live work — 2026-11-21 14:41 +03:00

Local-finalizer lifetime support is **in progress and uncommitted** in the
cangjit worktree. A new CHIR frontier analysis follows the native LLVM pass in
`third_party/llvmPatch.diff` and emits registration plus after-expression and
normal/exceptional edge removals. Definitely local class references are kept
out of movable-heap stack-map roots; maybe-local references remain guarded.

Native and JIT returned 42 for straight-line finalization, both branch paths,
loop iterations, an interface cast alias, a throwing method caught in the same
function, GC inside a finalizer, and a separate live heap object across
finalization. A throwing constructor returned 0 in both modes. Two finalizers
at the same frontier ran in order 21 in both modes. With
`cjLocalRegionMaxSize=1KB`, a failed local allocation was caught and no
finalizer ran (native and JIT returned 42). The latest compiler build passed.
Stored/escaped aliases, stack-growth interactions and less common exceptional
edges still need verification. The current analysis leaves stored references
registered until region end; native LLVM can trace some stack slots, so this is
not yet a complete equivalence claim.

The dashboard task board is `tasks.json`; update it whenever this status changes.
The older finalizer-rejection statement below describes the last committed
checkpoint, not the current uncommitted work.

The saved patch below was committed in cangjit as `9f6ae287`; subsequent local
commits are `1624147930`, `f332de5f67`, `1e59a2ece6`, `a6374a8bd1`,
`69cb8dff22`, `ebe49b5649`, `292122b613`, `5805d63963`, `c81baa391c`, and `5d860b5b39`.
Pushing `jit_dev` failed: GitHub denied SSH identity `arthur100500` access to
`arthur-alekseev-itmo/cangjit.git`. Apply the backups on `9f6ae287` in order:
`jit-continuation.patch`, `jit-generic-typeinfo.patch`, `jit-outer-typeinfo.patch`,
`jit-concrete-typeinfo.patch`, `jit-generic-allocation.patch`,
`jit-generic-instanceof.patch`, `jit-any-instanceof.patch`,
`jit-global-guard.patch`, `jit-static-init-guard.patch`, and
`jit-finalizer-diagnostic.patch`.
Code changes are confined to `src/JIT/**`. The
knowledge-base instructions were merged into `AGENTS.md`; cangjit's root
`AGENTS.md` links to it.

## Completed and exercised

- Removed the unused sidecar requirement; managed startup runs `main`.
- Class allocation, typed catches, cross-frame unwinding and `finally` execute.
  Tests returned 42 for direct and cross-frame catches, 7 for a derived
  exception caught by its base, and 10 for nested cleanup and rethrow.
- Checked arithmetic creates the native factory's exact message and throws the
  returned exception. Normal addition, overflow, division by zero, overshift,
  narrowing casts and same-frame unwinding were exercised. GDB observed the
  factory inputs `add` and `The result would be greater than Int8.Max.`.
- Unit-returning calls and their lazy stubs work with `cjStackGrow=1`; forcing
  `cjStackGrow=0` aborts while loading this SDK's incompatible std.core.
- On-demand standard-package loading runs `Mutex()` and imported methods.
  Package-load failure recovery and repeated loading were exercised.
- Override ABI classification follows `OverrideSrcFuncType`. Scalar Boolean
  and narrow integer call results are normalized; `tryLock()`, a local Bool
  function, and an Int8-returning function were exercised.
- Virtual instance dispatch through interfaces and classes works for the
  exercised native types; a native exception propagates through `TryInvoke`.
  GDB confirmed the class vtable branch. A receiver survived explicit heavy GC.
- Static interface dispatch, generic TypeInfo forwarding, a stack-passed
  TypeInfo argument, and a native exception through static dispatch all returned
  42. A separately compiled native package and native executable gave the same
  result as JIT execution.
- Dynamic TypeInfo construction now handles nested `Array<T>`, tuple and closure
  types using native templates. A native generic `is T` check distinguished
  `Array<Int64>` from `Array<Bool>`; closure TypeInfo identity also matched.
  Generic interface and static-interface dispatch matched native exit 42.
- Generic extension methods now recover outer type parameters through the
  runtime TypeInfo argument path. An extension of `C<Array<T>>` correctly
  distinguished `T = Int64` and `T = Bool` via a native `is T` check.
- Concrete generic TypeInfos absent from the runtime registry are materialized
  from their templates. An initially unseen `C<Bool>` was accepted by a native
  `is T` check after a native generic factory created the matching object.
- Generic class `is` checks resolve their target TypeInfo at runtime. A native
  and JIT comparison both distinguished `C<Int64>` from `C<Bool>`.
- Generic `Any is T` checks match native behavior for boxed scalar and tuple
  values, including positive and negative tuple covariance checks.
- Concrete and dynamic generic class allocation derive size from runtime
  TypeInfo. Objects with `?T` fields survived explicit heavy GC for `Bool` and
  `(Int64, Int64)` instantiations; native and JIT results were 42.
- A shutdown-time GC crash was observed in `TypeInfo::IsArrayType`. [INFERENCE]
  unloading libraries before stopping the collector could invalidate TypeInfos.
  Owned-runtime shutdown now finishes the runtime first; the heavy-GC fixture
  passed 10/10 shutdowns afterward.
- Object headers are masked to remove runtime state bits before TypeInfo use.
  Pinned allocation size is derived from the runtime TypeInfo, not a constant.

## Current work and remaining gaps

- Nested `This` in source type arguments is rejected by the language; whether
  generated CHIR can contain that case remains unverified.
- Virtual dispatch code is in `CompileInvoke.{h,cpp}`. Interface, class and
  static interface paths have been exercised; auto-environment dispatch and
  aggregate ABI remain unverified.
- JIT-defined package TypeInfo and package-local global storage/initialization
  are still unavailable. References to package-local globals now fail with an
  explicit diagnostic rather than attempting to resolve obsolete sidecar slots.
  Nonliteral global initializer functions, including compiler-generated class
  static initializers, are rejected before main instead of silently skipping
  side effects. Native entry runs the package initializer first;
  preinitialization needs loader metadata and managed global references need
  GC static roots.
- Local finalizers remain unsupported. A native package with
  `public exclave init(this @local!)` and `~init(this @local!)` was compiled
  with `--experimental --enable-local-mode`; a local allocation finalized
  before its region ended (native result 42), while JIT rejects it with the
  explicit diagnostic `local finalizer lifetime handling is not supported`.
  Native x86-64 emitted `CJ_MCC_NewLocalObject`,
  `CJ_MCC_AddLocalFinalizer`, the constructor, `CJ_MCC_RemoveLocalFinalizer`,
  then `CJ_MCC_EndLocalRegion`. The runtime's remove operation executes the
  finalizer. Correct frontier and alias analysis must cover branches and
  exceptional edges; merely waiting for `EndRegion` can change behavior.
- Arbitrary external package discovery remains unresolved. Do not replace
  missing runtime metadata with fake metadata.
- The object-layout, exception-message, package-loading and dispatch
  decisions are in `arch/jit-object-allocation.md`.
- Build from the parent project root with `./cjb.sh cjc` in the Nix shell.
  `cjb.sh` deletes `logs/`; back up existing logs first. Original logs from
  this continuation were saved at `/tmp/cangjit-logs.Ow9qSo/logs`.

The following section is the **historical** handoff from the previous machine;
its status claims and proposed no-message overflow helpers are superseded by
the continuation above.

# Cangjie JIT Exception Handling — Session State (2026-11-20)

Continuation point for another PC. Read AGENTS.md in repo root for change-pipeline
gates (Gate 1 class contracts, Gate 2 code shape, approval before code).

## HARD CONSTRAINT (user, latest, supersedes everything else)

**Only `src/JIT/**` may be modified. All non-JIT edits are DISALLOWED.**

During this session agents had made CodeGen/Driver/FrontendTool/CHIR changes for a
"native metadata sidecar" approach. On user interjection ALL of those were reverted:

    git checkout -- src/CodeGen src/CHIR src/Driver src/FrontendTool include/cangjie/CodeGen include/cangjie/Driver

Current diff (verified): ONLY `src/JIT/**` files modified + untracked new JIT files.
Baseline commit: 1fe13078 "feat(jit): Change lazy calls type".

## GOAL

Binary compatibility for exception handling between JIT-compiled Cangjie code and
the native runtime (Linux x86_64), WITHOUT patching the runtime
(../cangjie_runtime is read-only reference).

## KEY RUNTIME FACTS (verified in ../cangjie_runtime source + nm/objdump of
$CANGJIE_HOME/runtime/lib/linux_x86_64_cjnative/*.so)

### Frame discovery (no registration API needed!)
- `FrameInfo::GetFuncStartPC()` (runtime/src/Common/StackType.h:299-324): on x86-64
  reads `*(uint64_t*)(fa-1) - 9` — i.e. function must push start_pc marker at [rbp-8]
  such that the value stored equals `entry+9`. Achieved by prologue:
  `push rbp; mov rbp,rsp; call next; next:` (call pushes entry+9... wait, the call
  pushes return address = entry+9 where entry is after the 4-byte prefix; see
  CompileFunction.cpp MakePrologue comments). START_PC_OFFSET_IN_STACK=9 on x86-64.
- `MFuncDesc::GetFuncDesc(startPC)` (MFuncdesc.inline.h:47): reads 32-bit RELATIVE
  descriptor pointer at `startPC - 4` (DataRefOffset32: `this + refOffset`).
  So each JIT function has a 4-byte prefix slot at entry-4 holding
  `descriptorAddress - (entry-4)`. CompileFunction.cpp emits `embedUInt32(0)` at
  offset 0 and patches it after allocation.
- MFuncDesc layout (28 bytes on Linux): stackMap rel32, codeSize u32, name u32,
  directory u32, filename u32, dictOffsets u32, ehTable rel32. All "name/dir/file"
  are U32 offsets into a string dictionary; `GetStringFromDict` uses
  FastULEBDecode — strings stored ULEB-compressed, dictionary entries comma-joined,
  each string preceded by its byte in the dict table. See JitMetadataBuilder.cpp
  implementation which already encodes this correctly (dictionary: count u32,
  totalSize u32, then per-string offset entries then raw bytes; stack trace format
  flag = 1 byte = 1, stored before dict at result[28..31]).

### EH (Itanium-style landingpad, but Cangjie runtime walks frames itself)
- Throw: `CJ_MCC_ThrowException(ExceptionRef)` -> ExceptionManager::ThrowException ->
  builds EHStackInfo (walks rbp chain), finds landing pad via EHTable scan
  (LSDA format: lpStartEncoding, ttypeEncoding (supports 0=absptr, 3=udata4,
  155/156 pcrel sdata4/8), classInfoOffset ULEB, callSiteEncoding, callSiteTableLen
  ULEB, call sites (start,len,landingPad,action all ULEB, landingPad relative to
  func start), action table: typeIndex u8 + sleb offset chains; typeIndex indexes
  BACKWARD from exceptionTypeStart: `exceptionTypeStart - typeIndex*sizeof(ptr)`),
  then rewrites lastRuntimeFrame return address to RestoreContextForEH and longjmps.
  MatchActionTable: catchType==nullptr means catch-all; else
  `exceptionRef->IsSubType(*(TypeInfo*)catchType)`.
- `CJ_MCC_GetExceptionWrapper()` returns wrapper ptr; `CJ_MCC_PostThrowException(wrapper)`
  = BeginCatch -> returns ExceptionRef and clears wrapper. GET_EXCEPTION CHIR op ->
  wrapper; BEGIN_CATCH intrinsic -> PostThrowException.
- Catch clauses: CHIR landing-pad Block has GetExceptions() (vector<ClassType*>);
  empty => catch-all (null clause), typed => TypeInfo pointers needed.
- Exception allocation: `CJ_MCC_NewObject(TypeInfo*, uint32 size)` where
  size = AlignUp(TypeInfo::GetInstanceSize(),8) + 8 (DCHECK in CompilerCalls.cpp:192).
  GetInstanceSize via exported mangled symbol
  `_ZNK12MapleRuntime8TypeInfo15GetInstanceSizeEv` (returns U32).
- Type lookup: `CJ_MCC_GetTypeByMangledName(const char*)` — only finds types in
  LOADED Cangjie packages (JIT-package types NOT findable; this killed the
  JIT-defined-class typed-catch path without the sidecar).
- Managed transitions: `CJ_MCC_C2NStub` (managed->native, exported; caller pushes
  callee addr + cpStackSize(0) then `call` it; stub consumes both words),
  `CJ_MCC_N2CStub` (native->managed), `MRT_EnterSaferegion/MRT_LeaveSaferegion`
  exported, `ExecuteCangjieStub`, `RunCJTask/GetTaskRet/ReleaseHandle` for tasks.
- Stack maps (compressed): header = varint stackSize, varint format(0),
  varint calleeSavedBitmap (bits RBX,R12..R15 order per
  EHFrameInfo::RestoreToCallerContext CALLEE_SAVE_NUMBERS=5, offsets from rbp
  SLOT_SIZE_FACTOR=-8), per-saved-reg varint offset, varint numStackMapItems,
  then varint maxbits for regIdx/slotIdx/lineIdx/derivedIdx (+spReg/spSlot when
  stackGrow ON), padding, then per item: PC u32 + bitfields. Then reg table,
  slot table (baseOffset i32 + bitmap, slots are RBP-relative NEGATIVE multiples
  of 8, descending order required), line table, derived pairs. Runtime reader:
  StackMapTable.h (mode-dependent when cjStackGrow=1: extra spReg/spSlot fields
  per item + per-row bits). GC slot roots: bias = -8 per slot index from base
  (SlotRoot.h BYTES_PER_SLOT=-8, BIAS_COEF=1; base = frame rbp).
- Process-wide stackGrowConfig: from env `cjStackGrow` (0/1) or first loaded CjFile
  metadata. JIT must match the runtime's mode. Standalone default: SDK build
  flag CANGJIE_DISABLE_STACK_GROW_FEATURE maps to CANGJIE_JIT_NO_STACK_GROWTH
  define; X86_64Compiler::Compile sets env cjStackGrow accordingly before runtime
  init (StackManager::InitStackGrowConfig reads env AT RUNTIME INIT).

## ARCHITECTURE DELIVERED (all under src/JIT, builds clean, `./build.sh` passes)

New files (untracked):
- src/JIT/X86_64/JitMetadataBuilder.{h,cpp} — encodes MFuncDesc + compressed
  stack map + LSDA + string dict; Build(metadataAddr, codeAddr, codeSize) returns
  {metadataBytes, prefix4bytes}. Handles stackGrowth mode in ctor.
- src/JIT/X86_64/JitRuntimeBindings.{h,cpp} — dlopen runtime, resolve symbols,
  InitCJRuntime(owner mode)/attach, LoadCJLibraryWithInit for native libs,
  RunCJTask lifecycle. RuntimeConfig = tuple<runtimePath, vector<nativeLibs>,
  RuntimeParam*, owner, stackGrowth, sidecarPath, bindSidecarFn> — NOTE sidecar
  parts are now DEAD (sidecar reverted); should be simplified back or left unused.
- src/JIT/X86_64/RegisterAllocation/SafepointLiveness.{h,cpp} —
  ComputeSafepointLiveness(function, numeration, allocation, expression) ->
  {gcRoots, stackInteriorRoots, derivedRoots} or error string. Live-before map
  incl. exceptional successors, definite-initialization check.
- src/JIT/X86_64/RegisterAllocation/LocalFinalizerFrontier.h — STUB HEADER ONLY
  (agent died on usage limit; local-finalizer frontier analysis NOT implemented;
  CompileObject rejects local finalizers accordingly). Probably delete or finish.
- src/JIT/X86_64/Compilers/Expression/CompileObject.{h,cpp} — CompileObjectAllocate
  (Allocate/TryAllocate), CompileLocalRegion (StartRegion/EndRegion). Handles
  finalizer/weakref/pinned/local allocator symbol selection, AutoEnv method slot
  init via CompileFunctionStub. NOT YET DISPATCHED from CompileBlock (see TODO).
- include/cangjie/JIT/JitSymbols.h — JitFunctionSlotName/JitGlobalSlotName hex
  encoding (was for sidecar; now only used by dead sidecar paths in
  X86_64Compiler/MemoryUtils — needs cleanup).

Modified files (src/JIT only):
- CompileFunction.{h,cpp}: 4-byte descriptor prefix, marker prologue
  (push rbp; mov rbp,rsp; call marker), metadata co-allocated in same asmjit
  allocation after code (align 4, embed, then patch via JitAllocator dual-map
  write), RecordFrame, sret/float return support in epilogue, native param
  materialization incl. XMM.
- CompileFunctionStub.cpp: native-callable resolver stub w/ managed frame
  marker, saves GP+XMM args, CJ_MCC_C2NStub transition for materialization,
  GC slot roots for ref args in saved regs/stack, safepoint metadata. Supports
  scalar + Ref<Class/RawArray/Box> args, method/generic hidden TypeInfos via
  GetNativeParameterPlacement; still REJECTS: sret (incl Unit/Nothing returns!),
  basePointerLocations, override ABI, C funcs.
- CompileBlock.cpp: dispatch for TRY_APPLY/RAISE_EXCEPTION/GET_EXCEPTION/
  BEGIN_CATCH(+TRY_INTRINSIC), checked-arith binary/unary dispatch w/ unwind
  successors. ALLOCATE still routes to old scalar CompileAllocate; START_REGION/
  END_REGION/TRY_ALLOCATE/INSTANCE_OF NOT dispatched (TODO).
- CompileApply.cpp: TRY_APPLY unwind edges via per-call trampolines
  (EmitExceptionLanding restores rsp=rbp-frameSize then jmps landing block).
- CompileBinaryExpression / CompileUnaryExpression / CompileNumericCast:
  THROWING overflow via CJ_JIT_Throw_* sidecar helpers — **BROKEN NOW**: those
  symbols lived in the reverted sidecar; EmitArithmeticException resolves
  "CJ_JIT_Throw_Add" etc. which no longer exist => will fail UnresolvedSymbol
  at runtime-bind time. MUST replace: either call std-core `rt$ThrowOverflowException`
  / `rt$ThrowArithmeticException` (exported! objdump-verified: no args, no sret,
  plain native frames) or construct exceptions manually. NOTE earlier finding:
  rt$Throw* use native exception_tail_helper with operation-specific messages —
  GOOD for compat (native messages), better than no-arg ctor path that was
  rejected for changing observable messages. Cast-bound-specific messages
  ("The result would be less than Int64.Min.") have no direct rt$ helper;
  options: rt$CreateOverflowException_msg needs a Cangjie String (hard) —
  simplest correct: keep Reject for THROWING casts, or use rt$ThrowOverflowException
  (generic message, document deviation).
- FunctionContext.{h,cpp}: owns JitMetadataBuilder, RecordSafepoint (drops
  stack-interior roots when stackGrowth off), EmitExceptionLanding (typed clauses
  via CJ_MCC_GetTypeByMangledName at COMPILE time — requires type already loaded),
  frame size = slots+1 (marker slot) — GetSlotOffset(slot) = -(slot+2)*8 since
  marker occupies [rbp-8] and first value slot at [rbp-16].
- GlobalContext.h: ConfigureRuntime/GetRuntimeBindings/IsStackGrowthEnabled,
  dtor calls Shutdown.
- SystemVCallingConvention.{h,cpp}: GetNativeParameterPlacement (full native ABI:
  sret, basePointerLocations, genericTypeInfoLocations, outerTypeInfoLocation,
  thisTypeInfoLocation, abiParameterTypes/abiReturnType) + strict
  GetParameterPlacement wrapper rejecting supplementary ABI.
- MemoryUtils.{h,cpp}: float load/store via XMM, Move, global-var resolution —
  CURRENTLY references JitGlobalSlotName (sidecar) for non-imported globals =>
  BROKEN after revert; imported vars resolve by raw symbol name via
  FindCJSymbol/dlsym (works for loaded native packages). For package-local
  globals without sidecar there is NO storage — must reject or allocate JIT-side.
- Types.h: ParameterPlacement extended (returnLocation, indirectReturn,
  abiParameterTypes, abiReturnType, sretLocation, basePointerLocations,
  genericTypeInfoLocations, outerTypeInfoLocation, thisTypeInfoLocation).
- RegisterUtils/StackFrameUtils: XMM arg regs, slot offset shift for marker.
- X86_64Compiler.{h,cpp}: SetSidecar(path, functions) + runtime config with
  sidecar bind lambda + RunCJTask execution of main. SIDEcar parts DEAD after
  revert; Compile currently FAILS with "package metadata sidecar is required"
  because FrontendTool no longer calls SetSidecar. MUST REMOVE sidecar
  requirement: make standalone path work (owner-mode runtime init + std.core
  load + RunCJTask), matching ManagedStartup work that previously PASSED
  (smoke main returned 0 exit 0) before sidecar was introduced.
- src/JIT/CMakeLists.txt: finds Cangjie.h in $CANGJIE_HOME/include (required
  for RuntimeParam), links dl, CANGJIE_JIT_NO_STACK_GROWTH define option.
- src/JIT X86_64/JitRuntimeBindings.cpp REQUIRED_SYMBOLS includes sidecar-related
  LoadCJLibrary/InitCJLibrary (still fine standalone).

## LAST VERIFIED RUNTIME RESULTS (before sidecar revert)

- ./build.sh: PASSED (multiple times).
- Smoke `main(): Int64 { return 0 }`: "JIT: main returned 0", exit 0 — WITH
  runtime init + RunCJTask managed execution (pre-sidecar ManagedStartup state).
- Exception smoke (`throw Exception()` in try/catch): FAILED at sidecar LLVM opt
  stage: "cannot guarantee tail call due to mismatched varargs ... Broken module"
  — the sidecar wrapper's musttail couldn't be GC-statepoint-lowered. This was the
  reason for the (reverted) CodeGen edit. Now moot: sidecar is gone.
- examples/01..10 (integer-only): all exit 134 lazy-compilation failures
  (unsupported binary arithmetic overflow strategy / unsupported function call).
  Root causes: (a) THROWING overflow helpers unresolved post-revert, (b)
  Unit-returning functions rejected by resolver (sret), (c) FunctionContext
  landing pads need typed TypeInfo. These examples DON'T throw at runtime —
  overflow strategy is THROWING for Int64 arithmetic in Cangjie semantics, so
  every add/div needs the throw path even on the happy path.

## WHAT IS LEFT (priority order)

1. **Un-break X86_64Compiler for sidecar-less operation**: remove sidecar
   requirement + SetSidecar/binding; keep owner-mode InitCJRuntime +
   LoadCJLibraryWithInit(std-core) + RunCJTask. This restores the verified
   green smoke path.
2. **Un-break THROWING arithmetic**: swap CJ_JIT_Throw_* symbols for exported
   std-core `rt$ThrowOverflowException` / `rt$ThrowArithmeticException`
   (verified exported, no-arg, native frames, native messages via
   __cj$exception_tail_helper_string). Cast messages: use rt$ThrowOverflowException
   (deviation: no bound-specific message) or reject THROWING casts explicitly.
   DivZero -> rt$ThrowArithmeticException. Shift negative/too-large ->
   rt$ThrowArithmeticException (native messages differ: "Overshift: ..." —
   deviation, document). This should turn examples/01-10 green or expose the
   next real gap.
3. **Dispatch CompileObject in CompileBlock**: ALLOCATE->CompileObjectAllocate,
   TRY_ALLOCATE->TryAllocate overload, START_REGION/END_REGION->CompileLocalRegion.
   Currently dead code (CompileBlock still uses scalar CompileAllocate).
4. **Instance-of for catch dispatch**: TranslateExceptionPattern emits InstanceOf
   + Branch per catch clause — CompileBlock does NOT dispatch INSTANCE_OF today.
   Lower via `CJ_MCC_GetObjClass(obj)` + `CJ_MCC_IsSubType(objTI, targetTI)` with
   target TypeInfo from CJ_MCC_GetTypeByMangledName (works for std types like
   Exception/Error; JIT-package types remain unresolvable -> must Fail).
   Landing-pad typed clauses (FunctionContext::EmitExceptionLanding) already use
   the same lookup.
5. **sret (Unit/Nothing) returns in resolver stub + CompileFunction**: needed for
   any function returning Unit (most void calls). Currently rejected => "unsupported
   function call" on examples. Unit sret = hidden rdi pointing to 8-byte zero slot
   (native creates Unit storage; see PlaceArguments ZeroStackValueAndLoadAddress).
6. **Package-local globals**: MemoryUtils global path needs JIT-owned storage or
   explicit rejection (sidecar storage gone). Imported globals OK via symbol.
7. **Invoke/InvokeStatic/TryInvoke/TryInvokeStatic (virtual dispatch)**: NOT
   implemented (VirtualInvocation agent blocked): needs CJ_MCC_UpdateVMT/GetMTable
   + intro-type vtable index + withTI wrapper ABI. Reject explicitly for now.
8. **Local finalizers**: rejected (frontier analysis unfinished, header stub only).
9. **Multi-package**: X86_64Compiler::Compile handles single package only
   (user main). Fine for now.

## VERIFICATION COMMANDS

    ./build.sh          # == python3 build.py build -t debug --no-tests
    ulimit -c 0; export LD_LIBRARY_PATH="$PWD/build/build/lib:$LD_LIBRARY_PATH"
    build/build/bin/cjc --jit examples/01_arithmetic.cj
    # per AGENTS.md: run ALL examples/NN_*.cj, skip hello.cj (external calls),
    # record exit codes. Expected success shape: "JIT: main returned N".

Env: CANGJIE_HOME=/home/a60134677/Documents/cj-comp/main/cangjie_compiler/output
Runtime libs: $CANGJIE_HOME/runtime/lib/linux_x86_64_cjnative/
(runtime .so + std libs; std-core exports rt$Throw*, exception ctors, TypeInfos)

## GOTCHAS

- -Werror -Wimplicit-int-conversion: uint32>>shift into uint8 needs static_cast.
- asmjit: dual-mapping allocator; write via allocator->write(span,off,...) to RX
  through RW alias; embedUInt32 for the prefix; label offset math must subtract
  the 4-byte prefix for metadata PCs.
- Frame marker: [rbp-8] holds entry+9 (call after push+mov). Value slots start
  [rbp-16]; GetSlotOffset returns -(slot+2)*8.
- ResolveAndPatch must NOT require a registered lazy call site (native callers
  have none); only patch when found.
- LSP server (clangd) available via xd://lsp for references before renames.
- Subagents: usage-limit errors killed several agents mid-task; their partial
  outputs are in agent://<id> / history://<id> (RuntimeBindings, MetadataBuilder,
  ExceptionLowering, CheckedOperations, CallingConvention, NativeCallableStubs,
  SidecarImplementation, ObjectLowering, VirtualInvocation, AggregateIntrinsics,
  AggregateStorage, LocalFinalizer, SafepointAnalysis, ManagedStartup).
- Do NOT edit outside src/JIT/** (user directive, enforced twice).
