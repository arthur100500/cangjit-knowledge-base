# [REFACTOR] Extract ABI argument spilling and explain normalization and stack placements

Priority: P2

Extract ABI argument spilling and explain normalization and stack placements; see ai-docs/jit-function-frame-and-metadata.md.

## Source snapshot

`src/JIT/X86_64/Compilers/Function/CompileFunction.cpp:220` (line from pre-refactor snapshot):

> // FIX: This requires separate func. Also, some explanation

This is an inventory/proposal, not a claim that the requested source change has been completed.
