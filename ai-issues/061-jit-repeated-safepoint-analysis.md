# [REFACTOR] Reuse safepoint initialization analysis

Priority: P2

`ComputeSafepointLiveness` rebuilds the control-flow graph, reachability, and forward must-initialization fixed point for every safepoint in a function. The liveness bitmap is already shared per expression. Consider computing immutable CFG and initialized-before information once per function, then retaining the per-safepoint temporary-root handling and reference-provenance classification. Preserve exceptional-edge behavior: a try-expression's result is not initialized on its error edge.
