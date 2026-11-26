# JIT function metadata representation

Decision: the per-function JIT metadata is represented by the `FunctionMetadata`
class in `src/JIT/Runtime/FunctionMetadata.h/.cpp`, with a `Serialize` method
that encodes it into the runtime descriptor, stack map, exception table and
code prefix. It replaces `JitMetadataBuilder` (class) and `Build` (method);
the byte format is unchanged.

## Alternatives considered

- Keep `JitMetadataBuilder` as-is: rejected. The name described an operation,
  not the represented object; the user preferred an object representation
  ("FunctionMetadata" with all fields plus a serialize method).
- A separate `MetadataPublisher` class encapsulating the two-phase
  provisional/final publication pipeline shared by `CompileFunction` and
  `MakeResolverStub`: proposed first and rejected by the user in favor of the
  data-object shape. The publication pipeline remains duplicated at the two
  call sites (tracked in ai-issues/065).
- Reusing an existing type from elsewhere: scouted and none exists.
  - `cangjie_runtime/runtime/src/StackMap/` is decoder-only
    (`CompressedStackMapEntry::Build*` read the bit-packed rows; no writer).
  - AOT production lives in the LLVM patch (`CJMetadataInfo::emitStackMaps` →
    `StackMaps::emitCangjieStackMaps(MCStreamer&)`), fused to MCStreamer and
    `.cjo` sections; not callable from the JIT.

## Contract (accepted Gate 1)

Fields: `stackGrowth`, `frameSize`, `savedOffsets[5]`, `safepoints`,
`landingPads`, `callSites`, `name`/`directory`/`filename`.
Methods: `RecordFrame`, `RecordSafepoint`, `RecordLandingPad`,
`RecordCallSite` (unchanged signatures; `SafepointRecorder` and
`ExceptionLandingEmitter` fill the object during codegen), and
`Serialize(metadataAddress, codeAddress, codeSize) -> Result<EncodedMetadata,
std::string>` with `EncodedMetadata{descriptor, prefix[4]}`.

Private `Build*` helpers were renamed to `Encode*` (`EncodePrefix`,
`EncodeStackMap`, `EncodeExceptionTable`, `EncodeDescriptor`) to avoid a
build/serialize naming collision. Accessor renamed
`FunctionContext::GetMetadataBuilder` → `GetMetadata`, member
`metadataBuilder` → `metadata`.

## Format contracts any change must honor

- `cangjie_runtime/runtime/src/StackMap/CompressedStackMap.h` +
  `StackMapTable.h` decode the stack-map bytes (5-byte over-read pad,
  byte-aligned 32-bit PC rows matching LLVM).
- AOT parity: `emitCangjieStackMaps` in `third_party/llvmPatch.diff` emits the
  same wire format.
- Two-phase publication invariant: the provisional and final `Serialize` must
  produce identical descriptor sizes (callers verify before patching).

## Binary encoding helpers (accepted Gate 2)

`src/JIT/Runtime/BinaryUtils.h/.cpp` provides primitive byte encoding only:
`AppendU32LE`, `AppendU64LE`, `PatchU32LE`, and `AppendULEB128`, plus
`BinaryUtils::BitWriter` (`WriteBits`, `GetBitOffset`) for LSB-first bit fields.
`FunctionMetadata` retains format-specific layout and compact stack-map varint
rules; its `writeBits`, `uleb`, and `put32` lambdas are replaced by these APIs
and a named `WriteStackMapVarUInt` helper. `PatchU32LE` fails for invalid spans;
it never grows the output. The byte format must remain identical.
