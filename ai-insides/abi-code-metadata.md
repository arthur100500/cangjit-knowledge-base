# [ABI INFO] Generated-code metadata

Scope: current x86-64 Linux JIT builder and managed runtime, inspected 2026-11-23. These are implementation formats, not stable public wire formats; native LLVM output and other architectures may differ. All offsets below refer to the JIT builder, not a universal Cangjie object layout.

```text
JIT allocation (schematic, not stack)
  entry-4: signed little-endian int32 relative to entry-4 ----+
  entry:   machine instructions                               |
  ...      alignment                                          v
           descriptor: fixed header, trace strings/dictionary
           stack map; optional exception table
```

`CompileFunction::CompileToAddress` emits a four-byte prefix, code, four-byte-aligned descriptor and data in one allocation, then rebuilds and publishes the final bytes using actual addresses. `BuildPrefix` computes `descriptor - (entry-4)` as a nonzero signed 32-bit displacement; descriptor must be four-byte aligned and within range. Example: prefix at `0x1000` and descriptor at `0x1100` encode `00 01 00 00`; add 0x100 to the prefix address, not the entry address. The stack's `[rbp-8]` contains `entry+9`, not this descriptor. `FrameInfo::GetFuncStartPC` recovers entry by subtracting 9. Resolver stubs have a separate emitter and own frame metadata.

The descriptor builder starts with seven little-endian 32-bit fields: at +0, offset to stack map; +4, code size; +8/+12/+16, offsets of name/directory/filename strings; +20, dictionary offset; +24, relative displacement from that field to exception table (zero if absent). It adds three zero bytes and a trace-format byte, then a dictionary header, compact strings, dictionary text and the stack map. These concrete fields describe this builder, not a guarantee for unrelated producers.

Stack-map encoding is bit-packed least-significant bit first. Its variable integers use a 4-bit value directly for 0–11; for larger values the 4-bit tag 12, 13, 14 or 15 indicates an 8-, 16-, 24- or 32-bit payload respectively. For instance 12 is tag 12 followed by the 8-bit payload 12, packed at the current bit position; it need not start on a byte boundary. The header records frame size, a zero field, a saved-register mask and offsets, row count and per-column widths. The builder byte-aligns the PC-row layout. Rows hold a 32-bit entry-relative PC and one-based indices into GC register, GC slot, line and derived-root tables; stack-register and stack-slot indices are included only when stack growth is enabled. Index zero denotes absence. Slot rows contain a 32-bit first offset and a bitmap stepping downward by 8 bytes. For example, roots at -16 and -32 have first offset -16 and bits 1,0,1. Slots must be aligned, duplicates are rejected, safepoint PCs must be unique and no greater than code size. Derived root sets, when present, correspond to base roots; they are not arbitrary additional stack words. Five zero bytes are appended for runtime bit-reader overread allowance.

At each recorded safepoint, the recorder computes live GC, stack and derived roots; the current function recorder supplies source line 0. Turning stack growth off discards the stack-root set and omits its columns. Ordinary JIT frames record no saved-register offsets in the five-entry frame array. Missing or invalid metadata is rejected rather than silently treated as an empty map. Exception table details are in [exceptions](abi-exceptions.md); the stack layout is in [stack frames](abi-stack-frames.md).

Sources: `cangjit/src/JIT/X86_64/JitMetadataBuilder.cpp` (`BuildPrefix`, `BuildStackMap`, `BuildExceptionTable`, `BuildDescriptor`); `cangjit/src/JIT/X86_64/Compilers/Function/CompileFunction.cpp` (`CompileToAddress`); `cangjit/src/JIT/X86_64/Compilers/Function/CompileFunctionStub.cpp` (`MakeResolverStub`); `cangjit/src/JIT/X86_64/Compilers/Context/SafepointRecorder.cpp` (`Record`); `cangjie_runtime/runtime/src/Common/StackType.h` (`FrameInfo::GetFuncStartPC`).
