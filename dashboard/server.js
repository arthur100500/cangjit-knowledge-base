'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const documentRoots = {
  'ai-docs': 'knowledge',
  'ai-insides': 'knowledge',
  'ai-issues': 'issues',
  arch: 'decisions',
};
const sessionPath = 'unfinished/SESSION-STATE.md';
const assets = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/cytoscape.min.js': ['node_modules/cytoscape/dist/cytoscape.min.js', 'text/javascript; charset=utf-8'],
};

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// Resolve both the allowed directory and the file so symlinks cannot escape it.
async function readContained(directory, relativePath) {
  const realRoot = await fs.realpath(root);
  const realDirectory = await fs.realpath(directory);
  if (!isWithin(realRoot, realDirectory)) return null;
  const resolved = await fs.realpath(path.join(directory, relativePath));
  if (!isWithin(realDirectory, resolved)) return null;
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) return null;
  return fs.readFile(resolved, 'utf8');
}

function documentLocation(name) {
  if (typeof name !== 'string' || name.includes('\\') || name.includes('\0')) return null;
  const parts = name.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return null;
  if (name === sessionPath) return { directory: path.join(root, 'unfinished'), relative: 'SESSION-STATE.md', category: 'knowledge' };
  if (!Object.hasOwn(documentRoots, parts[0]) || parts.length < 2 || !name.endsWith('.md')) return null;
  return { directory: path.join(root, parts[0]), relative: parts.slice(1).join('/'), category: documentRoots[parts[0]] };
}

async function readDocument(name) {
  const location = documentLocation(name);
  if (!location) return null;
  try {
    return await readContained(location.directory, location.relative);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'ELOOP') return null;
    throw error;
  }
}

function titleFor(name, content) {
  const heading = content.match(/^\s*#\s+(.+?)\s*#*\s*$/m);
  return heading ? heading[1].trim() : path.posix.basename(name, '.md').replace(/[-_]/g, ' ');
}

async function listDocuments() {
  const documents = [];
  async function add(name, category) {
    const content = await readDocument(name);
    if (content !== null) documents.push({ path: name, title: titleFor(name, content), category });
  }
  async function walk(directory, prefix, category) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
      throw error;
    }
    for (const entry of entries) {
      const name = `${prefix}/${entry.name}`;
      // Do not traverse symlinks, even when they point back into the tree.
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), name, category);
      else if (entry.isFile() && entry.name.endsWith('.md')) await add(name, category);
    }
  }
  for (const [directory, category] of Object.entries(documentRoots)) {
    const absolute = path.join(root, directory);
    try {
      const realRoot = await fs.realpath(root);
      const realDirectory = await fs.realpath(absolute);
      if (isWithin(realRoot, realDirectory)) await walk(absolute, directory, category);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR' && error.code !== 'ELOOP') throw error;
    }
  }
  await add(sessionPath, 'knowledge');
  return documents.sort((a, b) => a.path.localeCompare(b.path));
}

function send(response, status, body, type) {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function json(response, status, body) {
  send(response, status, JSON.stringify(body), 'application/json; charset=utf-8');
}

function validateTasks(tasks) {
  const statuses = new Set(['in-progress', 'icebox', 'testing', 'done']);
  if (!Array.isArray(tasks)) throw new Error('Task data is not an array');
  const ids = new Set();
  for (const task of tasks) {
    if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) ||
        typeof task.title !== 'string' || typeof task.description !== 'string' ||
        typeof task.source !== 'string' || !statuses.has(task.status) ||
        !Array.isArray(task.dependsOn) || !task.dependsOn.every(id => typeof id === 'string')) {
      throw new Error('Invalid task record');
    }
    ids.add(task.id);
  }
  for (const task of tasks) {
    if (task.dependsOn.some(id => !ids.has(id) || id === task.id)) {
      throw new Error(`Invalid dependency for task ${task.id}`);
    }
  }
}

function validateClasses(data) {
  if (!data || !Array.isArray(data.classes)) throw new Error('Class data is not an array');
  const ids = new Set();
  for (const item of data.classes) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) ||
        typeof item.name !== 'string' || typeof item.description !== 'string' ||
        typeof item.source !== 'string' || !Array.isArray(item.relations) ||
        !item.relations.every(relation => relation && typeof relation.target === 'string' &&
          typeof relation.type === 'string')) {
      throw new Error('Invalid class record');
    }
    ids.add(item.id);
  }
  for (const item of data.classes) {
    if (item.relations.some(relation => !ids.has(relation.target))) {
      throw new Error(`Invalid relation for class ${item.id}`);
    }
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return json(response, 405, { error: 'Method not allowed' });
    }
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/data') {
      const tasksText = await readContained(root, 'tasks.json');
      if (tasksText === null) throw new Error('Task data is unavailable');
      const tasks = JSON.parse(tasksText);
      validateTasks(tasks);
      return json(response, 200, { tasks, documents: await listDocuments() });
    }
    if (url.pathname === '/api/classes') {
      const text = await readContained(root, 'classes/classes.json');
      if (text === null) throw new Error('Class data is unavailable');
      const data = JSON.parse(text);
      validateClasses(data);
      return json(response, 200, data);
    }
    if (url.pathname === '/api/document') {
      const name = url.searchParams.get('path');
      const content = await readDocument(name);
      if (content === null) return json(response, 404, { error: 'Document not found' });
      return json(response, 200, { path: name, content });
    }
    if (url.pathname === '/api/insides-image') {
      const name = url.searchParams.get('path');
      const parts = typeof name === 'string' ? name.split('/') : [];
      if (!parts.length || parts.some(part => !part || part === '.' || part === '..' || part.includes('\\') || part.includes('\0')) || !name.endsWith('.svg')) {
        return json(response, 404, { error: 'Image not found' });
      }
      let content;
      try {
        content = await readContained(path.join(root, 'ai-insides'), name);
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR' && error.code !== 'ELOOP') throw error;
      }
      if (content == null) return json(response, 404, { error: 'Image not found' });
      response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      return send(response, 200, content, 'image/svg+xml; charset=utf-8');
    }
    if (Object.hasOwn(assets, url.pathname)) {
      const [name, type] = assets[url.pathname];
      const content = await readContained(__dirname, name);
      if (content !== null) return send(response, 200, content, type);
    }
    return json(response, 404, { error: 'Not found' });
  } catch (error) {
    console.error('Dashboard request failed:', error.message);
    if (!response.headersSent) json(response, 500, { error: 'Internal server error' });
    else response.destroy();
  }
});

const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535');
  process.exitCode = 1;
} else {
  server.listen(port, '0.0.0.0', () => console.log(`Dashboard listening on 0.0.0.0:${port}`));
}
