<div align="center">

<img src="assets/chip.svg" width="80" alt="Impulse IDE Logo" />

# Impulse IDE

**The AI-powered Arduino & IoT development environment.**  
Write smarter firmware, catch errors before they happen, and talk to your hardware — all in one place.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/your-github-org/arduino-ide-cursor/releases)
[![Electron](https://img.shields.io/badge/built%20with-Electron-47848f?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

---

## 🎬 Introduction Video

<a href="https://www.youtube.com/watch?v=kYRS4bwMa9A" target="_blank">
  <img src="https://img.youtube.com/vi/kYRS4bwMa9A/maxresdefault.jpg" alt="Impulse IDE Introduction Video" width="800" />
</a>

> ▶ Click the thumbnail above to watch the introduction on YouTube.

---

## ✨ What is Impulse?

Impulse IDE is a **Cursor-style development environment built specifically for Arduino and IoT**. It replaces the bare-bones Arduino IDE with a modern, AI-assisted workflow — letting you compile, upload, and debug firmware while having a conversation with GPT-4, Claude, or Gemini right inside the editor.

Think of it as **VS Code + Arduino IDE + an AI co-pilot**, packaged as a single desktop app.

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🤖 **AI Assistant** | Chat with GPT-4, Claude, or Gemini directly from the IDE. Ask questions, get code suggestions, or let the AI compile and upload for you via tool calls. |
| ⚡ **One-Click Compile & Upload** | Powered by Arduino CLI — compile sketches and flash boards without touching a terminal. |
| 📡 **Smart Serial Monitor** | Real-time serial communication with automatic baud rate detection and timestamped output. |
| 🧠 **Error Memory** | Impulse remembers past errors and their fixes. When the same error recurs, it surfaces the solution automatically. |
| 📝 **CodeMirror Editor** | Full-featured code editor with C/C++ syntax highlighting, line numbers, and bracket matching — fully offline, no CDN. |
| 🔌 **Multi-board Support** | Board and port detection are driven by Arduino CLI, supporting the entire Arduino ecosystem. |
| 🔐 **Secure by Default** | Context isolation, encrypted API key storage, and validated IPC channels — no shell injection. |
| 📦 **Offline-First Build** | The packaged `.exe` / `.dmg` / `.AppImage` runs fully offline. CodeMirror and fonts are bundled — no internet required at runtime. |

---

## 📸 Interface Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Impulse IDE                               │
├──────────────┬─────────────────────────────┬───────────────────────┤
│   Sidebar    │       Code Editor           │    AI Assistant       │
│              │                             │                       │
│ • Open File  │  • Syntax highlighting      │ • Natural language    │
│ • Board      │  • Line numbers             │ • Multi-model         │
│ • Port       │  • Auto-complete            │ • Tool execution      │
│ • Verify     │                             │ • Error analysis      │
│ • Upload     │                             │                       │
│              ├─────────────────────────────┤                       │
│ • Serial     │      Output Panel           │                       │
│              │  • Console                  │                       │
│              │  • Serial Monitor           │                       │
│              │  • Problems                 │                       │
└──────────────┴─────────────────────────────┴───────────────────────┘
```

---

## 🛠 Prerequisites

### 1. Arduino CLI
Impulse uses the **Arduino CLI** (not the Arduino IDE) under the hood.

```bash
# Windows (winget)
winget install Arduino.ArduinoCLI

# macOS (Homebrew)
brew install arduino-cli

# Or download directly from:
# https://arduino.github.io/arduino-cli/
```

Verify the install:
```bash
arduino-cli version
```

### 2. Node.js 16+
Download from [nodejs.org](https://nodejs.org/)

---

## ⚙️ Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-github-org/arduino-ide-cursor.git
cd arduino-ide-cursor

# 2. Install dependencies
npm install
```

---

## 💻 Running Locally

```bash
# Development mode (hot reload)
npm run dev

# Production mode
npm start
```

---

## 📦 Building a Distributable

```bash
# Windows (.exe installer)
npm run build:win

# macOS (.dmg — Intel + Apple Silicon)
npm run build:mac

# Linux (.AppImage + .deb)
npm run build:linux

# All platforms
npm run build:all
```

The output lands in the `dist/` folder.

> For code signing (to avoid Windows SmartScreen warnings) and clean-machine testing, see [docs/BUILD_AND_SIGN.md](docs/BUILD_AND_SIGN.md).
> For the release and changelog process, see [docs/RELEASE.md](docs/RELEASE.md).

---

## 🧭 Usage Guide

### First-Time Setup
1. Launch Impulse IDE.
2. Click **"Check Arduino CLI"** to confirm the CLI is detected.
3. In the AI panel, select your provider (OpenAI / Gemini / Claude) and enter your API key.

### Compiling a Sketch
1. Click **Browse** or paste the path to your `.ino` file.
2. Select your **board** from the dropdown (auto-populated by Arduino CLI).
3. Hit **Verify** — compilation output appears in the Console panel.

### Uploading to a Board
1. After a successful compile, select the **COM port** where your Arduino is connected.
2. Click **Upload**.

### Using the Serial Monitor
1. Select the **serial port** and **baud rate** (default: 115200).
2. Click **Connect** — data streams in real time with timestamps.
3. Type in the input field and click **Send** to write data back to the board.

### AI Assistant
Ask anything in plain English:

> *"Why is my LED not blinking?"*
> *"Compile my sketch and upload it to COM3."*
> *"What does `undefined reference to 'setup'` mean?"*

The AI can autonomously call tools to compile, upload, read the serial monitor, and look up past errors — no copy-pasting required.

---

## 🔌 API Reference (Renderer)

The renderer communicates with the main process through a secure preload bridge (`window.electronAPI`).

### Open a file
```javascript
const result = await window.electronAPI.dialog.openFile();
if (result.success && result.filePath) {
  const file = await window.electronAPI.file.read(result.filePath);
  console.log(file.content);
}
```

### Compile and upload
```javascript
const boardFQBN = 'arduino:avr:uno';
const port = 'COM3';

const compile = await window.electronAPI.arduino.compile(sketchPath, boardFQBN);
if (compile.success) {
  await window.electronAPI.arduino.upload(sketchPath, boardFQBN, port);
}
```

### AI query
```javascript
const result = await window.electronAPI.ai.processQuery(
  'Why does my LED not blink?',
  { code: editorCode, hasFileOpen: true },
  'agent'
);
console.log(result.data?.response);
```

---

## 🐛 Debug Logging

Enable verbose IPC logs by setting `IMPULSE_IDE_DEBUG=1` before starting the app:

| Shell | Command |
|---|---|
| PowerShell | `$env:IMPULSE_IDE_DEBUG="1"; npm run dev` |
| CMD | `set IMPULSE_IDE_DEBUG=1 && npm run dev` |
| macOS / Linux | `IMPULSE_IDE_DEBUG=1 npm run dev` |

---

## 🧪 Testing & Linting

```bash
npm run test     # Jest unit tests (IPC schema validation)
npm run lint     # ESLint on src/main/
npm run lint:fix # Auto-fix linting issues
npm audit        # Check for dependency vulnerabilities
```

---

## 🏗 Architecture

Impulse is built on **Electron** with a clean main/renderer split.

### Main Process (`src/main/`)

| File / Folder | Role |
|---|---|
| `main.js` | App entry point; creates the window and registers all IPC handlers |
| `preload.js` | Secure bridge — exposes `window.electronAPI` to the renderer |
| `ipc/` | Feature-grouped IPC handlers (arduino, serial, AI, file, dialog, …); inputs validated with **Zod** |
| `services/arduinoService.js` | Arduino CLI integration (compile, upload, list boards/ports) |
| `services/serialMonitor.js` | Serial port communication via `serialport` |
| `services/errorMemory.js` | Error detection and JSON-based memory |
| `services/ai/` | AI agent, provider adapters (OpenAI / Gemini / Claude), tool system, memory |

### Renderer Process (`src/renderer/`)

| File | Role |
|---|---|
| `index.html` | Application shell |
| `styles.css` | All UI styling |
| `renderer.js` | Frontend logic and UI interactions |

### AI Tool System

The AI agent can autonomously invoke the following tools:

| Tool | Description |
|---|---|
| `compile_sketch` | Compile the current sketch |
| `upload_sketch` | Flash the compiled binary to the board |
| `list_boards` | Enumerate available boards |
| `list_ports` | Enumerate connected serial ports |
| `connect_serial` | Open the serial monitor |
| `disconnect_serial` | Close the serial monitor |
| `send_serial` | Send a message over serial |
| `read_serial` | Read recent serial output |
| `analyze_error` | Analyze a compiler error |
| `search_memory` | Look up past errors and fixes |
| `record_fix` | Save a successful fix to memory |

For a deeper technical dive, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 🔧 Troubleshooting

**Arduino CLI not found**
- Run `arduino-cli version` in a terminal to confirm it's on your PATH.
- On Windows, you may need to restart your terminal or add the install directory to `PATH` manually.

**Serial port not detected**
- Ensure no other application (e.g., the Arduino IDE) is holding the port open.
- Open Device Manager on Windows and verify the COM port exists.
- Try unplugging and re-plugging the Arduino.

**Compilation errors**
- Double-check the sketch path is correct.
- Make sure the selected board FQBN matches your hardware.
- Install any missing libraries: `arduino-cli lib install "LibraryName"`.

**Windows SmartScreen warning**
- The executable is unsigned in development builds. See [docs/BUILD_AND_SIGN.md](docs/BUILD_AND_SIGN.md) to sign releases.

---

## 📁 Error Memory Location

Impulse persists error history to:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\arduino-ide-cursor\error-memory.json` |
| macOS | `~/Library/Preferences/arduino-ide-cursor/error-memory.json` |
| Linux | `~/.config/arduino-ide-cursor/error-memory.json` |

---

## 📋 Dependencies

| Package | Purpose |
|---|---|
| `electron` | Desktop app framework |
| `electron-builder` | Cross-platform packaging |
| `vite` | Renderer bundler |
| `zod` | Runtime IPC input validation |
| `serialport` + `@serialport/parser-readline` | Serial monitor |
| `codemirror` | Code editor |
| `@anthropic-ai/sdk` | Claude provider |
| `@google/generative-ai` | Gemini provider |
| `openai` | OpenAI provider |
| `electron-store` | Encrypted settings & API key storage |
| `electron-updater` | Auto-update support |
| `chokidar` | File watching |
| `sql.js` | In-memory SQLite for optional AI memory backend |
| `node-pty` | Reserved for future integrated terminal |
| `yjs` + `y-webrtc` | Reserved for future collaborative editing |

> **Tip**: `node-pty` can be removed from `dependencies` if you don't plan to add an integrated terminal — it reduces install size and avoids native rebuild overhead.

---

## 🗺 Roadmap

- [ ] Multiple file / project support
- [ ] Built-in library manager
- [ ] Board manager (install cores from GUI)
- [ ] Git integration
- [ ] Sketch templates
- [ ] Arduino-aware auto-complete
- [ ] Live error detection (compile-on-save)
- [ ] Integrated terminal (`node-pty`)
- [ ] Collaborative editing (`yjs`)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repo and create a feature branch.
2. Run `npm run lint` and `npm run test` before opening a PR.
3. Open an issue first for large changes so we can discuss the approach.

---

## 📄 License

[MIT](LICENSE) © Impulse IDE Contributors
