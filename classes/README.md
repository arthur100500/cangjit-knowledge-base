# JIT class inventory

`classes.json` describes classes and structs defined under `cangjit/src/JIT`, including nested and translation-unit-local implementation types. It excludes forward declarations, external CHIR, runtime and AsmJit types, enums, aliases and free functions. The current implementation is the x86-64 JIT. The inventory describes source definitions rather than a guarantee that every implementation is selected at runtime.

The root object has a `classes` array. Each entry has:

- `id`: unique qualified name; `(anonymous namespace)` marks internal-linkage types.
- `name`: human-readable name.
- `description`: concise role grounded in the source.
- `source`: definition path relative to the cangjit repository root.
- `relations`: directed edges from this class to another documented class, each with a `target` ID and short `type` label. For example, `inherits` points from a derived class to its base, `owns` denotes held state, and `uses` denotes a source-level dependency. These edges are selective, not a complete call graph; external types are not targets.

`CompileFunction` is listed once at the header used by the implementation, `Compilers/Function/CompileFunction.h`. An older `Compilers/CompileFunction.h` declares the same qualified name with a different interface; it is not a separate class identity. Update the inventory and relationships when JIT definitions change.
