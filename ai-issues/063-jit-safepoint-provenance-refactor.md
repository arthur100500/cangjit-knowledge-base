# [REFACTOR] Separate safepoint reference provenance

Priority: P2

`ComputeSafepointLiveness` still contains a large recursive classifier for managed objects, stack-local references, derived roots, exception wrappers and unsupported values. Extracting it safely requires preserving parent-before-derived root ordering, local-region rules, cycle detection and rejection behavior. Add focused GC and exceptional-edge coverage before reshaping that classifier; the simpler must-initialization phase has already been separated.
