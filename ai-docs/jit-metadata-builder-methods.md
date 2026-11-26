# Beginner's guide to `JitMetadataBuilder`

`src/JIT/Runtime/JitMetadataBuilder.{h,cpp}` collects facts about one generated x86-64 function and serializes them into the Cangjie runtime's metadata format. The generated machine code alone is insufficient for garbage collection, stack walking, source-level stack traces, and exception handling: the runtime needs a map from machine-code positions to live roots and handler locations. The builder is the compiler-side producer of that map; it is not a collector, an exception dispatcher, or the runtime itself.

## A few words first

- **PC / offset:** a position in machine code. Builder offsets are relative to the function's entry, not process-wide addresses. A PC identifies where execution is when the runtime inspects a frame.
- **Frame:** the function's stack memory and saved-register context. The x86-64 JIT uses RBP-relative stack-slot offsets.
- **Root:** a pointer the garbage collector must find and potentially update because it keeps an object alive. A **derived root** is a pointer into an object (for example, a field address); the runtime needs its base pointer too.
- **Safepoint:** a compiler-designated point where runtime work such as GC may inspect a paused function. Its map describes roots valid at that exact code position.
- **Landing pad / call site:** generated exception-handler code and the machine-code region whose exceptions should transfer to it.
- **Descriptor:** the runtime-format byte record describing a generated function. The builder also emits a four-byte link immediately before the function entry so the runtime can find the descriptor.

## Public API and stored state

The class is `final`, scoped to `Cangjie::JIT::X86_64`, and deliberately encodes x86-64 runtime conventions. Its constructor takes `stackGrowth` plus optional function name, source directory, and filename. The strings support stack traces. `stackGrowth` must agree with the runtime's already configured mode; it does not turn stack growth on or off.

`Roots` holds a 32-bit register mask and a list of signed RBP-relative byte offsets. A set bit names a general-purpose register according to the runtime's x86 numbering. Slots must be multiples of eight. `DerivedRoots` associates one `Roots` record with each GC root, in the documented order: GC general registers in increasing bit order, then GC slots in descending offset order. XMM registers cannot be derived-pointer bases.

Internally, the builder retains a frame record, safepoints, landing pads, and call sites. Calls to the `Record...` methods append or replace this input state; `Build` serializes it. Build helpers are private implementation steps.

## Each method

### Constructor

`JitMetadataBuilder(bool stackGrowth, std::string name, std::string directory, std::string filename)`

Stores the runtime-mode assumption and optional trace strings. The strings are moved into the builder. It does not query the runtime or validate/encode the data yet.

### `RecordFrame`

`void RecordFrame(uint32_t frameSize, const std::array<uint32_t, 5>& savedOffsets)`

Stores the function's frame size and the frame offsets at which the five tracked callee-saved registers (RBX, R12, R13, R14, R15) were saved. Each offset is a positive count of eight-byte slots; `UINT32_MAX` means that register was not saved in a frame slot. It also marks frame information as present, which `Build` requires.

Why this matters: the runtime unwinder/stack walker needs to understand frame layout and recover saved registers. The ordinary compiler currently records all five as unsaved; the resolver stub also records a fixed frame size. Those are caller decisions, not defaults inferred by this method.

### `RecordSafepoint`

`void RecordSafepoint(uint32_t pc, uint32_t gcRegisters, std::vector<int32_t> gcSlots, uint32_t stackRegisters, std::vector<int32_t> stackSlots, uint32_t line, DerivedRoots derived)`

Adds one safepoint. It records its code-relative PC, GC roots in registers and RBP-relative slots, optional stack-growth roots in registers and slots, source line, and optional derived-pointer bases. Slot vectors and derived data are moved into storage.

The compiler's liveness analysis determines which values are live at a safepoint; `SafepointRecorder` turns that analysis into this API's representation. This method itself does not prove that a register contains a pointer—it trusts the producer, then the serializer validates representational constraints. Stack roots are only accepted when the builder was constructed with stack growth enabled.

### `RecordLandingPad`

`size_t RecordLandingPad(uint32_t offset, std::vector<uintptr_t> catchTypes)`

Adds generated handler code at the given code-relative offset and returns its zero-based index in the builder. A null catch-type pointer represents catch-all; an empty type list represents cleanup code. The returned index is a handle for `RecordCallSite`, not a machine address. The method stores the catch-type list by move; `Build` later encodes its exception-table entries.

### `RecordCallSite`

`void RecordCallSite(uint32_t start, uint32_t length, size_t landingPad)`

Adds the protected code range `[start, start + length)` and the landing-pad index that handles exceptions raised in it. The record operation does not immediately check bounds, overlap, or whether the index exists. `Build` sorts call sites and validates them. A zero-length range, overlap, out-of-function range, invalid landing-pad index, or unusable landing-pad offset causes a build error.

### `Build`

`BuildResult Build(uintptr_t metadataAddress, uintptr_t codeAddress, uint32_t codeSize) const`

The main operation. It returns either `EncodedMetadata { descriptor, prefix }` or an error string inside the project's `Result` type. It does not allocate executable memory or write either byte array anywhere.

