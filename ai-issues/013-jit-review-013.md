# [REFACTOR] Extract binding, runtime initialization and library loading stages while retaining exception-safe shutdown

Priority: P2

Extract binding, runtime initialization and library loading stages while retaining exception-safe shutdown.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.cpp:72` (line from pre-refactor snapshot):

> // FIX: Also logic to be moved to a separate method

This is an inventory/proposal, not a claim that the requested source change has been completed.
