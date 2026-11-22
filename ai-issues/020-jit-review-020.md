# [REFACTOR] Introduce typed binding error categories without losing loader diagnostics

Priority: P2

Introduce typed binding error categories without losing loader diagnostics.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.h:32` (line from pre-refactor snapshot):

> // FIX: Error handling should be typed

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution

`RuntimeErrorKind` classifies initialization, loader, lookup and shutdown failures. Loader details, native error codes and rollback failures remain available separately.
