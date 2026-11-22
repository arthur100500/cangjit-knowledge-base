# [REFACTOR] Move runtime setup to runtime loading ownership

Priority: P2

Move runtime setup to runtime loading ownership; preserve environment setup, lifetime and diagnostics.

## Source snapshot

`src/JIT/X86_64/X86_64Compiler.cpp:98` (line from pre-refactor snapshot):

> // FIX: Maybe im wrong, but doesn't it belong to some runtime class? Or better yet runtime loader

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Shutdown safety

`X86_64Compiler::Close()` returns `Result<void, RuntimeError>`; the host must first quiesce JIT tasks and generated code. Once close is attempted, the compiler cannot compile more functions, including after a failure. A failed close leaves the remaining runtime resources owned and allows the caller to retry while keeping the compiler alive.

`GlobalContext` closes the runtime during destruction only if no previous close attempt failed. If a previous close failed, or the destructor's own close fails or throws, it reports the failure and terminates rather than retry implicitly or destroy code and literals still potentially referenced by the runtime. A caller may explicitly retry `Close()` while keeping the object alive. Initializer rollback reports a cleanup failure alongside the initialization error; an exception combined with cleanup failure also terminates.

`JitRuntime::Create` initializes an owned or borrowed runtime before `GlobalContext` is constructed. It owns bindings and literal storage; the context closes it while generated code is still alive. If initialization rollback fails, the typed error retains the runtime for an explicit close retry rather than silently retrying during destruction. The command-line compiler derives its default owned configuration from the environment; embedders can supply either ownership mode to `X86_64Compiler::Create`.

## Verification

The compiler build and four existing JIT regressions passed. An explicit close and repeated close succeeded against the real runtime. A temporary fault-injection runtime exercised typed finalization and library-unload failures, retained ownership and successful explicit retry, initialization rollback failure reporting, and an injected `dlclose` failure. The actual compiler terminated with SIGABRT when destruction encountered persistent finalization or unload failures; before this change it returned while the runtime reported failed finalization. An owner smoke checked explicit close, retry, idempotence and rejection of compilation after close. A separate destructor smoke used a one-shot failure to verify that destruction terminates rather than retry implicitly.

The owner factory was exercised with a real owned runtime and a borrowed runtime. A temporary injected runtime failed library loading and its first finalization; the factory returned both typed failures and the retained runtime, whose explicit close succeeded.
