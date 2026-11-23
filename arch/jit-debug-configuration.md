# JIT debug configuration

`GlobalContext` owns a hardcoded `DebugConfig`. `func_print_mode` independently selects assembly, function translation entry and completion, register allocations, and per-CHIR-expression liveness. `runtime_log_mode` selects normal runtime logging or reduced logging. The configuration is not read from command-line arguments or environment variables.

Function diagnostics go to stderr; the unconditional function-context dump is removed. Assembly keeps CHIR comments. Liveness reports the live values before each CHIR expression, including exceptional successors. The regression runner no longer requires the removed dump.

The runtime initializes before `GlobalContext`, so startup uses the same hardcoded configuration before constructing the context. The runtime's logger only permits lowering its minimum level, so `OFF` suppresses routine messages but does not guarantee suppression of errors. This preserves runtime errors rather than redirecting process-wide logging to `/dev/null`, which would affect externally owned runtimes and other threads.
