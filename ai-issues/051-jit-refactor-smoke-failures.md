# [TODO] Investigate expanded native/JIT smoke failures

During the 2026-11-22 refactor verification, the native compiler ran each standalone program below and exited 42; JIT execution failed during lazy compilation. No pre-refactor baseline was run for these programs, so this is not evidence that the refactor caused them.

## Exception: unsupported operand location

```cj
func fail(): Int64 { throw IllegalArgumentException("failure") }
main(): Int64 {
    try { return fail() } catch (_: IllegalArgumentException) { return 42 }
}
```

JIT: `JIT lazy compilation failed: unsupported operand location`.

## Float call: unsupported return type

```cj
func add(a: Float64, b: Float64): Float64 { a + b }
main(): Int64 {
    if (add(1.5, 2.5) == 4.0) { return 42 }
    return 1
}
```

Resolved: Float32/Float64 direct calls, arithmetic, comparisons, negation, stack slots and float-width casts are implemented. Native/JIT comparisons passed for this program, mixed integer/floating arguments with a spilled SIMD argument, NaN comparisons, Float32 arithmetic and Float32/Float64 casts. Float16 arithmetic, floating remainder and float/integer casts are still unsupported.

## Generic call: unsupported call

```cj
func identity<T>(value: T): T { value }
main(): Int64 {
    if (identity<Int64>(42) == 42) { return 42 }
    return 1
}
```

JIT: `JIT lazy compilation failed: unsupported function call`.

The exception constructor takes a by-value `String`; the generic `identity` uses an indirect generic-value return and argument. Both require aggregate/generic value storage, copying and GC metadata, which remain unsupported. A separate `Exception()` throw/catch and generic-TypeInfo forwarding both passed native/JIT comparisons.

Permanent single-file regression fixtures live in `cangjit-tests/tests/`. From `cangjit-tests`, run:

```sh
dune exec cangjit-tests -- run exception.cj float_calls.cj float_nan.cj
```

The full `cangjit-tests` suite on 2026-11-23 passed seven fixtures. `output.cj` failed in JIT lazy compilation with `unsupported operand location`; native execution printed `Hello from Cangjie`. Its exact failing operation has not been isolated.
