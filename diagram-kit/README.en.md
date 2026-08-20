# DiagramKit

> English | [简体中文](./README.md)

A Chrome / Edge browser extension — Mermaid & Markmap diagram editor.

Click the extension icon to open a full-screen page with Mermaid diagram and Markmap mind-map editing, live render preview, and rendered-image export.

## Features

- **Multi-tool switching** — Switch between Mermaid / Markmap from the top bar; each tool keeps its own tabs, templates and archives
- **Editor** — CodeMirror 6 editor with Mermaid syntax and Markmap Markdown support
- **Live preview** — Mermaid renders as you type; Markmap Markdown generates the mind map in real time
- **Export** — One-click PNG / SVG export
- **Template library** — Independent Mermaid / Markmap libraries with add / edit / delete / batch management
- **Diagram archive** — Ctrl+S saves the current document, up to 50 entries, with switching and management
- **Themes** — 4 render themes (Default / Clear / Warm Tea / Mint), persistable
- **Shortcuts** — Ctrl+S save, Ctrl+N new, Ctrl+W close, Ctrl+Shift+E export
- **Draft recovery** — Changes are saved to the open tab in real time; refreshing never loses work; Ctrl+S moves the document into the archive

## Installation

### Option 1: Load release-plugin directly (recommended)

Open `chrome://extensions` in Chrome/Edge, enable "Developer mode" (top right), click "Load unpacked", and select the `release-plugin` folder.

> `release-plugin/` is a prebuilt bundle — no Node.js environment needed.

### Option 2: Build from source

```bash
cd diagram-kit
npm install
npm run build
```

After the build, load the `release-plugin/` directory. Build output is synced to `release-plugin/` automatically.

## Development

```bash
cd diagram-kit
npm run dev
```

The Vite dev server runs at `http://localhost:5173`. Storage falls back to `localStorage`; editing, saving, and themes all work normally.

## Build

```bash
npm run build
```

Outputs to `release-plugin/`, which can be loaded directly as an unpacked extension.
