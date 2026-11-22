# [REFACTOR] Consider a dedicated literal pool

Priority: P2

Consider a dedicated literal pool; preserve stable literal addresses, deduplication and runtime lifetime.

## Source snapshot

`src/JIT/X86_64/Compilers/Context/GlobalContext.h:107` (line from pre-refactor snapshot):

> // FIX: Unsure if it's good for global storage. Maybe introduce LiteralPool class

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution

`StringLiteralPool` owns the native-layout strings currently used for arithmetic exception messages. `GetOrCreate` deduplicates by content and keeps addresses stable until the pool is destroyed; it uses the existing runtime bindings to obtain the byte-array TypeInfo. `JitRuntime` owns the pool and outlives the `GlobalContext` JIT allocator, so generated code does not outlive its literal storage. Calls remain externally serialized.

This is not yet an implementation of arbitrary source string literals or mutable array literals. A real-runtime smoke checked deduplication, empty and embedded-NUL strings, and address stability after 512 distinct insertions. Native and JIT execution also agreed on overflow and division-by-zero exception messages.
