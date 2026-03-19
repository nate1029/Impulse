# Impulse IDE

An AI-powered desktop application for Arduino / IoT development — intelligent compilation, upload, serial monitoring, and error detection. (Also known as Arduino IDE Cursor.)

## Features

- ✅ **Compile Arduino Sketches** - Uses Arduino CLI to compile sketches
- ✅ **Upload to Boards** - Upload compiled code to Arduino boards
- ✅ **Serial Monitor** - Real-time serial communication with automatic baud rate detection
- ✅ **Error Detection & Memory** - Intelligent error analysis with growing memory of past errors and fixes
- ✅ **Modern UI** - Clean, dark-themed interface built with Electron
- ✅ **Windows Executable** - Packaged as .exe for easy distribution

## Prerequisites

1. **Arduino CLI** - Must be installed and available in your PATH
   - Download from: https://arduino.github.io/arduino-cli/
   - Or install via: `winget install Arduino.ArduinoCLI` (Windows)

2. **Node.js** - Version 16 or higher
   - Download from: https://nodejs.org/

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

Run the application in development mode:
```bash
npm run dev
```

Run the application normally:
```bash
npm start
```

## Building

Build a Windows executable:
```bash
npm run build:win
```

The executable will be created in the `dist` folder. The packaged app has **no CDN dependency**: CodeMirror and fonts are bundled; the app runs offline. For code signing (to avoid Windows SmartScreen warnings) and clean-machine testing, see [docs/BUILD_AND_SIGN.md](docs/BUILD_AND_SIGN.md). Release and changelog process: [docs/RELEASE.md](docs/RELEASE.md).

## Usage

### First Time Setup

1. Launch the application
2. Click "Check Arduino CLI" to verify Arduino CLI is installed
3. If not installed, install Arduino CLI and ensure it's in your PATH

### Compiling a Sketch

1. Enter the full path to your `.ino` sketch file (or click Browse)
2. Select your Arduino board from the dropdown
3. Click "Compile" to compile your sketch
4. View compilation output in the "Compilation Output" panel

### Uploading to Board

1. Ensure your sketch is compiled successfully
2. Select the COM port where your Arduino is connected
3. Click "Upload" to upload the compiled code to your board

### Serial Monitor

1. Select the serial port from the dropdown
2. Choose the baud rate (default: 115200)
3. Click "Connect" to start monitoring
4. View incoming data in real-time
5. Type messages in the input field and click "Send" to send data to the board

### Error Analysis

- When compilation or upload fails, the error is automatically analyzed
- The system checks its memory for similar past errors
- Suggested fixes are displayed with confidence scores
- Error history is maintained and can be viewed in the "Error History" panel

## Usage Examples

### Opening a sketch from the renderer (preload API)
The renderer uses `window.electronAPI` (exposed via preload). Example: open a file and read it.
```javascript
const result = await window.electronAPI.dialog.openFile();
if (result.success && result.filePath) {
  const fileResult = await window.electronAPI.file.read(result.filePath);
  if (fileResult.success) console.log(fileResult.content);
}
```

### Compiling and uploading
```javascript
const boardFQBN = 'arduino:avr:uno';
const port = 'COM3';
const compileResult = await window.electronAPI.arduino.compile(sketchPath, boardFQBN);
if (compileResult.success) {
  const uploadResult = await window.electronAPI.arduino.upload(sketchPath, boardFQBN, port);
}
```

### AI assistant (after setting a model and API key)
```javascript
const result = await window.electronAPI.ai.processQuery('Why does my LED not blink?', { code: editorCode, hasFileOpen: true }, 'agent');
if (result.success && result.data?.response) console.log(result.data.response);
```

## Debug logging

To enable debug logs (function entry/exit and timing for IPC handlers), set the environment variable before starting the app:
- **Windows (PowerShell):** `$env:IMPULSE_IDE_DEBUG="1"; npm run dev`
- **Windows (CMD):** `set IMPULSE_IDE_DEBUG=1 && npm run dev`
- **macOS/Linux:** `IMPULSE_IDE_DEBUG=1 npm run dev`

Logs are written to the terminal where you started the app.

## Testing and lint

```bash
npm run test   # Run Jest tests (IPC validation schemas)
npm run lint   # Run ESLint on src/main
```

## Architecture

### Main Process (`src/main/`)
- `main.js` - Electron main process; creates window and registers IPC
- `preload.js` - Secure bridge between main and renderer (exposes `electronAPI`)
- `ipc/` - IPC handlers by feature (shell, UI, arduino, serial, dialog, file, lib, errors, AI, API keys); input validated with Zod
- `utils/logger.js` - Debug logging (behind `IMPULSE_IDE_DEBUG`)
- `services/arduinoService.js` - Arduino CLI integration
- `services/serialMonitor.js` - Serial port communication
- `services/errorMemory.js` - Error detection and memory system
- `services/ai/` - AI agent, providers (OpenAI, Gemini, Claude), tools, memory

### Renderer Process (`src/renderer/`)
- `index.html` - Application UI structure
- `styles.css` - Application styling
- `renderer.js` - Frontend logic and UI interactions

## How It Works

### Arduino CLI Integration
The application uses Arduino CLI (not the Arduino IDE executable) to:
- Compile sketches
- Upload code to boards
- List available boards and ports
- Manage Arduino cores and libraries

### Serial Monitor
- Uses `serialport` library for cross-platform serial communication
- Supports automatic baud rate detection
- Real-time data streaming with timestamps

### Error Memory System
- Stores errors in JSON format in user's app data directory
- Extracts error patterns (undefined references, compilation errors, etc.)
- Matches new errors with past errors
- Suggests fixes based on historical data
- Learns from user-provided fixes

## Dependencies (package.json)

| Package | Purpose | Note |
|--------|---------|------|
| `zod` | Runtime input validation for IPC | Used in `src/main/ipc/schemas.js`; safe defaults on invalid input |
| `electron`, `electron-builder` | App and build | Required |
| `@anthropic-ai/sdk`, `@google/generative-ai`, `openai` | AI providers | Used by AI agent |
| `serialport`, `@serialport/parser-readline` | Serial monitor | Required for serial I/O |
| `electron-store` | Settings storage | Used for preferences |
| `chokidar` | File watching | Used for project/file tree |
| `sql.js` | SQLite in-memory | Used by `services/ai/memory/aiMemory.js` (optional AI memory backend) |
| `node-pty` | Terminal emulation | Reserved for future features (e.g. integrated terminal); not used by current UI. Can be removed if you do not plan to add a terminal. |

**Suggestions:**  
- **node-pty**: Optional. Remove from `dependencies` if you do not need an integrated terminal to reduce install size and native rebuilds.  
- Run `npm audit` and consider `npm audit fix` for reported vulnerabilities (avoid `--force` unless you accept breaking changes).

## Configuration

Error memory is stored in:
- **Windows**: `%APPDATA%\arduino-ide-cursor\error-memory.json`
- **macOS**: `~/Library/Preferences/arduino-ide-cursor/error-memory.json`
- **Linux**: `~/.config/arduino-ide-cursor/error-memory.json`

## Troubleshooting

### Arduino CLI Not Found
- Ensure Arduino CLI is installed
- Verify it's in your system PATH
- Try running `arduino-cli version` in a terminal to verify

### Serial Port Issues
- Ensure no other application is using the serial port
- Check device manager (Windows) to verify the port exists
- Try disconnecting and reconnecting the Arduino

### Compilation Errors
- Verify the sketch path is correct
- Ensure the selected board matches your hardware
- Check that required libraries are installed via Arduino CLI

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

