# [TODO] Implement aggregate and generic-value ABI

Generic values and aggregate arguments/returns require addressable storage, native Cangjie indirect returns, aggregate copies, struct-reference base pointers, and accurate GC maps. Runtime-sized generic values also need correct size and reference-aware copying. The current scalar JIT representation rejects these cases.

Two native-success/JIT-failure examples are recorded in `051-jit-refactor-smoke-failures.md`: a `String` argument to an exception constructor and `identity<Int64>` through a generic value parameter/return. A no-argument exception and generic TypeInfo forwarding work; they do not establish aggregate-value support.

Verify JIT-to-native and native-to-JIT calls, nested managed references across GC, and register/stack argument boundaries. Do not assume the C aggregate ABI is the Cangjie ABI.
