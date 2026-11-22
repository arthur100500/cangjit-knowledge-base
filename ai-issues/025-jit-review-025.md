# [REFACTOR] Move runtime-symbol resolution/reporting to RuntimeBindings or a suitable typed boundary

Priority: P2

Move runtime-symbol resolution/reporting to RuntimeBindings or a suitable typed boundary.

## Source snapshot

`src/JIT/X86_64/X86_64Compiler.cpp:135` (line from pre-refactor snapshot):

> // FIX: This function seems to belong to RuntimeBindings

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution

Runtime bindings resolve and type the task entry points. `X86_64Compiler` invokes the generated getters and formats typed failures at the diagnostic boundary; its string-based symbol-resolution helper was removed.
