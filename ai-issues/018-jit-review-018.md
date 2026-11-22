# [REFACTOR] Replace RuntimeConfig tuple with a named field struct and migrate all callers

Priority: P2

Replace RuntimeConfig tuple with a named field struct and migrate all callers.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.h:27` (line from pre-refactor snapshot):

> // FIX: Not good, use fields

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution

`RuntimeConfig` has named fields for the runtime path, requested libraries, ownership, stack-growth mode and compiler search paths.
