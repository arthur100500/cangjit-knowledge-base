# [REFACTOR] Extract ABI return-value loading and normalization into suitable utility/helper without changing types

Priority: P2

Extract ABI return-value loading and normalization into suitable utility/helper without changing types.

## Source snapshot

`src/JIT/X86_64/Compilers/Function/CompileFunction.cpp:174` (line from pre-refactor snapshot):

> // FIX: This looks like some logic that is to be turned into an Util/Helper function

This is an inventory/proposal, not a claim that the requested source change has been completed.
