# JIT runtime layout

Runtime lifecycle, runtime bindings and configuration, runtime errors, runtime symbol definitions, literal pooling, and runtime metadata construction live in `src/JIT/Runtime/`. JIT assembly emitters, safepoint liveness analysis, and other x86-64 compilation machinery remain in `src/JIT/X86_64/`.

The move preserves the existing `Cangjie::JIT::X86_64` namespace and behavior. In particular, `JitMetadataBuilder` remains specific to x86-64 runtime frame and stack-map conventions even though it lives under `Runtime/`. An architecture-neutral metadata encoder was not introduced because this change is a relocation, not an ABI redesign.
