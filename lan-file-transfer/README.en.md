# 📁 LAN File Transfer - Chrome Extension

> English | [简体中文](./README.md)

Transfer files between your computer and phone by scanning a QR code. **All data stays on your local network — nothing is uploaded to the internet.**

Supports **multi-device isolation**: multiple phones can be connected at once, and each device only sees its own data.

## Quick start

```bash
# 1. Clone the project
git clone https://github.com/wzukhh/browser-extensions.git
cd browser-extensions/lan-file-transfer

# 2. Install the Native Host (choose your platform)
# macOS / Linux
bash scripts/install.sh

# Windows (double-click or run from the command line)
scripts\install.bat

# 3. Load the Chrome extension
#    Open chrome://extensions → enable "Developer mode"
#    → click "Load unpacked" → select the extension/ directory

# 4. Click the 📁 icon in the Chrome toolbar to start
```

> The extension ID is fixed as `ieaemhcnhkcapbjdlioehibecafmegca` via the `key` in manifest.json — identical on every machine, no manual configuration needed.

## Architecture

```
Click the extension icon → launch the Go local service → open a new tab → show QR code
                                                              ↓
                                               phones scan → independent transfers
```

| Module | Tech |
|--------|------|
| Extension | Manifest V3, Service Worker |
| Backend | Go 1.21+, net/http, embed.FS |
| Frontend | Vanilla HTML/CSS/JS, QRCode.js |
| Push | Server-Sent Events (SSE) |
| Transfer | HTTP multipart upload, 200 MB/file limit |
| Security | Random token verification, per-device isolation |

## Features

### Multi-device isolation
- Each phone sets a device name on first connection
- Each phone only sees the files it uploaded and the files the computer sent to it
- The computer sees all devices and can filter by device

### Computer side (PC layout)
```
┌─────────────┬──────────────────────────────┐
│   QR code   │  Connected devices: 🟢 A 🟢 B │
│   URL link  │  Send to: [All] [A] [B]      │
│             │  ┌─Upload button─────────────┐ │
│             │  │ Sent | Received [All] [A] │ │
│             │  │ File list...              │ │
│             │  └───────────────────────────┘ │
└─────────────┴──────────────────────────────┘
```
- **Upload**: pick target devices (multi-select); files go only to the selected devices
- **Sent**: history per device, filterable
- **Received**: files uploaded by phones, filterable by source

### Phone side
- First use prompts for a device name
- Device name shown in the header, editable at any time ✏️
- "Sent": only files this phone uploaded
- "Received": only files the computer sent to this phone

### Data isolation rules
| Scenario | Visible to |
|----------|------------|
| Phone A uploads | PC and phone A only |
| Phone B uploads | PC and phone B only |
| PC upload + specified devices | Target devices only |
| PC upload (unspecified) | All devices (broadcast) |

## Project structure

```
lan-file-transfer/
├── src/                          # Go source + embedded frontend
│   ├── main.go                   # Entry point + Native Messaging protocol
│   ├── server.go                 # HTTP server + file handling + SSE
│   ├── go.mod                    # Go module (no external dependencies)
│   └── web/                      # Frontend pages (embedded via embed.FS)
│       ├── index.html
│       ├── style.css
│       └── app.js
│
├── extension/                    # Chrome extension (load this dir in dev)
│   ├── manifest.json             # MV3 manifest (with fixed key)
│   ├── background.js             # Service Worker
│   ├── loading.html / .js        # Startup loading page
│   └── icons/                    # Icons (16/48/128)
│
├── build/                        # Prebuilt binaries (committed to the repo)
│   ├── windows/
│   │   └── lan-file-transfer.exe
│   ├── macos/
│   │   ├── lan-file-transfer        # Apple Silicon
│   │   └── lan-file-transfer-intel  # Intel
│   └── linux/
│       └── lan-file-transfer
│
├── scripts/                      # Install/uninstall scripts
│   ├── install.sh                # macOS & Linux
│   ├── install.bat               # Windows
│   ├── uninstall.sh
│   └── uninstall.bat
│
├── key.pem                       # Extension signing key
├── Makefile                      # Build commands
├── native-host-template.json     # Native Host manifest template
└── README.md
```

## Installation details

### Native Host

The install script automatically:
- Copies the platform binary from `build/` to a system directory
- Registers with all installed Chromium-based browsers (Chrome / Chromium / Brave / Edge)

If no prebuilt binary exists for your platform in `build/`, the script compiles from source automatically.

### Binary install paths

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\LAN-File-Transfer\lan-file-transfer.exe` |
| macOS | `~/.local/share/lan-file-transfer/lan-file-transfer` |
| Linux | `~/.local/share/lan-file-transfer/lan-file-transfer` |

### Build manually

```bash
# Build for the current platform
make build

# Build for all platforms
make build-all
```

## Usage

### Computer side
1. Click the extension icon 📁 in the Chrome toolbar
2. The QR code panel shows on the left, with the scan URL below
3. The device panel on the right lists connected phones
4. Select target devices (multi-select) and click the upload button to send files
5. Use the device-filter pills above "Sent/Received" to filter files

### Phone side
1. Scan the QR code to open the page → set a device name on first use
2. Tap the device name in the header ✏️ to rename
3. Upload files: sent to the computer automatically (no target selection needed)
4. "Sent" tab: files this phone uploaded
5. "Received" tab: files the computer sent to this phone

### Two-way transfer
- 📱→💻: pick files on the phone and upload; the computer receives them automatically
- 💻→📱: pick target devices on the computer and send; refresh the phone to download

## Development mode

Test the HTTP server without installing the Chrome extension:

```bash
cd lan-file-transfer/src
go run . --serve

# or from the project root:
cd lan-file-transfer && go run ./src --serve
```

Open the printed address in a browser to use all features.

## Uninstall

```bash
# macOS / Linux
bash scripts/uninstall.sh

# Windows
scripts\uninstall.bat
```

Then remove the extension manually at `chrome://extensions`.

## Cross-platform support

Windows / macOS (Intel + Apple Silicon) / Linux
