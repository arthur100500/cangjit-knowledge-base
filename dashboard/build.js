'use strict';

// Builds the static dashboard site into dashboard/dist/ from the repository
// content the former Node server used to expose live:
//   data.json     — tasks from tasks.json plus a document index with titles
//   classes.json  — class data from classes/classes.json
//   docs/<path>   — every exposed Markdown file, at its repository-relative path
//   ai-insights SVG illustrations, mirrored next to their documents
// The client fetches these with relative URLs, so the bundle works under the
// GitHub Pages project sub-path, a custom domain, or a local preview server.

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(__dirname, 'dist');
const documentRoots = {
  'ai-docs': 'knowledge',
  'ai-insights': 'knowledge',
  'ai-issues': 'issues',
  arch: 'decisions',
};
const sessionPath = 'unfinished/SESSION-STATE.md';
// Each mirrored path segment must be URL-safe on any static host.
const safeSegment = /^[A-Za-z0-9._-]+$/;

function assertUrlSafe(relativePath) {
  for (const segment of relativePath.split('/')) {
    if (!safeSegment.test(segment)) {
      throw new Error(`Path is not URL-safe: ${relativePath}`);
    }
  }
}

// Resolve both the allowed directory and the file so symlinks cannot escape it.
async function readContained(directory, relativePath) {
  const realRoot = await fs.realpath(root);
  const realDirectory = await fs.realpath(directory);
  const relative = path.relative(realRoot, realDirectory);
  if (relative !== '' && (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative))) return null;
  const resolved = await fs.realpath(path.join(directory, relativePath));
  if (!isWithin(realDirectory, resolved)) return null;
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) return null;
  return fs.readFile(resolved, 'utf8');
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function titleFor(name, content) {
  const heading = content.match(/^\s*#\s+(.+?)\s*#*\s*$/m);
  return heading ? heading[1].trim() : path.posix.basename(name, '.md').replace(/[-_]/g, ' ');
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

async function writeDocument(relativePath, content) {
  assertUrlSafe(relativePath);
  const target = path.join(dist, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

async function main() {
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });

  const tasksText = await fs.readFile(path.join(root, 'tasks.json'), 'utf8');
  const tasks = JSON.parse(tasksText);
  validateTasks(tasks);
  const documents = await listDocuments();
  await writeDocument('data.json', JSON.stringify({ tasks, documents }));

  const classesText = await fs.readFile(path.join(root, 'classes/classes.json'), 'utf8');
  const classesData = JSON.parse(classesText);
  validateClasses(classesData);
  await writeDocument('classes.json', JSON.stringify(classesData));

  for (const document of documents) {
    assertUrlSafe(document.path);
    await writeDocument(path.join('docs', document.path), await readDocument(document.path));
  }

  // Mirror the SVG illustrations the dashboard can display. The client only
  // shows images from ai-insights, so that is the only directory to carry over.
  async function copySvg(directory, prefix) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) await copySvg(path.join(directory, entry.name), `${prefix}/${entry.name}`);
      else if (entry.isFile() && entry.name.endsWith('.svg')) {
        await writeDocument(path.join('docs', `${prefix}/${entry.name}`), await fs.readFile(path.join(directory, entry.name), 'utf8'));
      }
    }
  }
  await copySvg(path.join(root, 'ai-insights'), 'ai-insights');

  for (const [name, file] of [
    ['index.html', 'index.html'],
    ['style.css', 'style.css'],
    ['app.js', 'app.js'],
    ['cytoscape.min.js', path.join('node_modules', 'cytoscape', 'dist', 'cytoscape.min.js')],
  ]) {
    await writeDocument(name, await fs.readFile(path.join(__dirname, file), 'utf8'));
  }

  console.log(`Built dashboard: ${documents.length} documents, ${tasks.length} tasks, ${classesData.classes.length} classes`);
}

main().catch(error => {
  console.error(`Dashboard build failed: ${error.message}`);
  process.exitCode = 1;
});
