# [REFACTOR] Compare FileUtil::JoinPath and GetDirPath with current POSIX behavior

Priority: P2

Compare FileUtil::JoinPath and GetDirPath with current POSIX behavior; see ai-docs/jit-review-questions.md.

## Source snapshot

`src/JIT/X86_64/JitRuntimeBindings.cpp:130` (line from pre-refactor snapshot):

> // FIX: You sure there is no api to work with paths?

This is an inventory/proposal, not a claim that the requested source change has been completed.
