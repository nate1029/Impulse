# Impulse IDE

An AI-native desktop IDE for Arduino development, built with Electron + Vite.

Impulse IDE combines Arduino CLI workflows (compile/upload/board and library management) with an integrated AI assistant, serial tooling, and a modern multi-panel editor experience.

## Why This Exists

- Fast local Arduino workflow with no cloud lock-in for core IDE tasks
- AI assistant that can reason over your current IDE state and invoke tools
- Secure Electron architecture (`preload` bridge + IPC validation)
- Cross-platform packaging with `electron-builder`

## Core Capabilities

- Compile and upload sketches via `arduino-cli`
- Board, port, core, and library workflows from the UI
- Real-time serial monitor with reconnect-aware behavior
- AI assistant with multi-provider support (OpenAI, Gemini, Claude)
- Structured IPC layer with schema validation (`zod`)
- Auto-update integration (safe no-op in dev mode)

## Tech Stack

- `electron` / `electron-builder`
- `vite` (renderer build/dev server)
- `codemirror` (editor)
- `serialport` (serial I/O)
- `zod` (IPC payload validation)
- `electron-store` (local settings/key metadata)

## Project Layout

```text
src/
  main/
    main.js                 # Electron bootstrap + window/service wiring
    preload.js              # Secure renderer bridge
    ipc/                    # Feature-specific IPC handlers
    services/
      arduinoService.js     # arduino-cli orchestration
      serialMonitor.js      # serial connection lifecycle + events
      ai/                   # agent, providers, tools, prompting, memory
    utils/                  # logging, validation, notifications, error handling
  renderer/
    index.html              # app shell
    main.js                 # Vite entrypoint
    renderer.js             # main UI controller
    styles.css              # UI system and themes
docs/
  BUILD_AND_SIGN.md         # packaging/signing notes
  RELEASE.md                # release process
```

## Quick Start

### 1) Prerequisites

- Node.js 18+ (recommended)
- Arduino CLI in `PATH`
  - Windows: `winget install Arduino.ArduinoCLI`
  - Verify: `arduino-cli version`

### 2) Install

```bash
npm install
```

### 3) Run in Development

```bash
npm run dev
```

This starts:

- Vite dev server (renderer)
- Electron main process with `--dev`

### 4) Run Production-like Desktop Build Locally

```bash
npm start
```

## Build and Ship

- Windows: `npm run build:win`
- macOS: `npm run build:mac`
- Linux: `npm run build:linux`
- All targets: `npm run build:all`

Artifacts are created in `dist/`.

For signing and release details, see:

- [docs/BUILD_AND_SIGN.md](docs/BUILD_AND_SIGN.md)
- [docs/RELEASE.md](docs/RELEASE.md)

## Scripts

- `npm run dev` - Vite + Electron dev mode
- `npm start` - launch Electron app
- `npm run build:renderer` - build renderer bundle only
- `npm run build` - renderer build + electron-builder
- `npm run test` - Jest tests
- `npm run lint` - ESLint checks

## AI Assistant Architecture (At a Glance)

The assistant lives in `src/main/services/ai/` and is orchestrated by `agent.js`.

- Provider abstraction: `providers/baseProvider.js`
- Provider implementations:
  - `providers/openaiProvider.js`
  - `providers/geminiProvider.js`
  - `providers/claudeProvider.js`
- Tool contracts: `tools/toolSchema.js`
- Tool execution/router: `tools/toolExecutor.js`
- Persistent lightweight memory: `memory/simpleMemory.js`
- Prompt strategy: `prompts/systemPrompt.js`

### Agent Modes

- `agent` - tool-enabled execution
- `ask` - no tool execution, direct model response
- `debug` - debugging-oriented behavior with targeted tools

## Security Model

- Renderer has no direct Node access
- All privileged actions cross `preload.js` + validated IPC
- IPC payloads validated in `src/main/ipc/schemas.js`
- External side effects are centralized in main-process services

## Troubleshooting

### `npm run dev` fails during Electron startup

- Confirm dependencies are installed: `npm install`
- Rebuild native modules if needed: `npm run postinstall`
- Verify CLI: `arduino-cli version`

### Arduino CLI not found

- Install Arduino CLI and ensure it is in `PATH`
- Restart terminal/IDE after installation

### Serial monitor issues

- Ensure port is not busy in another app
- Reconnect USB device and refresh ports
- Check board/driver visibility in Device Manager (Windows)

### Renderer not loading in dev

- Confirm Vite is up on `http://localhost:5173`
- If port is occupied, free it or change Vite port and dev command accordingly

## For AI Agents and Automation

If you are an AI agent operating on this repo, prioritize this workflow:

1. Read `package.json` scripts and `src/main/main.js` wiring.
2. Treat `src/main/ipc/` as the contract boundary.
3. Keep renderer logic in `src/renderer/` and privileged actions in `src/main/services/`.
4. Prefer additive, schema-validated IPC changes over ad-hoc event channels.
5. Run `npm run lint` and targeted tests after substantial edits.
6. Avoid committing generated artifacts unless explicitly requested.

## License

MIT
