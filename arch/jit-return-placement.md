# JIT return placement

Function compilation computes the existing `SystemVCallingConvention` parameter placement once and uses its `returnLocation` for direct return values, rather than hardcoding ABI return registers in the epilogue. The CHIR return value remains an address to be loaded before reading the result. Unsupported ABI classifications fail compilation. Indirect aggregate and generic returns remain unsupported until their storage and copy semantics are implemented; Unit, Nothing and Void retain their existing special handling.
