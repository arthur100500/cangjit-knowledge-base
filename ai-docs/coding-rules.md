# CangJIT coding rules (condensed)

1. Extract describable method parts into named private methods.
2. Guard clauses; keep the normal path flat.
3. Methods atomic, single responsibility.
4. Model real entities (e.g. `SystemVCallingConvention`), not abstract containers.
5. No unrealistic defensive checks; keep only bounds enforcing real ABI/encoding limits.
