# JSON Formatter

> English | [简体中文](./README.md)

> Offline JSON toolkit — format, minify, tree view, format conversion, code generation

## Usage

### Load the extension

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. "Load unpacked" → select the `extension/` directory
4. Click the 📦 toolbar icon to open

### Features

| Feature | Description |
|---------|-------------|
| ✨ Format | Beautify JSON (2/4-space indent) |
| 🗜️ Minify | Strip extra whitespace |
| 🔤 Sort | Sort JSON object keys |
| ↪️ Escape / ↩️ Unescape | JSON string escaping |
| 🌳 Tree view | Auto-generated from valid JSON input |
| 🔄 Convert | JSON ↔ YAML / XML / TOML |
| 📄 Code generation | JSON → TypeScript / Go / Python / Java / C# / Rust type definitions |
| 🔑 JWT decode | Decode JWT tokens |
| 🔗 URL encode/decode | URL percent-encoding (query parameter use case) |
| 🔤 Base64 encode/decode | UTF-8 safe Base64 |
| 📂 Open file / 🌐 URL import | Load JSON from a file or URL |
| 💾 Download / 📋 Copy | Export results |

### Context menu

- Select JSON text on a page → right-click → "Format selected JSON"
- Right-click empty page space → "Extract JSON data from page"

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode (auto rebuild)
npm run watch
```

Build output goes to the `extension/` directory.
