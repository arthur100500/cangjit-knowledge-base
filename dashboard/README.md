# Knowledge dashboard

The dashboard is a static site built by `dashboard/build.js` and published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`. It needs Node.js and npm to build:

```sh
npm ci --prefix dashboard
node dashboard/build.js
```

The build writes `dashboard/dist/`: `index.html`, `style.css`, `app.js`, `cytoscape.min.js`, a `data.json` (tasks from `tasks.json` plus a document index with extracted titles), a `classes.json` (from `classes/classes.json`), and every exposed Markdown file under `docs/` at its repository-relative path, together with the `ai-insights/` SVG illustrations. It validates the task and class schemas and rejects non-URL-safe paths, so broken input fails the deploy instead of the site. `dist/` is generated and git-ignored.

To preview locally, serve the built directory with any static file server, for example:

```sh
python3 -m http.server 3000 -d dashboard/dist
```

Then open <http://localhost:3000/>. The page fetches all data with relative URLs, so it also works under the GitHub Pages project sub-path and a custom domain. Reload the page after rebuilding to see changes.

The Architecture section uses Cytoscape.js, built into `dist/` from the pinned dependency rather than loaded from a CDN. It shows the class graph with relationship filtering; select a class from the list or graph, pan and zoom, use Fit graph, or open Class details. The alphabetical class list also provides keyboard access to details.

Markdown documents in `ai-insights/` can include local SVG illustrations, for example `![Stack frame](abi-stack-frame.svg)` in `ai-insights/abi-stack-frames.md`. Paths are relative to the Markdown file and may name files in subdirectories; they must stay within `ai-insights/`, use the lowercase `.svg` extension, and contain no `.` or `..` path components, URL escapes, query strings, or fragments. Other image paths are displayed as text. The dashboard displays SVG as an image rather than inline HTML, so scripts inside an SVG do not execute. Relative Markdown links between `ai-insights/` documents open the referenced document in the dashboard.

Only Markdown under `ai-docs/`, `ai-insights/`, `ai-issues/`, and `arch/`, plus `unfinished/SESSION-STATE.md`, is mirrored into the site, along with `tasks.json` and `classes/classes.json` data. Everything the site serves is public on GitHub Pages; the repository is public, so no non-public content may be added to the build.

## One-time setup

In the repository settings on GitHub, under Pages, set Source to **GitHub Actions**. The workflow then deploys on every push to `main`; the site URL appears in the workflow run.
