# [ABI INFO] Calling conventions

Scope: source snapshot inspected 2026-11-23, x86-64 Linux. “Native” means CJNative LLVM AOT code generation; “JIT” means `cangjit/src/JIT/X86_64`. Paths below are relative to the sibling repository roots `cangjit` and `cangjie_runtime`. This is implementation evidence, not a cross-version ABI guarantee.

## JIT scalar placement

`cangjit/src/JIT/X86_64/Utils/SystemVCallingConvention.cpp`, `Classify` and `ComputePlacement`, use separate integer and SIMD allocation streams. Integer/pointer arguments use RDI, RSI, RDX, RCX, R8, R9; scalar floats use XMM0–XMM7. Exhausted streams use stack slots in argument traversal order; `StackFrameUtils::GetFrameSize` computes the reserved size. Scalar integer/pointer results use RAX and scalar floating results XMM0. Width and signedness are important when loading and normalizing values.

For a supported non-generic free function with parameters `(Int64, Float64, Int64)`, absent hidden arguments, placement is:

```text
argument        first integer    first float    second integer
location        RDI              XMM0           RSI
result          RAX (integer) or XMM0 (float)
```

An indirect result consumes the first integer position before explicit arguments. For a non-C function returning `Unit`, the placement code also models an indirect result: e.g. `(Int64) -> Unit` places its result address in RDI and the integer in RSI. Generic type-info pointers follow explicit parameters, followed by an outer type-info for a parent custom type and, for static functions, a this-type-info. Certain reference-to-struct/tuple parameters also receive an extra base pointer. These are Cangjie ABI details, not ordinary C source parameters. See `ComputePlacement` and `GetNativeParameterPlacement` in the same file.

## Classification is not support

The classifier describes placements for some types that a particular emitter still rejects. `CompileApply::ValidateCall` and `CompileCall` in `cangjit/src/JIT/X86_64/Compilers/Expression/CompileApply.cpp` reject C functions, varargs, nontrivial indirect returns and base-pointer locations; supported arguments/results are narrower than the classifier. `CompileInvoke.cpp`, `CompileCall`, similarly rejects base pointers and non-Unit/Nothing indirect returns. Do not infer aggregate support from a register-class entry alone. A signature must satisfy the entry stub, caller, and callee implementation.

CJNative C FFI is a distinct lowering: `cangjit/src/CodeGen/CJNative/CJNativeCGCFFI.cpp`, `LinuxAmd64CJNativeCGCFFI::GetCFuncType` and `AddFunctionAttr`, handle C struct classification, attributes such as sret/byval, and varargs in the LLVM function type. That is not evidence that JIT C calls support those cases. See [interoperability](abi-interoperability.md) and [call paths](abi-call-paths.md).
