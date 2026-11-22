# CangJIT coding rules

Apply these rules when writing or refactoring code:

1. **Extract named private methods.** When a part of a method can be described by a single phrase, give that operation a descriptive private method, such as `FindUserMain` or `ValidateUserMain`.
2. **Use guard clauses.** Keep the normal path flat; handle exceptional and completed cases with early returns, continues, or breaks instead of deep nesting.
3. **Keep methods atomic.** Apply single responsibility: each method should perform one cohesive operation.
4. **Model real entities.** Design classes around actual concepts, not abstract containers for organizing code. For example, represent the System V calling convention as a `SystemVCallingConvention` object implementing a common calling-convention interface, rather than a `CallingConvention` class with a `GetSystemVCallingConvention` method.
5. **Avoid unrealistic defensive checks.** Do not guard against machine-size overflow in compiler-owned counts or valid JIT code addresses when reaching it would require impossible allocations. Keep bounds that enforce actual ABI or instruction-encoding limits.
