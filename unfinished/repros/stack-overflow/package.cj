package std.jit_final
import std.sync.AtomicInt64
import std.runtime.gc
let count = AtomicInt64(0)
public interface I { func touch(this @local!): Unit }
public class C <: I {
    public exclave init(this @local!) {}
    public exclave init(this @local!, bad: Bool) { if (bad) { throw Exception() } }
    public exclave func touch(this @local!) {}
    public exclave func fail(this @local!) { throw Exception() }
    ~init(this @local!) { gc(heavy: true); count.fetchAdd(1) }
}
public func get(): Int64 { return count.load() }
public func collect() { gc(heavy: true) }
public class Payload {
    public init() {}
    public func read(): Int64 { return 42 }
}
public func payload(): Payload { return Payload() }
