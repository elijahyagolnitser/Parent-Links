# Parent Folder Links

An Obsidian plugin that adds a link from a folder note to its immediate parent folder's note.

## Folder structure

A folder note must have the same name as its containing folder:

```text
Projects/
  Projects.md
  Example/
    Example.md
```

Refreshing adds the following block to `Example.md`:

```markdown
%% Begin Parent-Link %%
[[Projects]]
%% End Parent-Link %%
```

The parent folder must also have a matching folder note. Ordinary notes are not changed. Missing folder notes are not created.

## Installation

Until this plugin is listed in Community Plugins:

1. Download `main.js` and `manifest.json` from a GitHub release.
2. Create a `parent-links` folder inside your vault's `.obsidian/plugins/` folder.
3. Place both downloaded files in that folder.
4. Reload Obsidian and enable **Parent Folder Links** in Settings → Community plugins.

## Usage

Back up your vault before the first refresh: this plugin edits Markdown files.

Run **Parent Folder Links: Refresh parent links** from the command palette, or click the up-arrow ribbon icon. Refresh is manual; the plugin does not automatically run when files change.

The plugin replaces its existing marked blocks and inserts the current block after YAML frontmatter, or at the beginning of a note without frontmatter. Keep the marker lines intact and do not put your own content inside the generated block.

If an eligible note has unmatched or nested markers, refresh stops before writing any notes and displays an error identifying the affected file. Repair its markers before retrying. A valid block is replaced in full, so keep personal text outside the markers.

## Current limitations

- Links use the parent folder's name, not its full path. Duplicate folder-note names can lead to ambiguous links.
- Refresh does not remove stale blocks from notes that no longer have a matching parent folder note.
- Legacy lines containing `<!-- Parent-Link -->` are removed during refresh.
- Existing leading blank lines can be removed.
- Every eligible folder note is written during refresh, even when its generated content has not changed.

The plugin uses Obsidian's vault API and makes no network requests. Desktop and mobile support is declared in the manifest; mobile behavior has not been independently tested for this package.

## Development

`main.js` is the readable JavaScript source as well as the runtime entry point. No build step or npm dependencies are required.

With Node.js 18 or later, run:

```sh
node --check main.js
node --test tests/plugin.test.cjs
```

The tests use an in-memory Obsidian mock and do not access a real vault.

## Release notes

### 1.0.0

Initial release with manual parent-folder links and validation that stops refresh when generated block markers are unmatched or nested.
