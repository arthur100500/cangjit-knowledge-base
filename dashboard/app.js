'use strict';

const statuses = [
  ['in-progress', 'In progress'],
  ['icebox', 'Icebox'],
  ['testing', 'Testing'],
  ['done', 'Done']
];
const state = { tasks: [], documents: [], classes: [] };
let architectureGraph = null;
const dialog = document.getElementById('detail-dialog');
const detailTitle = document.getElementById('detail-title');
const detailLabel = document.getElementById('detail-label');
const detailContent = document.getElementById('detail-content');
let detailRequest = 0;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function empty(container, message) {
  container.append(element('p', message, 'empty'));
}

function button(text, className, handler) {
  const node = element('button', text, className);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

function showSection(name) {
  document.querySelectorAll('.section').forEach(section => { section.hidden = section.id !== name; });
  document.querySelectorAll('.nav-button').forEach(tab => {
    const active = tab.dataset.section === name;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  if (name === 'architecture') renderArchitectureGraph();
}

document.querySelectorAll('.nav-button').forEach(tab => {
  tab.addEventListener('click', () => showSection(tab.dataset.section));
});
document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { detailRequest++; });

function showDetail(label, title) {
  detailLabel.textContent = label;
  detailTitle.textContent = title;
  detailContent.replaceChildren();
  if (!dialog.open) dialog.showModal();
}

function field(title) {
  const section = element('section', undefined, 'detail-field');
  section.append(element('h3', title));
  detailContent.append(section);
  return section;
}

function showTask(task) {
  detailRequest++;
  showDetail('Task', task.title || task.id);
  field('Status').append(element('p', statuses.find(([id]) => id === task.status)?.[1] || task.status || 'Not specified'));
  field('Description').append(element('p', task.description || 'No description.'));
  const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  const dependencyField = field('Depends on');
  if (!dependencies.length) dependencyField.append(element('p', 'No recorded dependencies.'));
  else {
    const list = element('ul');
    dependencies.forEach(id => {
      const item = element('li');
      const dependency = state.tasks.find(candidate => candidate.id === id);
      if (dependency) item.append(button(`${dependency.title} (${id})`, 'inline-link', () => showTask(dependency)));
      else item.textContent = String(id);
      list.append(item);
    });
    dependencyField.append(list);
  }
  const sourceField = field('Source');
  if (task.source) {
    const path = String(task.source);
    sourceField.append(button(path, 'inline-link', () => showDocument(path)));
  } else sourceField.append(element('p', 'No source recorded.'));
}

function showClass(item) {
  detailRequest++;
  showDetail('Class', item.name);
  field('Qualified name').append(element('p', item.id));
  field('Description').append(element('p', item.description || 'No description.'));
  field('Source').append(element('p', item.source || 'No source recorded.'));
  const relations = field('Relationships');
  if (!item.relations.length) relations.append(element('p', 'No recorded relationships.'));
  else {
    const list = element('ul');
    item.relations.forEach(relation => {
      const target = state.classes.find(candidate => candidate.id === relation.target);
      const entry = element('li');
      entry.append(document.createTextNode(`${relation.type}: `));
      entry.append(button(target.name, 'inline-link', () => showClass(target)));
      list.append(entry);
    });
    relations.append(list);
  }
}

function renderArchitectureGraph() {
  if (document.getElementById('architecture').hidden || !state.classes.length) return;
  const status = document.getElementById('architecture-status');
  const container = document.getElementById('architecture-graph');
  if (typeof cytoscape !== 'function') {
    status.textContent = 'Graph library unavailable. Install dashboard dependencies to display the graph; the class list remains available below.';
    status.hidden = false;
    return;
  }

  const selectedId = document.getElementById('architecture-class').value;
  const relationType = document.getElementById('architecture-relation').value;
  const relations = [];
  state.classes.forEach(item => item.relations.forEach(relation => {
    if (!relationType || relation.type === relationType) {
      relations.push({ source: item.id, target: relation.target, label: relation.type });
    }
  }));
  const nodes = [...state.classes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const nodeIds = new Map(nodes.map((item, index) => [item.id, `node-${index}`]));
  const elements = nodes.map(item => ({
    data: { id: nodeIds.get(item.id), classId: item.id, label: item.name },
    classes: item.id === selectedId ? 'focused' : ''
  }));
  relations.forEach((relation, index) => elements.push({
    data: { id: `edge-${index}`, source: nodeIds.get(relation.source), target: nodeIds.get(relation.target), label: relation.label }
  }));
  if (architectureGraph) architectureGraph.destroy();
  container.hidden = false;
  architectureGraph = cytoscape({
    container,
    elements,
    style: [
      { selector: 'node', style: { label: 'data(label)', 'background-color': '#e8f3f2', 'border-color': '#478d86', 'border-width': 1, 'text-wrap': 'wrap', 'text-max-width': '180px', 'font-size': 14, 'text-valign': 'center', 'text-halign': 'center', shape: 'round-rectangle', width: 190, height: 55 } },
      { selector: 'node.focused', style: { 'background-color': '#b8ded9', 'border-color': '#125f59', 'border-width': 3, 'font-weight': 'bold' } },
      { selector: 'edge', style: { label: 'data(label)', width: 1.5, 'line-color': '#879c9b', 'target-arrow-color': '#879c9b', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'font-size': 12, 'text-background-color': '#fff', 'text-background-opacity': 0.9, 'text-background-padding': '3px' } },
    ],
    layout: { name: 'cose', animate: false, fit: true, padding: 40, nodeDimensionsIncludeLabels: true },
    minZoom: 0.001,
    maxZoom: 3,
  });
  architectureGraph.on('tap', 'node', event => {
    document.getElementById('architecture-class').value = event.target.data('classId');
    highlightArchitectureClass();
  });
  status.hidden = true;
}

function highlightArchitectureClass() {
  if (!architectureGraph) return;
  const selectedId = document.getElementById('architecture-class').value;
  architectureGraph.nodes().forEach(node => node.toggleClass('focused', node.data('classId') === selectedId));
}

document.getElementById('architecture-class').addEventListener('change', highlightArchitectureClass);
document.getElementById('architecture-relation').addEventListener('change', renderArchitectureGraph);
document.getElementById('architecture-fit').addEventListener('click', () => {
  if (architectureGraph) architectureGraph.fit(undefined, 40);
});
document.getElementById('architecture-details').addEventListener('click', () => {
  const item = state.classes.find(candidate => candidate.id === document.getElementById('architecture-class').value);
  if (item) showClass(item);
});

async function loadArchitecture() {
  const status = document.getElementById('architecture-status');
  const list = document.getElementById('architecture-list');
  try {
    const response = await fetch('/api/classes');
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    state.classes = data.classes;
    if (!state.classes.length) {
      status.textContent = 'No classes documented yet.';
      empty(list, 'No classes.');
      return;
    }
    const classSelect = document.getElementById('architecture-class');
    const sortedClasses = [...state.classes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    sortedClasses.forEach(item => {
      const option = element('option', item.name);
      option.value = item.id;
      classSelect.append(option);
    });
    classSelect.value = state.classes[0].id;
    const types = new Set(state.classes.flatMap(item => item.relations.map(relation => relation.type)));
    [...types].sort((a, b) => a.localeCompare(b)).forEach(type => {
      const option = element('option', type);
      option.value = type;
      document.getElementById('architecture-relation').append(option);
    });
    document.getElementById('architecture-controls').hidden = false;
    sortedClasses.forEach(item => {
      const card = button('', 'document-card', () => showClass(item));
      card.append(element('strong', item.name), element('span', item.id, 'document-path'));
      list.append(card);
    });
    status.hidden = true;
    renderArchitectureGraph();
  } catch (error) {
    status.textContent = `Could not load class data: ${error.message}`;
    status.classList.add('error');
    empty(list, 'Class data is unavailable.');
  }
}

function renderBoard() {
  const board = document.getElementById('board');
  board.replaceChildren();
  statuses.forEach(([status, label]) => {
    const tasks = state.tasks.filter(task => task.status === status);
    const column = element('section', undefined, 'column');
    const heading = element('div', undefined, 'column-header');
    heading.append(element('h3', label), element('span', String(tasks.length), 'count'));
    column.append(heading);
    const list = element('div', undefined, 'task-list');
    if (!tasks.length) empty(list, 'No tasks.');
    tasks.forEach(task => {
      const card = button('', 'task-card', () => showTask(task));
      card.append(element('strong', task.title || task.id), element('span', task.id, 'task-id'));
      list.append(card);
    });
    column.append(list);
    board.append(column);
  });
}

const svgNS = 'http://www.w3.org/2000/svg';
function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(svgNS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function layoutGraph(tasks) {
  const nodes = new Map(tasks.map(task => [task.id, { task, remaining: task.dependsOn.length, depth: 0, next: [] }]));
  for (const node of nodes.values()) {
    for (const dependency of node.task.dependsOn) nodes.get(dependency).next.push(node);
  }
  const queue = [...nodes.values()].filter(node => node.remaining === 0);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    for (const next of node.next) {
      next.depth = Math.max(next.depth, node.depth + 1);
      if (--next.remaining === 0) queue.push(next);
    }
  }
  if (queue.length !== tasks.length) return null;
  const columns = [];
  for (const node of nodes.values()) {
    (columns[node.depth] ||= []).push(node.task);
  }
  return columns;
}

function renderGraph() {
  const graph = document.getElementById('graph');
  graph.replaceChildren();
  const legend = element('div', undefined, 'graph-legend');
  legend.setAttribute('aria-label', 'Task status colors');
  statuses.forEach(([status, label]) => {
    const item = element('span', undefined, `legend-item status-${status}`);
    const swatch = element('span', undefined, 'legend-swatch');
    swatch.setAttribute('aria-hidden', 'true');
    item.append(swatch, document.createTextNode(label));
    legend.append(item);
  });
  graph.append(legend);
  if (!state.tasks.length) { empty(graph, 'No tasks to display.'); return; }
  const columns = layoutGraph(state.tasks);
  if (!columns) {
    graph.append(element('p', 'Dependency cycle detected. Fix the task dependencies to display the graph.', 'error notice'));
    return;
  }
  const width = columns.length * 260;
  const height = Math.max(...columns.map(column => column.length)) * 110;
  const svg = svgElement('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Task dependencies' });
  const defs = svgElement('defs');
  const marker = svgElement('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#879c9b' }));
  defs.append(marker);
  svg.append(defs);
  const positions = new Map();
  columns.forEach((column, columnIndex) => {
    column.forEach((task, row) => positions.set(task.id, { x: columnIndex * 260 + 20, y: row * 110 + 20 }));
  });
  state.tasks.forEach(task => {
    const target = positions.get(task.id);
    (Array.isArray(task.dependsOn) ? task.dependsOn : []).forEach(id => {
      const source = positions.get(id);
      if (!source) return;
      const x1 = source.x + 190, y1 = source.y + 28;
      const x2 = target.x, y2 = target.y + 28;
      const bend = (x2 - x1) / 2;
      const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
      svg.append(svgElement('path', { d: path, class: 'graph-edge', 'marker-end': 'url(#arrow)' }));
    });
  });
  state.tasks.forEach(task => {
    const { x, y } = positions.get(task.id);
    const statusLabel = statuses.find(([id]) => id === task.status)?.[1] || task.status;
    const group = svgElement('g', { class: `graph-node status-${task.status}`, tabindex: 0, role: 'button', 'aria-label': `${task.title || task.id}, ${statusLabel}` });
    group.append(svgElement('rect', { x, y, width: 190, height: 56, rx: 6 }));
    const title = svgElement('title');
    title.textContent = task.title || task.id;
    group.append(title);
    const label = svgElement('text', { x: x + 10, y: y + 23 });
    const name = String(task.title || task.id);
    label.textContent = name.length > 23 ? `${name.slice(0, 22)}…` : name;
    const id = svgElement('text', { x: x + 10, y: y + 43, 'font-size': 11 });
    id.textContent = String(task.id).slice(0, 26);
    group.append(label, id);
    group.addEventListener('click', () => showTask(task));
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showTask(task); }
    });
    svg.append(group);
  });
  graph.append(svg);
}

