# How the lazy function stub preserves arguments and resolves a function

`src/JIT/X86_64/Compilers/Function/CompileFunctionStub.cpp` creates one resolver entry per supported signature and records a safepoint so GC and stack movement can find live arguments while compilation runs. The word `allocation` denotes the base returned by AsmJit's runtime allocator, not the executable entry: four bytes at the base are a metadata prefix and entry is base+4. The base is needed to release on failure.

Conceptual pseudocode (actual control transfer follows the native ABI):

```c
entry_stub(original_args) {
    save_argument_registers_and_make_runtime_frame();
    target = C2N_transition(ResolveAndPatch, context, record, caller_return_address);
    restore_argument_registers_and_frame();
    tail_jump(target); // original caller and arguments are preserved
}
ResolveAndPatch(context, record, caller_return_address) {
    target = resolve_or_compile(record); // abort on failure
    if (registered_call_site_matches_record(caller_return_address))
        patch_call_site_to(target);       // abort if patch fails
    return target;
}
```

The pure emitter `SaveArguments` establishes RBP, emits the entry+9 marker call, reserves aligned space, saves RDI, RSI, RDX, RCX, R8 and R9 at RBP-16 through -56 and XMM0–XMM7 at RBP-72 through -184. Incoming stack arguments stay in the caller's frame. `ResolveAndJump` sets up the resolver arguments, calls `CJ_MCC_C2NStub` (which removes its two pushed words), remembers RAX in R11, restores the saved integer and SIMD argument registers, restores RSP/RBP, then jumps to R11. The C2N return is a safepoint. There is no standalone restore emitter in this snapshot: restoration is part of `ResolveAndJump`.

`SupportedSignature` limits the stub to supported scalar/reference ABI types and records object-reference argument slots; stack-growth mode also records the indirect-return stack root where applicable. `MakeResolverStub` emits the prefix, frame and safepoint metadata, allocates code and metadata together, then writes the final relative prefix and metadata. Unsupported signatures or failed publication return zero; lazy resolution failures abort.
