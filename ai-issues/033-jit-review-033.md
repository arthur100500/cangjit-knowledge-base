# [REFACTOR] Propose focused owners for type info and finalizer logic, leaving context as state/accessors and preserving lifetime/error propagation

Priority: P2

Propose focused owners for type info and finalizer logic, leaving context as state/accessors and preserving lifetime/error propagation.

## Source snapshot

`src/JIT/X86_64/Compilers/Context/FunctionContext.h:45` (line from pre-refactor snapshot):

> // FIX: Unsure if following methods belong in the context. It's purpose is just to store some variables needed for function creation, not any heavy logic. Try to leave getters only and propose a better locations (new classes likely) for those methods

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution

`FunctionContext` owns `TypeInfoEmitter`, `SafepointRecorder`, `ExceptionLandingEmitter`, and `LocalFinalizers`; their operations and finalizer state moved out of the context. Compiler build and native/JIT float, exception, generic-TypeInfo, and precompiled local-finalizer/GC smokes passed.
