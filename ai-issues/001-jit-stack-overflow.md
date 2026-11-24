# JIT stack overflow can crash in runtime stack growth

Priority: P1

A deeply recursive JIT function crashed with SIGSEGV while the runtime was trying to throw a stack-overflow exception. The equivalent native execution completed. The cause and whether local-finalizer state contributes are not yet established.

## Evidence (2026-11-21)

The exact sources are in `native/repros/stack-overflow/`: `package.cj` defines the native local-finalizer/GC package, `main.cj` is the failing 3,000-deep JIT case, and `native-check.cj` checks the same computation and finalizer count while returning 42 on success. Native `native-check.cj` exited 42. A 100-deep version of `main.cj` returned 101 in both modes. The 3,000-deep JIT run exited 139 and logged:

```text
SIGSEGV in MRT_UpdateUwContext
CJ_MCC_StackGrowStub
rt$ThrowImplicitException
MapleRuntime::ExceptionManager::StackOverflow
MapleRuntime::Mutator::FixExtendedStack
MRT_StackGrow
```

The stack trace repeated the stack-growth/implicit-exception sequence. Do not assume the crash is caused by the finalizer without isolating it.

## Plain-recursion isolation (2026-11-22)

A standalone 3,000-deep integer recursion with no local object, finalizer or explicit GC exited 42 natively. JIT execution failed with `free(): invalid size` after runtime shutdown began. This isolates the failure from local-finalizer and explicit-GC behavior; it does not by itself identify the corrupted allocation.

```cj
func deep(n: Int64): Int64 {
    if (n == 0) { return 0 }
    return deep(n - 1) + 1
}
main(): Int64 { if (deep(3000) == 3000) { return 42 }; return 1 }
```

JIT prologues and lazy resolver stubs currently have no Cangjie stack-limit check. Native code checks the limit and invokes the runtime growth stub with a precise stack map. Adding a prologue-only check is insufficient: callers also reserve and write outgoing argument/type-info areas before entering the callee. A complete fix needs checks for those reservations, precise prologue roots and relocation metadata, and the disabled-growth overflow path.

## Reproduction

From the cangjit repository, with the development shell and an SDK able to load the JIT runtime:

```sh
repro=../cangjit-knowledge-base/native/repros/stack-overflow
pkg=$(mktemp -d)
output/bin/cjc --experimental --enable-local-mode -Woff all "$repro/package.cj" \
  --output-type=dylib -o "$pkg/libcangjie-std-jit_final.so"
output/bin/cjc --experimental --enable-local-mode -Woff all "$repro/native-check.cj" \
  --import-path "$pkg" -L "$pkg" -l cangjie-std-jit_final -o "$pkg/native-check"
LD_LIBRARY_PATH="$pkg:$LD_LIBRARY_PATH" "$pkg/native-check"  # exit 42
# The JIT searches the import path for the package shared library.
ulimit -c 0
LD_LIBRARY_PATH="$CANGJIE_HOME/runtime/lib/linux_x86_64_cjnative:$LD_LIBRARY_PATH" \
  output/bin/cjc --jit --experimental --enable-local-mode -Woff all \
  --import-path "$pkg" "$repro/main.cj"
```

The original observed SDK was `/tmp/cangjit-static.MAyvzr/sdk`, with the library symlinked into its runtime library directory. The JIT now also searches configured import/link paths. Compare stack-map relocation and stack-overflow exception handling at depths before and beyond stack growth, with and without the local reference and GC.
