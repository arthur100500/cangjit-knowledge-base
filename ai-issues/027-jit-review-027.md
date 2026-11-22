# [REFACTOR] Typed function pointers avoid repeated casts but do not remove dlsym conversion

Priority: P2

Typed function pointers avoid repeated casts but do not remove dlsym conversion; see ai-docs/jit-review-questions.md.

## Source snapshot

`src/JIT/X86_64/X86_64Compiler.cpp:161` (line from pre-refactor snapshot):

> // FIX: Why not just*?

This is an inventory/proposal, not a claim that the requested source change has been completed.
