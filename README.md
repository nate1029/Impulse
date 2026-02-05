# Arduino IDE Cursor

An AI-powered desktop application that acts as a "Cursor for Arduino / IoT" - providing intelligent compilation, upload, serial monitoring, and error detection capabilities.

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

The executable will be created in the `dist` folder.

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

## Architecture

### Main Process (`src/main/`)
- `main.js` - Electron main process, handles IPC communication
- `preload.js` - Secure bridge between main and renderer processes
- `services/arduinoService.js` - Arduino CLI integration
- `services/serialMonitor.js` - Serial port communication
- `services/errorMemory.js` - Error detection and memory system

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

