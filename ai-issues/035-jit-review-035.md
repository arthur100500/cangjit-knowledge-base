# [REFACTOR] Consider initializing runtime before context creation versus explicit ownership

Priority: P2

Consider initializing runtime before context creation versus explicit ownership; preserve rollback and destruction order.

## Source snapshot

`src/JIT/X86_64/Compilers/Context/GlobalContext.h:36` (line from pre-refactor snapshot):

> // FIX: Maybe runtime should be configured before constructing the GlobalContext? And maybe this belongs not here?

This is an inventory/proposal, not a claim that the requested source change has been completed.
