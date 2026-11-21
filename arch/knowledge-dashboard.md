# Knowledge dashboard

The knowledge base has a read-only, locally hosted dashboard. Tasks are stored in `tasks.json` with explicit status, source and dependency IDs; Markdown files remain the source of truth for knowledge, issues and decisions. The dashboard provides a task board and dependency graph, and groups issue documents with knowledge. It serves repository data live, without an external service or CDN.

The alternatives were to derive task state from prose or duplicate Markdown content in a database. Explicit task records make statuses and dependencies maintainable without guessing, while retaining Markdown avoids a second copy of project knowledge. Dependencies are recorded only when known.

The dependency graph uses topological layers: prerequisites appear to the left
of their dependents, with arrows from right edge to left edge. Independent tasks
remain in the first layer. A cycle is reported instead of presenting a misleading
ordering. This favors explicit direction over the former input-order grid;
long chains scroll horizontally, including on phones.

The server exposes only dashboard assets and designated Markdown files. It listens on the LAN for phone access; the dashboard has no authentication and must only be used on a trusted network.