function renderDocuments() {
  [['knowledge', 'knowledge-list'], ['issues', 'issues-list'], ['decisions', 'decisions-list']].forEach(([category, id]) => {
    const list = document.getElementById(id);
    list.replaceChildren();
    const documents = state.documents.filter(doc => doc.category === category);
    if (!documents.length) empty(list, 'No documents.');
    documents.forEach(doc => {
      const card = button('', 'document-card', () => showDocument(doc.path));
      card.append(element('strong', doc.title || doc.path), element('span', doc.path, 'document-path'));
      list.append(card);
    });
  });
}

// Markdown is constructed with DOM text nodes, never interpreted as HTML.
function inline(parent, text) {
  const pattern = /(`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(position, match.index)));
    const token = match[0];
    if (token.startsWith('`')) parent.append(element('code', token.slice(1, -1)));
    else if (token.startsWith('[')) {
      const parts = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      let url;
      try { url = new URL(parts[2], window.location.href); } catch { /* Render invalid links as text. */ }
      if (url && (url.protocol === 'http:' || url.protocol === 'https:')) {
        const link = element('a', parts[1]);
        link.href = url.href;
        link.rel = 'noopener noreferrer';
        parent.append(link);
      } else parent.append(document.createTextNode(parts[1]));
    } else if (token.startsWith('**')) parent.append(element('strong', token.slice(2, -2)));
    else parent.append(element('em', token.slice(1, -1)));
    position = match.index + token.length;
  }
  parent.append(document.createTextNode(text.slice(position)));
}

