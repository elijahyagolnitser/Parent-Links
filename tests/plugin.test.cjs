const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

function setup(content) {
  class TFile {
    constructor(name, filePath) {
      this.name = name;
      this.path = filePath;
      this.extension = 'md';
    }
  }
  const parent = new TFile('Projects.md', 'Projects/Projects.md');
  const child = new TFile('Example.md', 'Projects/Example/Example.md');
  const ordinary = new TFile('Other.md', 'Projects/Example/Other.md');
  const root = {
    name: 'Test Vault',
    children: [{
      name: 'Projects',
      children: [parent, {
        name: 'Example',
        children: [child, ordinary]
      }]
    }]
  };
  const files = new Map([parent, child, ordinary].map(file => [file.path, file]));
  const contents = new Map([[parent.path, 'Parent'], [child.path, content], [ordinary.path, 'Untouched']]);
  const notices = [];
  const writes = [];
  const sandbox = {
    module: { exports: {} },
    console: { error() {} },
    require(name) {
      assert.equal(name, 'obsidian');
      return { Plugin: class {}, TFile, Notice: class {
        constructor(message) { notices.push(message); }
      } };
    }
  };
  vm.runInNewContext(source, sandbox);
  const plugin = new sandbox.module.exports();
  plugin.app = { vault: {
    getRoot: () => root,
    getAbstractFileByPath: filePath => files.get(filePath),
    read: async file => contents.get(file.path),
    modify: async (file, text) => {
      writes.push(file.path);
      contents.set(file.path, text);
    }
  } };
  return { plugin, contents, notices, child, parent, ordinary, root, files, writes, TFile };
}

test('adds a parent link only to the eligible folder note', async () => {
  const state = setup('Body');
  await state.plugin.refresh();
  assert.equal(state.contents.get(state.child.path), '%% Begin Parent-Link %%\n[[Projects]]\n%% End Parent-Link %%\nBody');
  assert.equal(state.contents.get(state.parent.path), 'Parent');
  assert.equal(state.contents.get(state.ordinary.path), 'Untouched');
  assert.deepEqual(state.notices, ['Parent links refreshed.']);
});

test('keeps YAML frontmatter first', async () => {
  const state = setup('---\ntags: [example]\n---\nBody');
  await state.plugin.refresh();
  assert.equal(state.contents.get(state.child.path), '---\ntags: [example]\n---\n%% Begin Parent-Link %%\n[[Projects]]\n%% End Parent-Link %%\nBody');
});

test('repeated refresh does not duplicate the block', async () => {
  const state = setup('Body');
  await state.plugin.refresh();
  const first = state.contents.get(state.child.path);
  await state.plugin.refresh();
  assert.equal(state.contents.get(state.child.path), first);
});

for (const [name, content] of [
  ['missing closing marker', 'Heading\n%% Begin Parent-Link %%\n[[Old]]\nImportant body'],
  ['unmatched closing marker', 'Heading\n%% End Parent-Link %%\nImportant body'],
  ['nested opening markers', '%% Begin Parent-Link %%\n[[Old]]\n%% Begin Parent-Link %%\nImportant body\n%% End Parent-Link %%'],
  ['extra closing marker', '%% Begin Parent-Link %%\n[[Old]]\n%% End Parent-Link %%\nImportant body\n%% End Parent-Link %%']
]) {
  test(`preserves the entire note with ${name}`, async () => {
    const state = setup(content);
    await state.plugin.refresh();
    assert.equal(state.contents.get(state.child.path), content);
    assert.equal(state.writes.length, 0);
    assert.match(state.notices[0], /Parent links error:.*malformed/i);
    assert.ok(state.notices[0].includes(state.child.path));
  });
}

test('replaces a valid old block while preserving surrounding text', async () => {
  const state = setup('Before\n%% Begin Parent-Link %%\n[[Old]]\n%% End Parent-Link %%\nAfter');
  await state.plugin.refresh();
  assert.equal(state.contents.get(state.child.path), '%% Begin Parent-Link %%\n[[Projects]]\n%% End Parent-Link %%\nBefore\nAfter');
});

test('malformed markers abort before writing other eligible notes', async () => {
  const state = setup('%% Begin Parent-Link %%\nImportant body');
  const earlier = new state.TFile('Earlier.md', 'Projects/Earlier/Earlier.md');
  state.root.children[0].children.unshift({ name: 'Earlier', children: [earlier] });
  state.files.set(earlier.path, earlier);
  state.contents.set(earlier.path, 'Earlier body');
  await state.plugin.refresh();
  assert.equal(state.writes.length, 0);
  assert.equal(state.contents.get(earlier.path), 'Earlier body');
  assert.equal(state.contents.get(state.child.path), '%% Begin Parent-Link %%\nImportant body');
  assert.match(state.notices[0], /malformed/i);
});
