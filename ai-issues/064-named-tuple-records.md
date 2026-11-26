# Replace domain tuples with named records

Priority: P2

User requested repository-wide replacement of tuple types that represent domain records with structs containing meaningful named fields. Inventory is in progress; no implementation is authorized yet because new structs require Gate 1 contracts and Gate 2 shape approval.

## Evidence (2026-11-24)

`rg -n '\b(tuple|make_tuple|tie)\s*[<(]' src include demangler unittests` finds concrete record tuples in AST, diagnostics, CHIR operation tables, CodeGen, driver option ordering, parsing, incremental compilation, JIT metadata/liveness/finalizers, lexer/parser token decomposition, mangling/demangling, semantic checking and Unicode normalization.

Confirmed JIT records: `JitMetadataBuilder::Safepoint`, `JitMetadataBuilder::CallSite`, `LocalFinalizerSite`, `SafepointRoots`. Confirmed CodeGen records: enum auxiliary information, IEEE754 nonfinite-check information, overflow-check blocks, aggregate constant serialization, imported metadata partition entries.

Keep generic tuple utilities (`Vec2Tuple`, variadic handler storage, type-pack indexing), transient iterator grouping and `std::tie` comparisons. Language-level Cangjie tuple types are not C++ record representations and remain unchanged.

Preserve metadata encodings, tuple ordering semantics, ownership and moves, reference members where used, and finalizer null-site conventions. Migrate all callers rather than retaining tuple compatibility shims.

Knowledge-base `git pull --rebase` failed because pre-existing unstaged changes are present. No stash or reset attempted. No code changed or verification run at discovery stage.
