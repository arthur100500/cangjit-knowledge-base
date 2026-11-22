# [REFACTOR] Compare eager typed fields with dynamic lookup

Priority: P2

Compare eager typed fields with dynamic lookup; retain support for symbols discovered from loaded packages.

## Source snapshot

`src/JIT/X86_64/X86_64Compiler.cpp:148` (line from pre-refactor snapshot):

> // FIX: Maybe it's better to a lot of fields which are pre-fetched at startup?

This is an inventory/proposal, not a claim that the requested source change has been completed.
