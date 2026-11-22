# [TODO] Resolve explicitly named native package libraries

JIT package loading now searches compiler `-L` and import directories using standard-library names, package names and combined-root names. Separate-path, current-directory, `-L` precedence and combined-root examples were exercised.

The frontend does not currently pass the compiler's explicit `-l` library list to the JIT. A Cangjie package exported by a shared library whose filename does not match those conventions may therefore be missed. Define how explicitly linked Cangjie libraries are distinguished from ordinary system libraries, load them through the runtime's package-initialization mechanism, and test mixed and combined dependencies without double ownership or basename collisions.
