# [REFACTOR] Compare typed return errors against exceptions for eager initialization, including rollback and caller contracts

Priority: P2

Compare typed return errors against exceptions for eager initialization, including rollback and caller contracts; do not assume exceptions are better.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.cpp:31` (line from pre-refactor snapshot):

> // FIX: If it will be eager, maybe throwing an exception instead of returning string will be a better fit

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution

Initialization returns `Result<..., RuntimeError>` rather than using exceptions for expected failures. An initialization error retains both the original failure and any cleanup failure. When cleanup fails, the error retains the runtime for an explicit retry; fault injection exercised that path.
