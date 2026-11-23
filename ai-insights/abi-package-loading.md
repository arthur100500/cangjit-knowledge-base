# [ABI INFO] Package, symbol and code loading

Scope: current checked-out `cangjit` and `cangjie_runtime` sources, 2026-11-23, Linux x86-64. Native image loading and x86-64 JIT code publication are distinct mechanisms. Repository-relative paths below are prefixed with the repository name. Filename rules and lookup order are implementation details, not a cross-version package ABI.

## Loading an image is not just resolving a symbol

```text
host / JIT
   | dlopen(runtime, RTLD_NOW | RTLD_GLOBAL), bind runtime exports
   | InitCJRuntime if owner
   v
LoadCJLibraryWithInit(path)
   |-- LoadCJLibrary --> runtime loader / platform loader
   |-- InitCJLibrary --> RunCJTask(MRT_CJLibInit, path) [Linux]
   |                    --> image global initialization functions
   v
FindCJSymbol(path, mangled_name) --> address, or null
```

`cangjie_runtime:runtime/src/CangjieRuntimeApi.cpp` (`LoadCJLibraryWithInit`, `InitCJLibrary`, `FindCJSymbol`, `UnloadCJLibrary`) loads an image then initializes it. If initialization fails, the wrapper asks the loader to unload it and reports an error. On Linux, initialization is submitted as a managed task, waited for and its handle released. `cangjie_runtime:runtime/src/Loader/CjFileLoader/CjFileLoader.cpp` (`LibInit`, `DoInitImage`) obtains the image's global initializer addresses and invokes each non-null one through `ExecuteCangjieStub`; a pending exception makes initialization fail. Thus successful OS loading alone does not establish initialized Cangjie package state. The OHOS and iOS conditional paths differ.

`CJFileLoader::LoadCJLibrary`, `FindSymbol`, and `UnloadLibrary` track or look up loaded handlers by basename; different paths with the same basename cannot safely be treated as distinct independent images by this interface. `FindCJSymbol` takes the library name and actual symbol name and returns null on failure. A returned function address has the image's lifetime and must not be used after unloading. `cangjit:src/CodeGen/CJNative/EmitPackageIR.cpp` (`CollectDependentPackages`) also handles generated references to dependent package initializers; exact native link and image order depends on the build, not merely the JIT search algorithm below.

## JIT package discovery and symbols

`cangjit:src/JIT/Runtime/JitRuntimeBindings.cpp` (`PackageLibraryNames`, `FindPackageLibrary`, `EnsurePackage`, `Resolve`) implements these concrete candidate examples:

| CHIR package | Candidate shared-library basenames, in order |
| --- | --- |
| `std.core` | `libcangjie-std-core.so` |
| `acme.math` | `libacme.math.so`, then `libacme.so` |
| `org::acme.math` | `libacme.math@org.so`, then `libacme@org.so` |

For each candidate it first accepts an already-tracked matching basename; otherwise it searches configured library search paths, the runtime library directory, import paths, the current directory, then colon-separated `LIBRARY_PATH`. It checks for regular files. This is the JIT's explicit search order, not a claim about the ELF loader's own dependency search or `LD_LIBRARY_PATH`. Failure to find a package returns `PackageLibraryNotFound`; failure to initialize a candidate returns `LibraryLoadFailed` rather than silently trying an unrelated fallback.

Example external call: `cangjit:src/JIT/X86_64/Compilers/Expression/CompileApply.cpp` first calls `EnsurePackage(callee.GetPackageName())`, then resolves `callee.GetIdentifierWithoutPrefix()`; failure is `UnresolvedSymbol`. `Resolve` rejects empty and embedded-NUL names, checks its cache, asks `FindCJSymbol` for each tracked library in order, then tries `dlsym` on the runtime handle. Successful lookups are cached by name; lookup is not a generic demangling or overload-resolution facility. `cangjit:src/JIT/Runtime/RuntimeFunctions.inc` lists required initialization-time runtime exports and optional ones resolved as needed. A missing optional helper can still make the particular compilation requiring it fail.

## Generated code publication and lifetime

```text
CHIR function -> machine code + provisional descriptor
              -> asmjit allocation -> publish final metadata/prefix
              -> register lazy call sites -> executable entry address
              -> scheduled as managed task
```

`cangjit:src/JIT/X86_64/Compilers/Function/CompileFunction.cpp` (`CompileToAddress`) places metadata and code in the same allocation, rebuilds address-dependent metadata after allocation, writes descriptor and prefix, registers lazy call sites, and returns an entry after the prefix. Publication failures release that allocation and report failure. This is not an ELF package `.so` and is not discovered by `FindCJSymbol`; it still needs the runtime's matching frame/metadata conventions and managed entry path. It does not imply support for every CHIR expression: `cangjit:src/JIT/X86_64/Compilers/Context/JitFailures.inc` explicitly lists unsupported package-local global storage, among other failures.

`JitRuntimeBindings::Close` finalizes an owned runtime first, unloads tracked libraries in reverse order, then closes the runtime handle and clears the symbol cache. Its comment explains that type information must remain mapped while the collector stops. With a non-owning binding, the host must coordinate teardown with the runtime and all tasks: the binding cannot ensure that references to code, metadata or library symbols are no longer in use. See `abi-runtime-lifecycle.md` and `abi-concurrency.md` for execution and ownership boundaries.
