# [REFACTOR] Rename CompileUserMain to reflect execution or return compilation result and separate invocation

Priority: P2

Rename CompileUserMain to reflect execution or return compilation result and separate invocation; migrate callers.

## Source snapshot

`src/JIT/X86_64/X86_64Compiler.cpp:124` (line from pre-refactor snapshot):

> // FIX: CompileUserMain runs function, so rename is needed, or better return compilation result

This is an inventory/proposal, not a claim that the requested source change has been completed.
