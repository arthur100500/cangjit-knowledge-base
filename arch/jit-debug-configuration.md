# JIT debug configuration

`Logger`, owned by `GlobalContext`, owns `DebugConfig` and the asmjit file logger. `func_print_mode` independently selects assembly, function translation entry and completion, register allocations, and per-CHIR-expression liveness. `runtime_log_mode` selects normal runtime logging or reduced logging. The configuration is not read from command-line arguments or environment variables.

Function diagnostics go to stderr; the unconditional function-context dump is removed. Assembly keeps CHIR comments. Liveness reports the live values before each CHIR expression, including exceptional successors. The regression runner no longer requires the removed dump.

The runtime initializes before `GlobalContext`, so startup uses the same hardcoded configuration before constructing the context. The runtime's logger only permits lowering its minimum level, so `OFF` suppresses routine messages but does not guarantee suppression of errors. This preserves runtime errors rather than redirecting process-wide logging to `/dev/null`, which would affect externally owned runtimes and other threads.

The JIT `Logger` is owned by `GlobalContext` and owns both the diagnostic configuration and the asmjit file logger. Consumers call semantic methods (`LogFunctionCompilationBegin`, `LogLiveness`, `LogCallPatched`, etc.) unconditionally; mode checks and message formatting stay inside `Logger`, so adding diagnostics does not add nested check/print branches at call sites. `IsEnabled` is private. Assembly attachment is likewise encapsulated by the logger.

Runtime initialization can precede `GlobalContext`, so `Logger::DefaultConfig()` exposes the compile-time default without constructing an instance. Runtime errors remain unconditional; `runtime_log_mode` retains its existing owner-runtime initialization behavior.

Decision accepted 2026-11-24: prefer one global-context-owned logger with event-specific methods over exposing configuration checks or a raw asmjit logger to each consumer. This keeps output policy, formatting and assembly setup in one place.

Verification: `./build.sh` exited 0. `timeout 30s build/build/bin/cjc --jit examples/05_function_calls.cj` exited 0 and reported `JIT: main returned 0`. Assembly output included the normal function and resolver-stub headers, confirming that the logger-owned asmjit `FileLogger` remains attached while `GlobalContext` lives.
