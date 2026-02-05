# Setup Guide

## Quick Start

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/ (v16 or higher recommended)

2. **Install Arduino CLI**
   - Windows: `winget install Arduino.ArduinoCLI`
   - Or download from: https://arduino.github.io/arduino-cli/
   - Verify installation: Open terminal and run `arduino-cli version`

3. **Install Project Dependencies**
   ```bash
   npm install
   ```

4. **Run the Application**
   ```bash
   npm start
   ```
   Or for development mode with DevTools:
   ```bash
   npm run dev
   ```

## Building Executable

To create a Windows .exe file:

```bash
npm run build:win
```

The executable will be in the `dist` folder.

**Note:** For the build to work properly, you may need to:
- Add an icon file at `assets/icon.ico` (for Windows)
- The icon should be at least 256x256 pixels

## Arduino CLI Setup

After installing Arduino CLI, you may need to:

1. **Update core index:**
   ```bash
   arduino-cli core update-index
   ```

2. **Install a board core** (e.g., Arduino Uno):
   ```bash
   arduino-cli core install arduino:avr
   ```

3. **Verify installation:**
   ```bash
   arduino-cli board listall
   ```

## Troubleshooting

### "Arduino CLI Not Found" Error

- Ensure Arduino CLI is in your system PATH
- On Windows, you may need to restart your terminal/IDE after installation
- Try running `arduino-cli version` in a new terminal to verify

### Serial Port Issues

- Close any other applications using the serial port (Arduino IDE, Serial Monitor, etc.)
- On Windows, check Device Manager to see if the port is recognized
- Try unplugging and replugging your Arduino board

### Build Errors

- Ensure all dependencies are installed: `npm install`
- For native modules (like serialport), you may need:
  - Windows: Visual Studio Build Tools
  - Run: `npm install --build-from-source` if needed

### Missing Icon Warning

The application will work without an icon, but for a proper build:
- Create or download a `.ico` file (256x256 recommended)
- Place it at `assets/icon.ico`
- Update `package.json` if using a different path

## Development Tips

- Use `npm run dev` to open DevTools automatically
- Check the console for detailed error messages
- Error memory is stored in your app data directory (see README.md)