In order, it:
1. Computes the four-byte prefix linking the code entry to the descriptor and checks addresses, size, frame presence, alignment, and signed 32-bit reach.
2. Copies and sorts safepoints by PC and call sites by range/handler, leaving the builder's recorded input order/state unchanged.
3. Validates call-site and trace-string constraints.
4. Encodes the stack map.
5. Encodes the optional exception table.
6. Builds the descriptor that contains the trace strings, stack map, and exception table.

Errors are returned rather than asserted. Callers must check the result and handle failure.

## Private encoding helpers

### `BuildPrefix`

Computes the signed relative distance from the prefix location (`codeAddress - 4`) to `metadataAddress`, then emits its four bytes little-endian (least significant byte first). The runtime can locate the descriptor without an absolute pointer in executable code. The descriptor must be four-byte aligned and the displacement must fit signed 32-bit range. A zero displacement is rejected because the descriptor cannot overlap the prefix. `codeSize` must be nonzero and a frame must have been recorded.

This is why callers use *final executable addresses*, not just the writable memory alias: the displacement must be meaningful to runtime execution. `Build` can also be called once with provisional addresses to find descriptor size; callers then rebuild after code allocation and write the final prefix and descriptor.

### `ValidateMetadataInputs`

Checks sorted call sites: nonzero length, non-overlap, end within `codeSize`, a valid landing-pad index, and a landing-pad offset strictly inside the function and not zero. It also rejects commas or embedded NULs in name/directory/filename because those strings are represented through a comma-delimited dictionary with NUL-terminated references.

### `BuildStackMap`

Converts the sorted safepoints and recorded frame information into the runtime's compact bit-packed stack-map byte stream.

It first checks PCs are within the function and unique, forbids stack roots when stack growth is disabled, sorts slot offsets descending, requires eight-byte alignment and no duplicate slots, and checks that derived-root entries match the count/order of GC roots. It then builds shared tables for register masks, slot bitmaps, source-line values, and derived-root pairs; each safepoint row holds the PC plus one-based table indices (zero means no entry). Stack-root table indices/columns are present only for stack-growth mode.

The serializer chooses the number of bits required for each index/value, uses compact variable-width integer headers for table counts and frame fields, and writes fields least-significant-bit first. A slot bitmap represents eight-byte positions relative to its first/highest offset. It adds five zero bytes at the end because the runtime's bit reader may read up to four bytes past the last meaningful field. These bytes are defensive padding, not extra roots.

The runtime consumes this information while examining a managed frame at a safepoint: it can identify pointer-bearing registers/slots, follow derived pointers through their bases, and account for stack-growth roots. It is metadata about machine state, not a snapshot of values; live values remain in the stopped thread's registers and stack.

### `BuildExceptionTable`

Encodes sorted call sites in a compact exception-handling (LSDA-style) table. Call-site start, length, landing-pad offset, and action are ULEB128 (unsigned base-128 variable-length integers). Catch actions refer to a type table; cleanup-only entries have no catch action. Catch types are emitted as pointer-sized values in reverse order as required by this encoding. More than 255 encoded type entries fails.

When there are no call sites, it returns an empty byte vector, so the descriptor has no exception table. This method constructs lookup data; runtime exception machinery later uses the current PC and type/action entries to choose a handler or cleanup landing pad.

### `BuildDescriptor`

Assembles the final descriptor bytes. The first seven 32-bit little-endian words describe total descriptor length, code size, name/directory/filename offsets, dictionary location, and exception-table offset. Stack-trace flags, a dictionary and encoded strings follow; the bit-packed stack map follows the trace-string area, and optional exception-table bytes come after it. Offsets are relative to the descriptor start. Size is checked against the signed-offset limit before appending large sections.

The runtime follows these offsets to interpret the descriptor. It can recover source-level function/file information for traces, locate stack-map records for GC and stack inspection, and locate exception call-site/type/action data.

## How the result reaches the runtime

For ordinary functions, `CompileFunction::Publish` records the frame, calls `Build` once with provisional addresses to determine descriptor size, embeds those bytes in the code allocation, asks AsmJit for the final executable allocation, then calls `Build` again using the real code and metadata addresses. It writes the final descriptor and four-byte prefix into the allocation. The resolver-stub path follows the same two-build pattern. Thus the builder produces bytes; the host/compiler is responsible for allocation, final-address patching, writing, lifetime, and error cleanup.

At runtime, the entry's preceding four bytes lead to the descriptor. Runtime stack walking/GC use frame and safepoint data; stack traces use the strings; native exception handling uses call-site, landing-pad and catch-type data. `JitMetadataBuilder` does not register a separate object or keep allocations alive: caller ownership and code lifetime must keep both code and descriptor readable.

## Sources

- `src/JIT/Runtime/JitMetadataBuilder.h` and `.cpp`: API contract, validation, byte encodings.
- `src/JIT/X86_64/Compilers/Function/CompileFunction.cpp::Publish`: ordinary-function metadata publication.
- `src/JIT/X86_64/Compilers/Context/SafepointRecorder.cpp::Record`: producer of safepoint metadata.
- `src/JIT/X86_64/Compilers/Context/ExceptionLandingEmitter.cpp`: landing-pad and call-site producers.
- `src/JIT/X86_64/Compilers/Function/CompileFunctionStub.cpp::MakeResolverStub`: resolver-stub publication.
- `ai-docs/abi-stack-frames.md` and `ai-docs/jit-metadata-layout.md` in the knowledge base: related frame and byte-layout notes.
