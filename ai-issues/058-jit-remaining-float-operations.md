# [TODO] Complete floating-point operations

Float32/Float64 direct calls, scalar arithmetic/comparisons, negation, stack storage and float-width casts were added and compared against native execution. Float16 arithmetic, floating remainder and conversions between integers and floating-point values remain unsupported.

Implement the remaining operations using native semantics, particularly NaN, signed zero, infinities, rounding, overflow and conversion boundaries. Verify native/JIT behavior rather than merely accepting the CHIR operations.
