# JIT state assertions

The JIT uses `CJC_ASSERT` for proven internal contracts at handoffs between its own analyses, code emitters, ABI placement and lazy-call state machine. This exposes implementation bugs in assertion-enabled builds rather than silently omitting generated code or analysis facts, or treating internal state inconsistencies as ordinary unsupported operations.

Preserve genuine errors for unsupported CHIR and ABI forms, resource and runtime failures, recursive lazy resolution, and optional call-site patching. Assertion expressions must not mutate state. Because `CJC_ASSERT` does not enforce its condition under `NDEBUG` without `CMAKE_ENABLE_ASSERT`, retain safe failure paths where continuing would be unsafe; do not treat it as input validation. Invalid successful lazy materialization targets must leave the record in a coherent failed state even in release builds.

The accepted scope covers CFG successor and entry-liveness consistency, float operation dispatch, lazy-call transitions and call-site publication, ABI placement consumed by call and function lowering, and proven internal CFG/value/frontier consistency in safepoint and finalizer analysis. Establish each producer contract before asserting it; a condition that is not proven remains recoverable. No new classes are introduced.

The alternative of asserting every failed check was rejected because external inputs, unsupported features, and resource limits can legitimately fail. Unconditionally deleting defensive guards was rejected because assertions can be disabled.
