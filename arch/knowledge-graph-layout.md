# Architecture graph layout

The Architecture view lays out the class graph with the ELK layered algorithm
(`cytoscape-elk` 2.4.0 over `elkjs`), left-to-right with orthogonal edge
routing and ELK-provided edge geometry (`useElkEdgeGeometry`, rounded corners
via `elkEdgeRadius`). Cytoscape.js remains the rendering and interaction layer:
pan, zoom, class selection, relationship filters and fit are unchanged.

Decision: replace the former `cose` force-directed layout with ELK layered.
The force layout produced organic, unaligned placement; on the real
`classes/classes.json` (52 classes, 72 edges) it measured 67 edge crossings
plus 30 edges passing through unrelated node boxes, while ELK layered with
orthogonal routing measured 13 crossings and none through nodes. Dagre
(`cytoscape-dagre`) was the considered alternative at 44 crossings and no
orthogonal routing. Mermaid with `@mermaid-js/layout-elk` would give the same
ELK structure but was rejected: it cannot carry the interactive selection,
filtering and highlight behaviors of the Cytoscape view.

Consequences: layout is deterministic and aligned (columns left-to-right,
rows within columns) instead of force-organic; three vendor scripts are served
(`elk.min.js`, `cytoscape.min.js`, `cytoscape-elk.min.js`, copied by
`dashboard/build.js`); ELK produces a wide canvas (~2200×1150 px model space),
which the fitted view and pan/zoom absorb.
