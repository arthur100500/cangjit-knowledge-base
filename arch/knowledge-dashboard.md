# Knowledge dashboard

The knowledge base has a read-only dashboard published as a static site on GitHub Pages. Tasks are stored in `tasks.json` with explicit status, source and dependency IDs; Markdown files remain the source of truth for knowledge, issues and decisions. The dashboard provides a task board and dependency graph, and groups issue documents with knowledge.

The dashboard used to be served live from disk by a local Node HTTP server with JSON APIs. That server was replaced by a build step (`dashboard/build.js`) that mirrors the exposed content into `dashboard/dist/`: a `data.json` (tasks plus a document index with extracted titles), `classes.json`, the Markdown documents under `docs/` with their repository-relative paths, and the `ai-insights/` SVG illustrations. The client fetches those files with relative URLs, so the same bundle works under the GitHub Pages project sub-path, a custom domain, and a local preview server. A GitHub Actions workflow (`.github/workflows/pages.yml`) rebuilds and deploys on every push to `main`.

The alternatives were:

* Keep the live server alongside the static build. Rejected: two serving conventions and duplicated exposure logic that would drift; the published site covers the phone-on-LAN use case by itself.
* Commit `dist/` to the repository. Rejected: staleness and merge noise on every knowledge push; a fresh build in CI is cheaper than reconciling generated files.
* Host one static page that fetches repository content live from `raw.githubusercontent.com`. Rejected: works only online, couples the dashboard to GitHub URLs, and re-downloads everything per visit.

The Architecture section uses Cytoscape.js, built into `dist/` from the pinned `dashboard/package.json` dependency rather than from a CDN. The build step is the only Node dependency; the published site itself is plain files with no runtime dependencies.

The dependency graph uses topological layers: prerequisites appear to the left of their dependents, with arrows from right edge to left edge. Independent tasks remain in the first layer. A cycle is reported instead of presenting a misleading ordering. This favors explicit direction over the former input-order grid; long chains scroll horizontally, including on phones.

The Architecture section uses Cytoscape.js, built into `dist/` from the pinned `dashboard/package.json` dependency rather than from a CDN. The build step is the only Node dependency; no build exists on the pages that read the dashboard.
