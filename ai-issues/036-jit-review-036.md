# [REFACTOR] Extract outer-TypeInfo analysis from header and GlobalContext into an appropriate owner

Priority: P2

Extract outer-TypeInfo analysis from header and GlobalContext into an appropriate owner; preserve package cache invalidation.

## Source snapshot

`src/JIT/X86_64/Compilers/Context/GlobalContext.h:73` (line from pre-refactor snapshot):

> // FIX: Pretty sure this stuff does not belong to header file. And does not belong here in the GlobalContext

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution

The JIT no longer needs this analysis: ordinary virtual calls always obtain outer TypeInfo from the runtime, as native library mode does. The package graph, cache, and package setter were removed. See `037-jit-review-037.md` for the cross-package counterexample.
