# [TODO] Verify local-finalizer exceptional and escaped-address paths

`LocalFinalizerFrontier` follows named and indexed element references and now tracks whether registration succeeded on every incoming path, including failed `TryAllocate` edges. Native/JIT comparisons passed for saved local-finalizer loop and GC examples, but the failed-allocation merge and every escaped-address/exception edge have not been exercised.

Construct behavioral fixtures for failed allocation followed by a merge, throwing constructors and methods, shared landing pads, loop re-entry, escaped slot addresses and finalizers that trigger GC. Verify exactly-once removal, order, live roots, and pending exception preservation. Compare the native finalizer-frontier rules; keep conservative region-end retention where escape cannot be tracked.
