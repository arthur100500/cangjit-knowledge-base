# JIT cooperative safepoint polling and metadata correctness

Priority: P1

The AsmJit JIT records stack-map metadata at selected code offsets, but its inspected code does not emit the cooperative TLS safepoint checks used by the native LLVM pipeline. Runtime stack-map lookup requires an exact PC match, so metadata recording alone does not show how a running JIT frame reaches a parseable stop point for GC. Track investigation and implementation of a correct JIT poll/slow-path integration, together with the surrounding metadata and codegen refactor needed to keep it maintainable. Do not assume native compiler TLS offsets, reserved-register conventions, or handler ABI without verifying the runtime contract.

## Evidence and behavior

- `cangjit/src/JIT/X86_64/Compilers/Context/SafepointRecorder.cpp::Record` derives a code-relative PC and sends roots to `JitMetadataBuilder::RecordSafepoint`.
- `cangjit/src/JIT/Runtime/JitMetadataBuilder.cpp::BuildStackMap` serializes point records; it does not emit polling instructions or stop a thread.
- `cangjie_runtime/runtime/src/StackMap/StackMapTable.h::GetIdxSet` computes `framePC - startPC` and binary-searches for an exact map PC. It does not apply a previous record to a PC interval.
- In the native pipeline, LLVM `PlaceSafepoints.cpp` inserts entry/backedge polls and makes calls parseable. The x86-64 lowering checks TLS state and calls the slow-path handler when active. These facilities are not part of the AsmJit pipeline.
- Runtime `MutatorManager::TransitionAllMutatorsToGCPhase` sets the suspension request and activates safepoint state; the mutator cooperates at a poll/transition and the runtime then scans roots.

## Work to resolve

1. Verify the runtime-supported way for JIT code to read the active safepoint request and invoke the handler, including TLS access, calling convention, register preservation, and thread/stack-growth modes.
2. Choose JIT poll locations that guarantee progress, initially matching the native strategy of function entry and loop backedges where compatible with the JIT's CHIR CFG; identify calls that require parseable suspended caller frames.
3. At each generated slow-path site, ensure `SafepointRecorder` captures the exact PC and complete roots after accounting for poll-call clobbers and temporary arguments.
4. Keep exact-PC stack-map semantics; do not treat a preceding map as covering an interval unless the runtime encoding/contract is deliberately changed and verified.
5. Refactor the JIT emitter/context only as needed to keep poll emission, safepoint-root computation, and metadata publication understandable; avoid introducing an unverified parallel ABI convention.
6. Verify with runtime-backed GC scenarios that exercise entry polls, loop backedges, nested calls, register and stack roots, derived roots, and stack growth where enabled.

## Scope boundary

This is an investigation/design issue, not approval of a particular implementation or a record of completion. No compiler/runtime code has been changed for this issue. The project owner requested tracking this work in `op-issues/` while considering a broader JIT refactor.
