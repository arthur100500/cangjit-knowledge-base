# [REFACTOR] Split Compile into cohesive private helpers and retain explicit user re-review task

Priority: P2

Split Compile into cohesive private helpers and retain explicit user re-review task.

## Source snapshot

`src/JIT/X86_64/Compilers/Function/CompileFunction.cpp:197` (line from pre-refactor snapshot):

> // FIX: This function requires multiple helper method. Refactor it like this and mark it as todo so I could return to it and re-review

This is an inventory/proposal, not a claim that the requested source change has been completed.
