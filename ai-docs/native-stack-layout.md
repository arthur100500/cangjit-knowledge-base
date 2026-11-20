# Native stack layout for Cangjie (AOT `cangjie-native`, x86-64 Linux)

Question answered: what does a Cangjie-native stack frame look like at machine
level, and what extra ABI slots does the runtime require beyond plain System V?

Sources: `cangjit/third_party/llvmPatch.diff` (patched LLVM backend),
`cangjie_runtime/runtime/src/` (unwinder). All paths below are relative to
`cj-comp/main/`. Related research: `main/exceptions.md`, `main/jit_arch.md`.

## Frame picture

Every function compiled with `gc "cangjie"` (all Cangjie functions with a body —
`src/CodeGen/Utils/CGUtils.h:82-85`) gets a frame of this shape:

```
high  arg7+ ...            incoming stack args (System V, [rbp+16], [rbp+24], ...)
      return address       [rbp+8]
      saved rbp            [rbp+0]   <- frame address (fa), rbp-chain node
      funcStart+9          [rbp-8]   PUSHPC64 slot ("StorePC")
      (.Lmethod_desc ptr)  [rbp-16]  MachO only, non-leaf functions
      callee-saved regs              pop locations recorded in stackmap
      locals/spills/allocas
      outgoing arg area              16-byte aligned before calls
low   ...
```

## Key ABI elements

### PUSHPC64 — function-start PC slot

- Emitted in the prologue by patched `X86FrameLowering::emitPrologue`
  (`llvmPatch.diff:59731-59821`, hunk `@@ -1733,6 +1780`): right after the
  callee-save pushes, `BuildMI(..., X86::PUSHPC64)`.
- `PUSHPC64` lowers to `call $nextInst; nextInst:` (pseudo `Ii64<0xE9>`,
  diff:60237; MC expansion diff:60867-60899). The `call` pushes the return
  address = `funcStart + 9` (5-byte call + 4) and the "call" never returns into
  anything else — execution continues at the label.
- On MachO a second slot is pushed: `lea r10, .Lmethod_desc.<PACKAGEID>_<fn>`
  then `push r10` (non-leaf functions; leaves push RIP instead) — compact
  unwind can't recover it otherwise.
- Runtime recovery: `FrameInfo::GetFuncStartPC()`
  (`cangjie_runtime/runtime/src/Common/StackType.h:317-325`) =
  `*(u64*)(fa-8) - START_PC_OFFSET_IN_STACK` where the offset is 9 on x86-64,
  12 on arm32, 0 on aarch64.
- The prologue also accounts for this slot in frame-size arithmetic
  (`CJAdjustSize`, diff:59760+), including the red-zone case, so the slot is
  never optimized away; frame size overflow is checked
  (`checkCangjieStackSize`, diff:59825).

### FuncDesc — method descriptor before function start

- 4 bytes *preceding* the function entry hold a `DataRefOffset32<MFuncDesc>`
  (`MFuncdesc.inline.h:47-52`, `START_PC_OFFSET = 4` at `MFuncdesc.h:46`):
  `GetFuncDesc(startPC) = *(DataRefOffset32*)(startPC - 4)->GetDataRef()`.
- `MFuncDesc` carries: EH-table (LSDA) pointer, stackmap pointer, name/file
  dictionaries (`cangjie_runtime/runtime/src/ObjectModel/MFuncdesc.h`).
- On macOS the descriptor is fetched from the stack slot instead
  (`GetFuncDesc(FrameAddress*)` at `MFuncdesc.inline.h:41-44`).
- Consequence: the 4 bytes before a managed function must not be executed or
  shuffled; JIT code that wants runtime unwinding must reproduce this exact
  prefix scheme.

### Frame pointer & unwinding

- Managed frames keep rbp; the runtime unwinder does **not** use DWARF CFI at
  unwind time — it walks the rbp chain directly:
  `MachineFrame::UnwindToCallerMachineFrame`
  (`cangjie_runtime/runtime/src/UnwindStack/MachineFrame.cpp:178-189`):
  `caller.fa = fa->callerFrameAddress; caller.ip = fa->returnAddress`.
- Each walked frame is classified (`StackInfo::AnalyseAndSetFrameType`,
  `UnwindStack/StackInfo.cpp:96-156`): MANAGED / RUNTIME / N2C_STUB / C2N_STUB /
  C2R_STUB / SAFEPOINT / STACKGROW / EXCLUSIVE / NATIVE (+ INTERPRETER_*).
  Frame-type detection is by address ranges and stub markers, not metadata
  attributes.
- Callee-saved register restore values are *not* encoded in unwind info: the
  stackmap header (VarInt-encoded callee-save bitmap + slot offsets,
  `Exception/EhFrameInfo.h:82-164`) is read from the FuncDesc when the
  context must be rebuilt.
- Epilogue requirement: an `_epilogue` label is emitted before the first
  callee-save pop and SP is reloaded from BP when the frame pops stack args
  (`llvmPatch.diff`, `AsmPrinter.cpp:1556-1574`, `X86MCInstLower.cpp:3206-3233`).
- Stackmaps double as GC safepoint records; `CJ_MCC_ThrowException` call sites
  are recorded in the stackmap section (`X86MCInstLower.cpp:3411-3421`).

## Contrast with the in-tree JIT (`cangjit/src/JIT`)

The JIT (`TrivialStackRegalloc`, `MakePrologue` in
`src/JIT/X86_64/Compilers/Function/CompileFunction.h`) emits plain
`push rbp; mov rbp,rsp; sub rsp,N` frames: no PUSHPC64 slot, no FuncDesc, no
LSDA, no stackmap, no personality. A JIT frame is therefore invisible to the
runtime unwinder — it would be classified MANAGED but resolve no FuncDesc/LSDA
(`ResolveProcInfo` bails at `FrameInfo.cpp:24-29`). Any plan to mix JIT frames
with AOT/runtime unwinding must reproduce the layout above.
