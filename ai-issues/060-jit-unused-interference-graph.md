# [REFACTOR] Avoid unused interference-graph construction

Priority: P2

`CompileFunction::CompileToAddressImpl` constructs a liveness-based interference graph for every function, but `TrivialStackRegalloc::Allocate` uses it only to assert its node count. The graph currently has no effect on allocation and adds compilation work and memory use. Decide whether to bypass graph construction for the stack allocator or introduce an allocator that consumes it. The liveness result remains necessary for safepoints and is part of the agreed pipeline, so this is not a request to remove liveness analysis.
