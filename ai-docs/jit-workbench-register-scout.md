This scout inventories hard-coded workbench registers in the x86-64 JIT and evaluates point-aware scratch selection.

## Findings

The scan covered `src/JIT/X86_64` for direct `asmjit::x86` register operands and scratch arguments to `MemoryUtils`.

- Value computation selects scratch registers directly throughout `Compilers/Expression/` and `Compilers/Function/`: e.g. `CompileBlock.cpp::CompileLoad` uses RCX for the loaded address and RAX for the loaded scalar; `CompileBinaryExpression.cpp` uses RAX/RCX as operands; unary/cast/branch paths mostly use RAX, with RCX for a second operand or bounds.
- ABI and instruction-fixed registers are separate from generic scratch choices: RDI/RSI/RDX/RCX/R8/R9 and XMM0–XMM7 carry System V arguments; RAX/RDX carry return or instruction-specific values; R11 is used for indirect calls and resolver jumps.
- `MemoryUtils` APIs already accept explicit GP targets/scratch registers (`LoadValue`, float load/store, `Move`); `Move` documents that scratch is clobbered and must not alias a live source. Some high-level callers still hard-code those registers.
- `TrivialStackRegalloc::Allocate` assigns every value to `Location::Stack`. `RegisterAllocation` exposes value locations and stack slots, but not physical register occupancy or a free-register query. `Liveness` exposes `GetLiveBefore/After(expression)`, but the current allocator does not use that data to allocate GP or SIMD registers.
- Therefore, the proposed invariant “RegAlloc guarantees at least two registers are free” is not currently implemented. In this allocator, values occupy stack slots; safe scratch selection still has to respect fixed instruction operands, ABI roles, and registers already in use by the emitted sequence.
- `GPRegisterType` includes all x86 GP registers; `RegisterUtils::Get64BitRegister` excludes only RBP/RSP. There is no corresponding general-purpose SIMD register pool API; `GetArgumentSimdRegister` only maps the eight argument registers.

## Recommendation

Do not add `GetWorkbenchRegister` to `MemoryUtils`: register policy is not memory movement. Introduce a register-selection component at the allocation/codegen boundary, and make generated operations state their constraints explicitly.

A safer API shape is a small per-expression scratch scope (or allocator query) that accepts register class, the current expression/live set, and an explicit exclusion/required-register set, then returns a lease/result for a candidate. Separate GP and SIMD candidate pools; keep ABI-reserved/fixed registers out unless the operation requests them. The scope tracks leases so two scratch requests in one sequence cannot silently alias. Return failure when the class-specific pool is exhausted; do not rely on a global “two free registers” promise.

For the current stack-only allocator, the first useful step is centralizing deterministic scratch pools and explicit caller exclusions. When physical register allocation is introduced, selection can additionally reject registers holding values live at the expression point using `Liveness::GetLiveBefore/After` and `RegisterAllocation::GetLocation`. Liveness alone is insufficient: each operation must also declare implicit/fixed operands, call clobbers, and scratch values live across subsequent instructions.

## Sources

- `src/JIT/X86_64/RegisterAllocation/TrivialStackRegalloc.cpp`: every value gets `Location::Stack`.
- `src/JIT/X86_64/RegisterAllocation/RegisterAllocation.{h,cpp}`: locations and allocation slots; no free-register query.
- `src/JIT/X86_64/RegisterAllocation/Liveness.{h,cpp}`: point-specific live-before/live-after bitmaps.
- `src/JIT/X86_64/Location.h`, `Utils/RegisterUtils.{h,cpp}`: register and location representations.
- `src/JIT/X86_64/Utils/SystemVCallingConvention.cpp`: argument/return register assignments.
- `src/JIT/X86_64/Utils/MemoryUtils.{h,cpp}`: explicit targets/scratch and Move clobber contract.
- `src/JIT/X86_64/Compilers/Function/CompileBlock.cpp::CompileLoad`, `Compilers/Expression/{CompileBinaryExpression,CompileNumericCast,CompileUnaryExpression}.cpp`, `Compilers/Context/{TypeInfoEmitter,LocalFinalizers}.cpp`: representative direct register choices.