function renderMarkdown(content) {
  const article = element('article', undefined, 'markdown');
  const lines = String(content).replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      i++;
      const code = [];
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
      if (i < lines.length) i++;
      const pre = element('pre');
      pre.append(element('code', code.join('\n')));
      article.append(pre);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      const cells = row => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
      const table = element('table');
      const head = element('thead');
      const headingRow = element('tr');
      cells(line).forEach(text => { const th = element('th'); inline(th, text); headingRow.append(th); });
      head.append(headingRow);
      table.append(head);
      i += 2;
      const body = element('tbody');
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const row = element('tr');
        cells(lines[i++]).forEach(text => { const td = element('td'); inline(td, text); row.append(td); });
        body.append(row);
      }
      table.append(body);
      article.append(table);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const node = element(`h${heading[1].length}`);
      inline(node, heading[2]); article.append(node); i++; continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { article.append(element('hr')); i++; continue; }
    const listMatch = /^\s*([-+*]|\d+[.)])\s+(.+)$/.exec(line);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const list = element(ordered ? 'ol' : 'ul');
      while (i < lines.length) {
        const item = /^\s*([-+*]|\d+[.)])\s+(.+)$/.exec(lines[i]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        const li = element('li'); inline(li, item[2]); list.append(li); i++;
      }
      article.append(list); continue;
    }
    if (/^\s*>/.test(line)) {
      const quote = element('blockquote');
      const quoted = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quoted.push(lines[i++].replace(/^\s*>\s?/, ''));
      inline(quote, quoted.join(' ')); article.append(quote); continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim()) {
      if (paragraph.length && /^(?:\s*(`{3,}|~{3,}|>|[-+*]\s+|\d+[.)]\s+)|#{1,6}\s+)/.test(lines[i])) break;
      paragraph.push(lines[i++].trim());
    }
    const p = element('p'); inline(p, paragraph.join(' ')); article.append(p);
  }
  return article;
}

async function showDocument(path) {
  const request = ++detailRequest;
  const doc = state.documents.find(item => item.path === path);
  showDetail('Document', doc?.title || path);
  detailContent.append(element('p', 'Loading document…'));
  try {
    const response = await fetch(`/api/document?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    if (request !== detailRequest) return;
    detailContent.replaceChildren(element('p', data.path, 'document-path'), renderMarkdown(data.content));
  } catch (error) {
    if (request !== detailRequest) return;
    detailContent.replaceChildren(element('p', `Could not load document: ${error.message}`, 'notice error'));
  }
}

async function load() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    state.documents = Array.isArray(data.documents) ? data.documents : [];
    renderBoard(); renderGraph(); renderDocuments();
  } catch (error) {
    const message = document.getElementById('load-error');
    message.textContent = `Could not load dashboard data: ${error.message}`;
    message.hidden = false;
  }
}
load();
loadArchitecture();
