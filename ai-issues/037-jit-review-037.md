# [REFACTOR] Explain subtype traversal and cache

Priority: P2

Explain subtype traversal and cache; see ai-docs/jit-review-questions.md; investigate external subclass assumptions.

## Source snapshot

`src/JIT/X86_64/Compilers/Context/GlobalContext.h:74` (line from pre-refactor snapshot):

> // FIX: Idk whats going on here, provide explanation

This is an inventory/proposal, not a claim that the requested source change has been completed.

## Resolution and cross-package counterexample

The JIT no longer maintains a subtype graph. Ordinary class/interface virtual calls always request the selected method's outer TypeInfo, matching native **library** compilation. Auto-environment dispatch remains unchanged.

The following implementation was compiled as the shared library `libcangjie-std-outer_ti_smoke.so`, with the resulting `.cjo` imported by a separately compiled caller:

```cj
package std.outer_ti_smoke

public interface I { func get(): Int64 }
public class Box<T> <: I {
    let value: T
    public init(value: T) { this.value = value }
    public func get(): Int64 {
        if (value is Int64) { return 42 }
        return 1
    }
}
public func make(): I { Box<Int64>(42) }
```

The caller used `let value: I = make(); return value.get()`. An equivalent caller compiled into a shared library, invoked from a native executable, exited 42. Before the JIT change, the standalone JIT caller terminated with SIGSEGV (139); afterwards it returned 42. Separate precompiled nongeneric-interface, class-override and `Child <: Box<Int64>` inherited-method cases also returned 42 in both native and JIT execution; the inherited native caller was compiled in library mode.

**Native executable defect:** GDB on the native caller stopped in `Box<T>.get` with its hidden outer TypeInfo argument (`rsi`) equal to zero. The callee immediately dereferenced offset 48 of that null argument to obtain its generic arguments. `CGPkgContext::NeedOuterTypeInfo` uses only the current package's subtype map in executable mode, so the imported, nongeneric interface does not reveal the generic implementation in the shared library. Library-mode compilation passes the outer TypeInfo and returns 42. Fixing native executable code generation requires a separate change outside `src/JIT`; it was not changed here.
