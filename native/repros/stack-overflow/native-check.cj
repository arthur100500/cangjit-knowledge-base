import std.jit_final.C
import std.jit_final.get
import std.jit_final.collect
func deep(n: Int64): Int64 {
    if (n == 0) { collect(); return 0 }
    return deep(n - 1) + 1
}
func exercise(): Int64 {
    var x: C @local! = C()
    let n = deep(3000)
    x.touch()
    if (n == 3000 && get() == 1) { return 42 }
    return 0
}
main(): Int64 { return exercise() }
