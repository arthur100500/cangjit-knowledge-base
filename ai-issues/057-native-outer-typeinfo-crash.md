# [TODO] Fix native executable outer-TypeInfo dispatch across packages

A native executable calling a nongeneric imported interface implemented by `Box<T>` in a shared library crashed in `Box<T>.get`. GDB showed its hidden outer TypeInfo argument in `rsi` was null; the callee dereferenced offset 48 to load the generic type arguments. The equivalent native library-mode caller and the JIT caller returned 42.

`src/CodeGen/CGPkgContext.cpp::NeedOuterTypeInfo` uses a current-package subtype map for executables, which does not include the generic implementation in the shared library. Correct the native executable decision conservatively without assuming external subtype hierarchies are complete, and test native executable and shared-library callers. The JIT does not use LLVM code generation.

The source fixture and earlier observations are documented in `037-jit-review-037.md`.
