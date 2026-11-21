# Knowledge dashboard

The dashboard requires Node.js and npm. From the repository root, install its pinned graph dependency and start the server:

```sh
npm ci --prefix dashboard
node dashboard/server.js
```

Open <http://localhost:3000/> on the host, or open `http://<host-LAN-IP>:3000/` on a phone connected to the same network. To choose another port, start the server with `PORT=4000 node dashboard/server.js` and use that port in the URL. Stop it with Ctrl+C. Task records in `tasks.json`, class data in `classes/classes.json`, and the designated Markdown documents are read from disk on requests; reload the page to see changes.

The Architecture section visualizes the documented classes with Cytoscape.js, served locally from the installed dependency rather than a CDN. Arrows point from the class declaring a relationship to its target; edge labels describe the relationship. Pan and zoom the graph, or use the class list to open descriptions, source paths, and relationships without using the graph. If class data or the graph library is unavailable, the section reports the problem independently of the other dashboard sections.

## LAN security

The server listens on **all network interfaces** (`0.0.0.0`) and provides **no authentication or encryption**. Anyone who can reach the port can read the task records and exposed documents. Use it only on a trusted network; do not expose the port to the public internet or use port forwarding. Firewall the port to trusted devices where appropriate, and stop the server when it is not needed. The server is read-only, but it does not protect the confidentiality of exposed content from LAN users.

Only Markdown under `ai-docs/`, `ai-insides/`, `ai-issues/`, and `arch/`, plus `unfinished/SESSION-STATE.md`, is exposed as documents. The server also exposes `tasks.json` and `classes/classes.json` through its data APIs and serves its explicitly listed dashboard assets.
