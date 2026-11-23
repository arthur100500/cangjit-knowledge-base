# [ABI INFO] Runtime lifecycle

Scope: current checked-out `cangjit` and `cangjie_runtime` sources, 2026-11-23, Linux x86-64. Paths below are relative to their respective repository roots. Native executable startup and the x86-64 JIT embedding path are different; these are implementation facts, not a promise of a stable external ABI.

## Two entry paths

```text
Native executable                     x86-64 JIT host
-----------------                     ---------------
generated main                        dlopen runtime, bind exports
  -> MRT_CjRuntimeInit                  -> InitCJRuntime(&params) [owner only]
  -> MRT_SetCommandLineArgs            -> LoadCJLibraryWithInit(core)
  -> MRT_CjRuntimeStart(entry)         -> compile main to address
     -> CJThreadNew, ScheduleStart     -> RunCJTask(address, null)
     -> generated entry -> user main    -> GetTaskRet -> ReleaseHandle
                                       -> FiniCJRuntime [owner only]
                                       -> unload libraries -> dlclose runtime
```

`cangjit:src/CodeGen/CJNative/EmitPackageIR.cpp` (`EmitMain`, `GenerateEntryFunction`) emits the native sequence. The generated entry calls user main inside a try/catch wrapper and runs exit callbacks on its normal path. `cangjie_runtime:runtime/src/CjScheduler.cpp` (`MRT_CjRuntimeInit`, `MRT_CjRuntimeStart`) builds native runtime parameters, creates the runtime, schedules the main CJThread and starts the scheduler. The shown generated main does not itself call the embedding API `FiniCJRuntime`; do not infer identical shutdown sequencing from the two paths.

## Embedding initialization and teardown

`cangjie_runtime:runtime/src/CangjieRuntimeApi.cpp` (`InitCJRuntime`, `StartCJRuntime`) validates the supplied `RuntimeParam`, applies defaults, creates a joinable pthread that initializes the runtime and starts scheduling, and waits until initialization and scheduler startup before returning. For Linux an all-zero parameter structure selects, among other defaults, a 64 MiB initial heap, 64 KiB regions, a 128 KiB CJThread stack and processor count from `hardware_concurrency` (fallback 8); the native executable's `InitRuntimeParam` has different defaults. Values are implementation defaults, not layout guarantees. See the field definitions and units in `cangjie_runtime:runtime/src/Cangjie.h`.

Example: `cangjit:src/JIT/X86_64/X86_64Compiler.cpp` (`ConfigureRuntime`) requires `CANGJIE_HOME`, constructs a zero-initialized `RuntimeParam`, loads `runtime/lib/linux_x86_64_cjnative/libcangjie-runtime.so` and requests `libcangjie-std-core.so`, with ownership enabled. `RunUserMain` submits the generated address as a `CJTaskFunc`, waits, releases the handle, and prints the result after copying its pointer-sized bits into an `int64_t`.

`cangjit:src/JIT/Runtime/JitRuntimeBindings.cpp` (`Initialize`, `InitializeRuntime`, `Close`) opens the runtime with `RTLD_NOW | RTLD_GLOBAL`, binds required exports, conditionally initializes it, and loads requested libraries. With `owner=false`, initialization/finalization is the host's responsibility; the binding does not prove that the host initialized the runtime. On close, an owned runtime is finalized before libraries are unloaded in reverse order, so their type metadata remains mapped while the collector stops. A failed finalization or unload stops cleanup and is reported; initialization failure also attempts cleanup. `RuntimeFunctions.inc` distinguishes required and lazily resolved optional functions.

```text
not started --InitCJRuntime--> running --FiniCJRuntime--> finished
                     \-- invalid config --> E_ARGS
```

`InitCJRuntime` returns `E_OK` if already initialized, but refuses initialization after the finished flag is set. `FiniCJRuntime` stops sampling, transitions an existing mutator to exit, stops the scheduler and destroys the runtime; a repeated call returns `E_OK` after logging. By contrast, `SetRuntimeInitFlag`/`SetRuntimeFiniFlag` reject duplicate transitions. This is not evidence of supported restart or safe concurrent initialization. In particular, `InitCJRuntime` returning success for an existing runtime does not by itself confer exclusive ownership: an embedding host must coordinate ownership and teardown and keep generated code and referenced metadata alive while tasks can use them.

## Boundary conditions

`RunCJTask` executes in a managed CJThread rather than making an arbitrary direct C call into generated managed code. The executor enters managed code through `ExecuteCangjieStub`, checks pending exceptions and transitions the mutator on exit (`cangjie_runtime:runtime/src/CangjieRuntimeApi.cpp`, `RunCJTaskImpl`, `UserFuncExecutor`). Scheduling and wait details are in `abi-concurrency.md`; library loading and symbol lookup are in `abi-package-loading.md`. Stack-growth mode is a host assertion in the JIT bindings, not a runtime query (`JitRuntimeBindings::Initialize`); consumers must keep emitted metadata consistent with the runtime's actual setting.
