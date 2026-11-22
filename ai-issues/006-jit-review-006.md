# [REFACTOR] Compare eager typed runtime fields against on-demand lookup for package-dependent symbols

Priority: P2

Compare eager typed runtime fields against on-demand lookup for package-dependent symbols; keep shutdown and loading semantics.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.cpp:22` (line from pre-refactor snapshot):

> // FIX: Maybe eager parsing will do better here, and instead of strings pick static/runtime fields depending on better fit

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution

`RuntimeFunctions.inc` defines required eager bindings and optional lazy bindings. Public C runtime functions use the types from `Cangjie.h`; helpers invoked only by generated code are stored as addresses. Both owned and borrowed runtime modes were exercised.
