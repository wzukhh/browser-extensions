# Word → PDF Converter

> English | [简体中文](./README.md)

A Chrome/Edge extension that batch-converts Word documents to PDF. **Windows only** (drives local Office/WPS through the COM interface).

## How it works

The extension itself cannot call Office/WPS directly, so a Go local bridge is launched via **Native Messaging**:

```
Click the extension icon
    ↓
Service Worker → open loading.html → launch the Go binary
    ↓
Go binary: detect Office/WPS → start the embedded HTTP server
    ↓
Web UI opens in a new browser tab
    ↓
Pick source folder → pick target folder → click Convert
    ↓
Go drives Office/WPS through the go-ole COM interface, file by file
    ↓
SSE pushes real-time progress → Web UI shows conversion records
    ↓
Done → success/failure result list
```

## Requirements

- **OS**: Windows 7 or later
- **Office**: Microsoft Office 2007+ or WPS Office
- **Browser**: Google Chrome or Microsoft Edge
- **Go 1.21+** (only needed to compile from source — not required for normal use)

## Quick start

### 1. Download / build

```bash
# Option 1: use the prebuilt binary (recommended)
# grab word2pdf-converter.exe from build/windows/

# Option 2: build yourself (on Windows, or in a cross-compile environment)
cd src
GOOS=windows GOARCH=amd64 go build -o word2pdf-converter.exe .
```

### 2. Install the Native Host

```bat
scripts\install.bat
```

The install script:
1. Copies the binary to `%APPDATA%\Word2PDF-Converter\`
2. Writes the Native Messaging Host manifest file
3. Adds Chrome and Edge registry entries

### 3. Load the extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` directory
5. Click the extension icon in the toolbar to start

### 4. Uninstall

```bat
scripts\uninstall.bat
```

## Directory structure

```
word2pdf-converter/
├── src/                       # Go local bridge source (Windows)
│   ├── main.go                # Entry point + Native Messaging protocol
│   ├── detector.go            # Office/WPS COM detection
│   ├── converter.go           # Conversion core (go-ole COM calls)
│   ├── server.go              # HTTP API + SSE real-time push
│   ├── platform.go            # Folder picker, Explorer open
│   ├── cleanup.go             # Process cleanup
│   ├── web_embed.go           # //go:embed embedded frontend
│   ├── web/                   # Web UI
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   ├── go.mod / go.sum
├── extension/                 # Browser extension
│   ├── manifest.json
│   ├── background.js
│   ├── loading.html / loading.js
│   └── icons/
├── scripts/
│   ├── install.bat
│   └── uninstall.bat
├── build/windows/             # Prebuilt binary
├── key.pem                    # Extension private key (fixed extension ID)
├── native-host-template.json
├── Makefile
└── README.md
```

## Usage

1. **Pick a source folder**: click "Select folder" and choose a directory containing .doc/.docx files
2. **Pick a target folder** (optional): defaults to `word2pdf_output` inside the source folder
3. **Convert**: click "Start conversion" and wait
4. **Results**: click "View results" to see the success/failure list
5. **Open the output folder**: click "📂 Open output folder" to reveal it in Explorer

> ⚠️ Do not manually open WPS or Word documents while the extension is running — those processes are closed when the extension exits.

## Tech stack

- **Backend**: Go 1.21+, [go-ole](https://github.com/go-ole/go-ole) (COM interface), golang.org/x/sys (Windows API)
- **Frontend**: Vanilla HTML/CSS/JS (no framework, embedded in the Go binary)
- **Extension**: Manifest V3, Native Messaging API
- **Communication**: SSE (Server-Sent Events) real-time push

## Dev notes

Pitfalls encountered during development: [`docs/word2pdf-dev-pitfalls.md`](../docs/word2pdf-dev-pitfalls.md) (in Chinese).

A general guide to Chrome extension + Go Native Service development: [`docs/chrome-extension-go-native-service-guide.md`](../docs/chrome-extension-go-native-service-guide.md) (in Chinese).

## License

MIT
