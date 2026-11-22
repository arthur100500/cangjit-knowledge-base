# [ABI INFO] Object and value representation

Scope: current checked-out sources, inspected 2026-11-23, x86-64 Linux. `cangjie_runtime/` and `cangjit/` below identify separate source repositories. These layouts are implementation-specific; do not assume a stable public binary format across releases or targets.

## Managed object header and payload

`cangjie_runtime/runtime/src/Common/BaseObject.h` defines the managed base object with a single `StateWord`; `Common/StateWord.h` statically asserts its size is 8 bytes. On the non-32-bit-ARM path used here, its fields are a low 32-bit and high 16-bit type-info address plus a 16-bit `ObjectState`. The low three bits of that state encode `NORMAL`, `LOCKED`, `FORWARDING`, `FORWARDED`, or `LOCAL_OBJECT`. `GetTypeInfo()` reconstructs the 48 stored address bits; treating the whole 64-bit word as a plain type pointer is therefore incorrect when state bits are nonzero.

```text
x86-64 managed object, schematic (byte offsets from object address)
+0  [ type-info low 32 ][ type-info high 16 ][ state 16 ]   8 bytes
+8  [ payload fields, padding as required by concrete type ]
     ^ GC bitmap describes references in this payload
```

`runtime/src/Common/BaseObject.cpp`, `ForEachRefFieldInNonArrayObject`, starts the GC bitmap at `object + TYPEINFO_PTR_SIZE`. Field offsets, field ordering, aggregate padding and payload size come from the actual type metadata and compiler layout; the diagram is not a specification of arbitrary class fields. `BaseObject::GetSize` aligns the header plus type instance size. Allocator `HEADER_SIZE = 0` in `runtime/src/Heap/Allocator/Allocator.h` refers to an *extra allocator header*, not the managed state word.

## Arrays and embedded values

`runtime/src/ObjectModel/MArray.h` derives `MArray` from `BaseObject` and adds an `MIndex length`; `MArray.inline.h`, `GetContentOffset`, uses `sizeof(MArray)` rather than a hard-coded portable offset. `Common/TypeDef.h` defines `MIndex`; confirm the target's typedef before deriving a literal byte offset. Content follows the fixed array portion:

```text
RawArray object: [ state word ][ length ][ element 0 ][ element 1 ] ...
reference array:                                 ref           ref
value array:                                  value bytes   value bytes
```

`MArray::GetElementSize` uses pointer size for a reference component, otherwise the component type's size. `BaseObject::ForEachRefField` traces array references individually and applies a struct component's GC bitmap per element, when the array type reports reference fields. Therefore an inline value can itself contain managed references; copying its bytes blindly can be inappropriate in a context requiring barriers. Conversely, an integer element is not made into a reference by its numeric bit pattern.

The x86-64 JIT's `cangjit/src/JIT/X86_64/Compilers/Context/StringLiteralPool.cpp`, `StoreLiteral`, provides a concrete special case: it constructs pooled storage as `String {array, start, length}`, followed by `RawArray {type info, length, bytes}`. The code packs the start/length word and points the string at the embedded array. This is a literal-pool implementation, not evidence that all strings are separately allocated heap objects or that all values have object headers.

## References, values, and boxing

`runtime/src/Common/TypeDef.h` aliases `ObjRef` to `MObject*` and `ArrayRef` to `MArray*`; these denote managed object references, not copies of all their fields. `Common/BaseObject.h` also defines `ObjectRef` as a mutable root slot wrapper; do not confuse it with an object payload or with a stable unmanaged handle. The runtime's field and type metadata determine whether data is a reference or embedded value. For a boxed value, inspect the actual box type and compiler lowering rather than assuming every struct is boxed. In particular, `cangjit/src/JIT/X86_64/Compilers/Context/TypeInfoEmitter.cpp` recognizes `Box.tt`, while `runtime/src/ObjectModel/FieldInfo.cpp` contains reflection paths that allocate objects for values; neither establishes universal boxing of all value uses.

```text
reference variable -----> [managed header | object payload]
inline aggregate          [value field | reference -----> object]
boxed value ------------> [managed header | value payload]  (when boxed)
```

Object relocation and field access require the collector's root maps and barriers; see [garbage collection](abi-garbage-collection.md). Object creation and size checks are described in [allocation](abi-allocation.md). Native and JIT code must agree at shared runtime boundaries, but individual JIT-supported type cases and literal storage do not prove complete parity with native lowering.
