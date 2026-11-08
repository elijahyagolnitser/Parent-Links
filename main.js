const { Plugin, TFile, Notice } = require('obsidian');
const BEGIN = '%% Begin Parent-Link %%';
const END = '%% End Parent-Link %%';
const OLD_MARKER = '<!-- Parent-Link -->';

function findFolderNotes(root) {
  const notes = new Map();
  function walk(folder, parentPath) {
    const children = folder.children || [];
    const noteName = folder.name + '.md';
    const note = children.find(c => c.name === noteName && c.extension === 'md');
    const path = (parentPath ? parentPath + '/' : '') + folder.name;
    if (note) notes.set(path, note.path);
    for (const child of children) {
      if (child.children) walk(child, path);
    }
  }
  walk(root, '');
  return notes;
}

function insertBlock(content, parentName, notePath) {
  const block = [BEGIN, `[[${parentName}]]`, END];
  const lines = content.split('\n');
  const cleaned = [];
  let inBlock = false;
  for (const line of lines) {
    const t = line.trim();
    if (t === BEGIN) {
      if (inBlock) throw new Error('Malformed parent-link block in ' + notePath + ': nested opening marker.');
      inBlock = true;
      continue;
    }
    if (t === END) {
      if (!inBlock) throw new Error('Malformed parent-link block in ' + notePath + ': unmatched closing marker.');
      inBlock = false;
      continue;
    }
    if (line.includes(OLD_MARKER)) continue;
    if (!inBlock) cleaned.push(line);
  }
  if (inBlock) throw new Error('Malformed parent-link block in ' + notePath + ': missing closing marker.');
  while (cleaned.length > 0 && cleaned[0] === '') cleaned.shift();
  if (cleaned[0] === '---') {
    const fmEnd = cleaned.indexOf('---', 1);
    if (fmEnd !== -1) {
      return [...cleaned.slice(0, fmEnd + 1), ...block, ...cleaned.slice(fmEnd + 1)].join('\n');
    }
  }
  return [...block, ...cleaned].join('\n');
}

async function getUpdates(root, readFile) {
  const notes = findFolderNotes(root);
  const updates = new Map();
  for (const [folderPath, notePath] of notes) {
    const lastSlash = folderPath.lastIndexOf('/');
    if (lastSlash === -1) continue;
    const parentPath = folderPath.substring(0, lastSlash);
    if (!notes.has(parentPath)) continue;
    const parentName = parentPath.substring(parentPath.lastIndexOf('/') + 1);
    const old = await readFile(notePath);
    updates.set(notePath, insertBlock(old, parentName, notePath));
  }
  return updates;
}

class ParentLinksPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'refresh-parent-links',
      name: 'Refresh parent links',
      callback: () => this.refresh()
    });
    this.addRibbonIcon('arrow-up', 'Refresh parent links', () => this.refresh());
  }

  async refresh() {
    try {
      const root = this.app.vault.getRoot();
      const readFile = async p => {
        const f = this.app.vault.getAbstractFileByPath(p);
        if (!f || !(f instanceof TFile)) throw new Error('Not a file: ' + p);
        return await this.app.vault.read(f);
      };
      const updates = await getUpdates(root, readFile);
      for (const [path, content] of updates) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file && file instanceof TFile) await this.app.vault.modify(file, content);
      }
      new Notice('Parent links refreshed.');
    } catch (e) {
      new Notice('Parent links error: ' + e.message);
      console.error(e);
    }
  }
}

module.exports = ParentLinksPlugin;
