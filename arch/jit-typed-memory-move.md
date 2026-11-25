# Typed JIT memory moves

Decision: `MemoryUtils::Move` handles typed transfers across the current `Location` variants—GP registers, SIMD registers, local stack slots, and incoming stack slots. `CompileFunction::SaveParameter` supplies the ABI source location, register-allocation destination, and parameter type, then delegates the transfer.

Use existing `RegisterUtils`, `StackFrameUtils`, and `TypeUtils` behavior rather than duplicating register mapping, stack offsets, or integer width rules. `TypeWidth` includes Float16 and Rune widths; preserve floating bit patterns (including Float16) and normalize narrow integer values using width and signedness when materialized in the JIT's 64-bit representation. Keep `SaveParameter` focused on resolving the two locations and type.

Assume valid allocations and placements. Do not add defensive checks for impossible states; retain only handling required for unsupported location/type cases and assembler errors. The alternative—keeping type-specific transfer logic in `SaveParameter`—duplicates behavior and leaves `Move` too limited for reuse.
