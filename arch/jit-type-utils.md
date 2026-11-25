# JIT type utilities

Decision: centralize JIT type-width queries and integer normalization in `TypeUtils`; keep register mapping in `RegisterUtils` and location movement in `MemoryUtils`.

`IntegerWidth` retains integer-only semantics. `TypeWidth` returns representation widths for Boolean (8), integers, pointer-like values (64), Float32 (32), and Float64 (64), or zero for unsupported types. `IsFloating` recognizes Float32 and Float64. `NormalizeInteger` retains its existing sign/zero-extension behavior.

Alternatives considered: leave type classification split among compilers, or keep only integer-specific helpers in `IntegerUtil`. `TypeUtils` owns common type-level queries; caller-specific support checks and the local-reference policy in `CompileBlock.cpp::ScalarWidth` remain at their call sites. `IsPointerLike` was identified as a future candidate, not part of this change.
