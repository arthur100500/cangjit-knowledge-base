# How Cangjie native code synchronizes GC safepoints

Cangjie native code does not primarily wait for an asynchronous signal to interrupt arbitrary managed instructions. The compiler inserts cooperative polling sites; at a poll, generated code checks the thread-local safepoint state and calls a runtime safepoint handler only on the slow path.

## Native compiler and LLVM

The actual LLVM source used by the local `cangjie_compiler` build is under `build/build/third_party/cjnative-prefix/src/cjnative/llvm/`; `third_party/llvmPatch.diff` tracks its patches. LLVM's `lib/Transforms/Scalar/PlaceSafepoints.cpp` describes parseable call safepoints and inserts entry/backedge polls for managed (`gc "cangjie"`) functions. Calls that can enter code which might safepoint are also made parseable, so suspended caller frames can be scanned. Polls are inserted at method entry and most loop backedges, with analysis avoiding redundant polls where possible. This bounds time to a cooperative poll for code that reaches the inserted sites; a tight loop has a backedge poll.

The pass makes a temporary `gc.safepoint_poll` function whose slow path calls `CJ_MCC_HandleSafepoint`, inlines it at poll sites, and marks the relevant runtime calls as parse points/statepoints. On x86-64, `X86MCInstLower.cpp::emitCJSafepointInlineCheck` emits a TLS safepoint-state load/check. The normal zero state branches around the handler; active state calls the safepoint handler stub. LLVM emits stack-map state for this handler call. Outline mode has an equivalent compare-and-branch to a shared stub. This is a cooperative branch/call poll, not a SIGURG-style interruption of arbitrary instructions.

## Runtime synchronization

`MutatorManager::TransitionAllMutatorsToGCPhase` installs the GC barrier/phase, sets `SUSPENSION_FOR_GC_PHASE`, and calls `SetSafepointActive(true)` for every mutator. The mutator's TLS `safepointState` is the poll-visible state. At a poll the generated code reaches `CJ_MCC_HandleSafepoint`; the x86-64 assembly stub saves general and SIMD registers, updates unwind context, and calls `HandleSafepoint`. Runtime handler enters a safe region and handles/waits for suspension. The GC waits for phase transitions before enumerating roots. Resume completes the wait/phase transition and generated code restores registers and returns from the stub.

The runtime's signal manager exists for signals/faults and signal-based diagnostics, but this source path does not use an asynchronous signal to stop a mutator at an arbitrary managed PC for ordinary GC phase transitions.

## Exact PC and stack maps

Poll/statepoint locations are compiler-created parse points. The runtime `StackMapTable::GetIdxSet(startPC, framePC)` computes `framePC - startPC` and binary-searches the sorted table for an exact PC match; it does not use a preceding entry as a range. The generated statepoint call's PC has a stack-map record. For ordinary call safepoints, the caller's call-return PC is parseable too, because the callee may safepoint while the caller remains suspended.

This distinction resolves the apparent interval question: there is no general "map 2 covers until map 3" rule. The poll slow path and parseable call sites provide the exact PCs at which runtime can inspect; arbitrary PCs are not automatically safe merely because they lie between entries.

## Important JIT distinction

The AsmJit JIT in `cangjit/src/JIT` is separate from the native LLVM code-generation pipeline. Its `SafepointRecorder` records stack-map metadata after selected operations, and `JitMetadataBuilder` serializes it. Its code paths inspected here do not implement LLVM's `PlaceSafepoints` pass or its TLS poll checks. Therefore these native-code synchronization findings explain native Cangjie code; they do **not** establish that the AsmJit JIT inserts cooperative polls or guarantees its recorded PCs are the runtime's inspection PCs. That integration remains unverified/absent in the inspected JIT source.

## Sources inspected

- `cangjie_compiler/build/build/third_party/cjnative-prefix/src/cjnative/llvm/lib/Transforms/Scalar/PlaceSafepoints.cpp`: poll placement, parse points and call-statepoint contract.
- Same tree, `llvm/lib/Target/X86/X86MCInstLower.cpp`: x86-64 TLS poll check and handler slow path.
- `cangjie_runtime/runtime/src/Mutator/MutatorManager.cpp::TransitionAllMutatorsToGCPhase`, `Mutator.cpp::HandleSuspensionRequest`, `Mutator.h::SetSafepointActive`.
- `cangjie_runtime/runtime/src/arch/x86_64_linux/HandleSafepointStub.S` and `MutatorManager.cpp::HandleSafepoint`.
- `cangjie_runtime/runtime/src/StackMap/StackMapTable.h::GetIdxSet` and `CompressedStackMap.h`.
- `cangjit/src/JIT/X86_64/Compilers/Context/SafepointRecorder.cpp` and `cangjit/src/JIT/Runtime/JitMetadataBuilder.cpp` for the JIT contrast.
