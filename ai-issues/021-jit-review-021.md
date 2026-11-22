# [REFACTOR] Move ParameterPlacement to the calling convention ownership boundary and migrate includes

Priority: P2

Move ParameterPlacement to the calling convention ownership boundary and migrate includes.

## Source snapshot

`src/JIT/X86_64/Types.h:27` (line from pre-refactor snapshot):

> // FIX: this should go to the CallingConvention

This is an inventory/proposal, not a claim that the requested source change has been completed.
