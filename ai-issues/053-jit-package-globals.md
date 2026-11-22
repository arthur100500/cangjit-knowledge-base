# [TODO] Support JIT package globals, initialization and GC roots

The JIT rejects package-local global storage and global initializers. Correct support needs stable storage, the native package initializer and its once/cycle semantics, static read/write barriers, and GC-updatable root slots, including references inside aggregates.

Native package loading registers root tables from a discoverable metadata image. Establish registration and safe lifetime/teardown for both owned and borrowed runtimes; object handles alone do not register addressable global slots. See `src/JIT/X86_64/Utils/MemoryUtils.cpp` and `X86_64Compiler::ValidatePackageInitializers`.
