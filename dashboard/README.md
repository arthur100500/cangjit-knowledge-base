# Knowledge dashboard

The dashboard requires Node.js and npm. From the repository root, install its pinned graph dependency and start the server:

```sh
npm ci --prefix dashboard
node dashboard/server.js
```

Open <http://localhost:3000/> on the host, or open `http://<host-LAN-IP>:3000/` on a phone connected to the same network. To choose another port, start the server with `PORT=4000 node dashboard/server.js` and use that port in the URL. Stop it with Ctrl+C. Task records in `tasks.json`, class data in `classes/classes.json`, and the designated Markdown documents are read from disk on requests; reload the page to see changes.

The Architecture section uses Cytoscape.js, served locally rather than from a CDN. It shows one selected class and its direct incoming and outgoing relationships, with neighbors sorted by name. Select a class from the list or graph, and optionally filter by relationship type. Arrows point from the class declaring a relationship to its target. Pan and zoom, use Fit graph to reset the view, or open Class details for its description and source. The alphabetical class list also provides keyboard access to details. If class data or the graph library is unavailable, the section reports the problem independently of the other dashboard sections.

Markdown documents in `ai-insides/` can include local SVG illustrations, for example `![Stack frame](abi-stack-frame.svg)` in `ai-insides/abi-stack-frames.md`. Paths are relative to the Markdown file and may name files in subdirectories; they must stay within `ai-insides/`, use the lowercase `.svg` extension, and contain no `.` or `..` path components, URL escapes, query strings, or fragments. Other image paths are displayed as text. The server confines image reads to that directory (including symlink resolution), serves SVG with a restrictive content security policy, and the dashboard displays it as an image rather than inline HTML. Relative Markdown links between `ai-insides/` documents open the referenced document in the dashboard.

## LAN security

The server listens on **all network interfaces** (`0.0.0.0`) and provides **no authentication or encryption**. Anyone who can reach the port can read the task records and exposed documents. Use it only on a trusted network; do not expose the port to the public internet or use port forwarding. Firewall the port to trusted devices where appropriate, and stop the server when it is not needed. The server is read-only, but it does not protect the confidentiality of exposed content from LAN users.

Only Markdown under `ai-docs/`, `ai-insides/`, `ai-issues/`, and `arch/`, plus `unfinished/SESSION-STATE.md`, is exposed as documents. The server also exposes `tasks.json` and `classes/classes.json` through its data APIs and serves its explicitly listed dashboard assets.
