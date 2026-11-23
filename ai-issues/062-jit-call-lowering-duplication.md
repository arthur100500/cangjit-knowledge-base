# [REFACTOR] Share common call-lowering steps

Priority: P2

`CompileApply.cpp` and `CompileInvoke.cpp` separately place ABI arguments, stage generic TypeInfo values, store results, and emit exceptional continuations. The paths differ in receiver handling, scratch-frame layout, validation, and error reporting, so combining them mechanically could change generated code. Identify and share the genuinely identical operations after adding coverage for direct, virtual, static, generic, floating-point and exceptional calls.
