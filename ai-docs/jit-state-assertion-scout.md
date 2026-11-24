# Which JIT state checks are internal invariants rather than recoverable failures?

Scouted 2026-11-24, limited to `cangjit/src/JIT`. `CJC_ASSERT` in `include/cangjie/Utils/CheckUtils.h` does not check its condition under `NDEBUG` without `CMAKE_ENABLE_ASSERT`; its argument is still evaluated. Assertions are diagnostics, not release-mode input validation.

## Strong candidates

- `X86_64/RegisterAllocation/LivenessAnalysis.cpp`, `Compute`: successor blocks are looked up in the map made from the same function; an existing `assert` is followed by a silent skip. A skipped edge can understate liveness.
- `X86_64/RegisterAllocation/LivenessInterferenceGraphBuilder.cpp`, `Build`: the liveness entry row should exist for the validated function entry; an existing assertion is followed by a silent skip of its interference clique.
- `X86_64/Compilers/Expression/CompileBinaryExpression.cpp`, `EmitFloatComparison` and `EmitFloatArithmetic`: default dispatch paths silently emit no operation after `CompileFloatBinary` checks the operation. Verify the comparison-kind predicate covers exactly the handled operations.
- `X86_64/LazyCalls/FunctionResolver.cpp` and `FunctionRecord.cpp`: after the resolver handles the other states, beginning compilation must start from `UNCOMPILED`; completion must start from `COMPILING`. Initialization permits an identical repeat. Failed materialization is real and must continue to be reported. A successful materializer returning zero or its own stub is rejected, but currently leaves the record `COMPILING`; preserve a coherent failure transition in release builds.
- `X86_64/LazyCalls/LazyCallSiteRegistry.cpp`: published call site offsets, records and unique return addresses are produced internally; allocation failures remain real and need rollback.
- `X86_64/Compilers/Expression/CompileApply.cpp`, `CompileInvoke.cpp`, `Compilers/Function/CompileFunction.cpp` and `CompileFunctionStub.cpp`: successful `SystemVCallingConvention::ComputePlacement` produces a location and ABI type for each parameter; later missing entries represent a broken internal contract, unlike unsupported types or assembler failures.
- `X86_64/RegisterAllocation/SafepointLiveness.cpp` and `LocalFinalizerFrontier.cpp`: map membership for function CFG blocks and promised value numbering are internal consistency conditions; other failures describe unsupported GC provenance, layouts or escaped objects and remain recoverable.
- `X86_64/Compilers/Context/LocalFinalizers.cpp`: generated frontier edge endpoints should be non-null; label creation may genuinely fail.

## Preserve legitimate branches

An absent registered lazy call site is valid for indirect stub calls. Constants and non-local operands need not have value numbers. Unreachable finalizer allocations and escaped objects can legitimately have no frontier. Unsupported CHIR, ABI classes, runtime symbol lookup, allocation, frame limits, metadata representability and materialization failure remain reported failures. Recursive lazy resolution is explicitly detected. Missing `user.main` and null package globals require contract evidence before treating them as assertions.

No build or generated-code execution was performed during scouting; changes require Gate 2 approval first.
