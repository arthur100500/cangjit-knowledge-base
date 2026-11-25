# JIT integer utility

Decision: move integer type-width lookup and register normalization from `RegisterUtils` into a dedicated `IntegerUtil`, and update all JIT call sites to use it.

Alternatives considered: leave the methods on `RegisterUtils`, or add conversion behavior to the general location-move helper. A dedicated utility gives integer semantics a clear owner; location movement remains separate from typed normalization.

The utility preserves existing behavior: `IntegerWidth` returns zero for non-integer types; `NormalizeInteger` sign-extends or zero-extends sub-64-bit values in a 64-bit GP register and does nothing at 64 bits. Register mapping remains in `RegisterUtils`.
