# [TODO] Support JIT-defined TypeInfo and dispatch metadata

JIT-defined classes and other custom types do not yet have runtime-visible native TypeInfo, TypeTemplate, extension or method-table records. Allocation and virtual dispatch require the actual runtime ABI, not placeholder records.

The runtime's native loader registers metadata from a discoverable binary image. The inspected public interfaces do not directly register a complete anonymous JIT package graph; generic TypeInfo construction requires an already valid TypeTemplate. Establish a supported registration and lifetime protocol, including borrowed runtimes, before implementing this without LLVM code generation.

See `src/JIT/X86_64/Compilers/Context/TypeInfoEmitter.cpp` and the native metadata layout in `ai-docs/jit-metadata-layout.md`.
