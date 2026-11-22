# [REFACTOR] Extract runtime directory derivation

Priority: P2

Extract runtime directory derivation; consider the existing path utility semantics.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.cpp:62` (line from pre-refactor snapshot):

> // FIX: Also logic to be moved to separate method

This is an inventory/proposal, not a claim that the requested source change has been completed.
