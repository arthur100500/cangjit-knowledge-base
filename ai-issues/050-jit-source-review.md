# [REFACTOR] Review JIT source files

Priority: P2

Review each file below individually. Absence of a FIX comment is only an inference that review may be needed, not evidence the user did not visit it. `FunctionContext.cpp` is explicitly not yet reviewed by the user; `CompileFunction.cpp` is explicitly requested for re-review. Paths are from the inventory snapshot and may change during refactoring.

- [TODO] `src/JIT/X86_64/Compilers/Context/FunctionContext.cpp` — explicitly not yet user-reviewed
- [TODO] `src/JIT/X86_64/Compilers/Context/JitFailure.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileApply.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileApply.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileBinaryExpression.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileBinaryExpression.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileBranch.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileBranch.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileConstant.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileConstant.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileDebug.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileDebug.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileExit.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileExit.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileGoTo.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileGoTo.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileInvoke.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileInvoke.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileNumericCast.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileNumericCast.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileObject.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileObject.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileUnaryExpression.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Expression/CompileUnaryExpression.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Function/CompileBlock.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Function/CompileBlock.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Function/CompileFunction.cpp` — user-requested re-review
- [TODO] `src/JIT/X86_64/Compilers/Function/CompileFunction.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Compilers/Function/CompileFunctionStub.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/LazyCalls/FunctionRecord.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/LazyCalls/FunctionRecord.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/LazyCalls/FunctionRegistry.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/LazyCalls/FunctionRegistry.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/LazyCalls/FunctionResolver.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/LazyCalls/FunctionResolver.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/LazyCalls/LazyCallSiteRegistry.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/LazyCalls/LazyCallSiteRegistry.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Location.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/InterferenceGraph.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/InterferenceGraph.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/LivenessInterferenceGraphBuilder.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/LivenessInterferenceGraphBuilder.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/LocalFinalizerFrontier.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/LocalFinalizerFrontier.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/RegisterAllocation.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/RegisterAllocation.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/RegisterAllocator.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/SafepointLiveness.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/SafepointLiveness.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/TrivialStackRegalloc.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/TrivialStackRegalloc.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/ValueNumeration.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/RegisterAllocation/ValueNumeration.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Utils/MemoryUtils.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Utils/MemoryUtils.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Utils/RegisterUtils.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Utils/RegisterUtils.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Utils/StackFrameUtils.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Utils/StackFrameUtils.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Utils/SystemVCallingConvention.cpp` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/Utils/SystemVCallingConvention.h` — review status inferred from absence of FIX
- [TODO] `src/JIT/X86_64/X86_64Compiler.h` — review status inferred from absence of FIX

## Added since the inventory

- [TODO] `src/JIT/Runtime/JitRuntime.cpp`
- [TODO] `src/JIT/Runtime/JitRuntime.h`
- [TODO] `src/JIT/Runtime/RuntimeError.h`
- [TODO] `src/JIT/Runtime/RuntimeConfig.h`
- [TODO] `src/JIT/Runtime/RuntimeFunctions.inc`
- [TODO] `src/JIT/Runtime/StringLiteralPool.cpp`
- [TODO] `src/JIT/Runtime/StringLiteralPool.h`
- [TODO] `src/JIT/X86_64/Compilers/Context/TypeInfoEmitter.cpp`
- [TODO] `src/JIT/X86_64/Compilers/Context/TypeInfoEmitter.h`
- [TODO] `src/JIT/X86_64/Compilers/Context/SafepointRecorder.cpp`
- [TODO] `src/JIT/X86_64/Compilers/Context/SafepointRecorder.h`
- [TODO] `src/JIT/X86_64/Compilers/Context/ExceptionLandingEmitter.cpp`
- [TODO] `src/JIT/X86_64/Compilers/Context/ExceptionLandingEmitter.h`
- [TODO] `src/JIT/X86_64/Compilers/Context/LocalFinalizers.cpp`
- [TODO] `src/JIT/X86_64/Compilers/Context/LocalFinalizers.h`
- [TODO] `../cangjit-tests/tests/exception.cj`
- [TODO] `../cangjit-tests/tests/float_calls.cj`
- [TODO] `../cangjit-tests/tests/float_nan.cj`
