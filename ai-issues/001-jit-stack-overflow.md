# JIT stack overflow can crash in runtime stack growth

Priority: P1

A deeply recursive JIT function crashed with SIGSEGV while the runtime was trying to throw a stack-overflow exception. The equivalent native execution completed. The cause and whether local-finalizer state contributes are not yet established.

## Evidence (2026-11-21)

The exact sources are in `unfinished/repros/stack-overflow/`: `package.cj` defines the native local-finalizer/GC package, `main.cj` is the failing 3,000-deep JIT case, and `native-check.cj` checks the same computation and finalizer count while returning 42 on success. Native `native-check.cj` exited 42. A 100-deep version of `main.cj` returned 101 in both modes. The 3,000-deep JIT run exited 139 and logged:

```text
SIGSEGV in MRT_UpdateUwContext
CJ_MCC_StackGrowStub
rt$ThrowImplicitException
MapleRuntime::ExceptionManager::StackOverflow
MapleRuntime::Mutator::FixExtendedStack
MRT_StackGrow
```

The stack trace repeated the stack-growth/implicit-exception sequence. Do not assume the crash is caused by the finalizer without isolating it.

## Reproduction

From the cangjit repository, with the development shell and an SDK able to load the JIT runtime:

```sh
repro=../cangjit-knowledge-base/unfinished/repros/stack-overflow
pkg=$(mktemp -d)
output/bin/cjc --experimental --enable-local-mode -Woff all "$repro/package.cj" \
  --output-type=dylib -o "$pkg/libcangjie-std-jit_final.so"
output/bin/cjc --experimental --enable-local-mode -Woff all "$repro/native-check.cj" \
  --import-path "$pkg" -L "$pkg" -l cangjie-std-jit_final -o "$pkg/native-check"
LD_LIBRARY_PATH="$pkg:$LD_LIBRARY_PATH" "$pkg/native-check"  # exit 42
# Make libcangjie-std-jit_final.so discoverable under $CANGJIE_HOME/runtime/lib/linux_x86_64_cjnative.
ulimit -c 0
LD_LIBRARY_PATH="$CANGJIE_HOME/runtime/lib/linux_x86_64_cjnative:$LD_LIBRARY_PATH" \
  build/build/bin/cjc --jit --experimental --enable-local-mode -Woff all \
  --import-path "$pkg" "$repro/main.cj"
```

The observed SDK was `/tmp/cangjit-static.MAyvzr/sdk`, with the package library symlinked into its runtime library directory. It is temporary and may no longer exist. Isolate plain recursion, stack-map relocation, and stack-overflow exception handling; then compare native and JIT at depths before and beyond stack growth, with and without the local reference and GC.
