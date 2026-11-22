# [TODO] Support dynamic auto-environment metadata and nested This

Concrete auto-environment dispatch exists, but allocation explicitly rejects runtime-generic environments. Implement it only with correct runtime TypeInfo and payload sizing; JIT-defined metadata is tracked in `052-jit-defined-typeinfo.md`.

`CHIR::Type::IsGenericRelated()` recursively recognizes generic parameters but not `This`. Closure conversion can insert `This` as an auto-environment type argument even though source syntax rejects `Array<This>`. A JIT-local recursive runtime-TypeInfo predicate must be applied consistently to TypeInfo construction, argument staging and dynamic allocation; changing only one call site can let a TypeInfo helper clobber already placed arguments.

Verify captured closures, generic environments, both method indices, native interop and GC.
