# [REFACTOR] Split Build into validation, stack-map, exception and descriptor encoding helpers

Priority: P2

Split Build into validation, stack-map, exception and descriptor encoding helpers; preserve binary format and errors.

## Source snapshot

`src/JIT/X86_64/JitMetadataBuilder.cpp:38` (line from pre-refactor snapshot):

> // FIX: This method is FAR to big. Introduce private helper methods.

This is an inventory/proposal, not a claim that the requested source change has been completed.
