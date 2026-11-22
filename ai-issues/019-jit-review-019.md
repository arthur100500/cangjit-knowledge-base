# [REFACTOR] Evaluate replacing SymbolResult variant with an explicit result entity

Priority: P2

Evaluate replacing SymbolResult variant with an explicit result entity; retain error details.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.h:31` (line from pre-refactor snapshot):

> // FIX: I do not quite like this time, maybe use less std::variants overall

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution

`SymbolResult` is `Result<void*, RuntimeError>`; callers use its explicit value/error accessors.
