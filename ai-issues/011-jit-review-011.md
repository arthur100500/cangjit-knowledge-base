# [REFACTOR] Extract library path/basename validation, preserving duplicate and error behavior

Priority: P2

Extract library path/basename validation, preserving duplicate and error behavior.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.cpp:46` (line from pre-refactor snapshot):

> // FIX: Seems like this logic will be better off in it's own method

This is an inventory/proposal, not a claim that the requested source change has been completed.
