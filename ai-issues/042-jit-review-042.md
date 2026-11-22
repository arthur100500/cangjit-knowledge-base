# [REFACTOR] Extract epilogue return-value saving into a named helper preserving unsupported-type errors

Priority: P2

Extract epilogue return-value saving into a named helper preserving unsupported-type errors.

## Source snapshot

`src/JIT/X86_64/Compilers/Function/CompileFunction.cpp:162` (line from pre-refactor snapshot):

> // FIX: Separate function for saving value

This is an inventory/proposal, not a claim that the requested source change has been completed.
