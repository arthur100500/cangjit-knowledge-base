# JIT metadata publish pipeline duplicated

Priority: P2

Closed: 2026-11-26 — the object representation was implemented as
`FunctionMetadata` in `src/JIT/Runtime/` (see arch/jit-function-metadata.md);
the two-phase publish duplication at the call sites remains by design (the
`MetadataPublisher` extraction was rejected). Reopen if the duplicated
publish pipeline becomes a maintenance problem.

Evidence — both sites perform the identical pipeline:

| Step | CompileFunction (main path) | MakeResolverStub |
|---|---|---|
| Reserve 4-byte prefix placeholder | `CompileFunction.cpp:269` `embedUInt32(0)` | `CompileFunctionStub.cpp:230` `embedUInt32(0)` |
| Code size check (`offset-4` in `uint32_t`) | `GetCodeSize`, `CompileFunction.cpp:109-119` | inline, `CompileFunctionStub.cpp:230-235` |
| Provisional `Build` at fixed addresses | `CompileFunction.cpp:139-145` | `CompileFunctionStub.cpp:242` |
| Align 4 + embed descriptor at `offset()` | `CompileFunction.cpp:146-150` | `CompileFunctionStub.cpp:243-249` |
| Final `Build` at `base + offset`, `base + 4` | `CompileFunction.cpp:171` | `CompileFunctionStub.cpp:255` |
| Size-unchanged invariant, `allocator->query` + two `write`s | `CompileFunction.cpp:177-185` | `CompileFunctionStub.cpp:258-265` |

Under the `FunctionMetadata` direction, `Serialize` (= today's `Build`) stays a
pure encoder; the embed (provisional) and allocator-patch (final) passes remain
at the two call sites, so the pipeline duplication above is not itself removed.

Caller-specific parts that stay at the call sites: `frame` values (computed
frame size vs constant 192), stack-growth slot clearing in the stub, allocation
and release ordering, lazy-call-site registration (main path only), error
reporting style (`CompilationError` vs `nullptr`).

Gate 1 contract accepted; implemented as a cutover rename
(`JitMetadataBuilder` → `FunctionMetadata`, `Build` → `Serialize`,
`GetMetadataBuilder` → `GetMetadata`), byte-identical format. Verified: debug
build passed; numbered examples 01–10 all exited 0 under `cjc --jit`.

Source: ai-issues/065-jit-metadata-publish-duplication.md
