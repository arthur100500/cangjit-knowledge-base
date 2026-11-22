# [REFACTOR] If typed runtime fields replace public lookup, make Resolve private only after migrating all dynamic lookup callers

Priority: P2

If typed runtime fields replace public lookup, make Resolve private only after migrating all dynamic lookup callers.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.cpp:141` (line from pre-refactor snapshot):

> // FIX: If runtime bindings are to be moved to fields of runtime, this should be made private helper method

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Decision

Known functions use generated getters, but `Resolve` remains public because imported function and TypeTemplate names are only known from CHIR at runtime. Removing name-based lookup would prevent native-package interoperability.
