# Arduino IDE Cursor - Architecture

## Overview

Arduino IDE Cursor is a **Cursor-style AI-powered IDE for Arduino/IoT development**. It provides an intelligent coding environment with AI assistance, serial monitoring, and seamless Arduino CLI integration.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Arduino IDE Cursor                           │
├──────────────┬─────────────────────────────┬───────────────────────┤
│   Sidebar    │      Code Editor            │    AI Assistant       │
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

## Tech Stack

- **Electron** - Desktop application framework
- **Arduino CLI** - Compile & upload (no IDE modification)
- **CodeMirror** - Code editor with syntax highlighting
- **SerialPort** - Serial communication
- **OpenAI/Gemini/Claude** - AI providers

## Directory Structure

```
src/
├── main/                           # Electron Main Process
│   ├── main.js                     # Entry point, IPC handlers
│   ├── preload.js                  # Secure bridge to renderer
│   └── services/
│       ├── arduinoService.js       # Arduino CLI operations
│       ├── serialMonitor.js        # Serial port communication
│       ├── errorMemory.js          # Legacy error tracking
│       └── ai/
│           ├── agent.js            # AI orchestrator
│           ├── providers/          # LLM adapters
│           │   ├── baseProvider.js
│           │   ├── openaiProvider.js
│           │   ├── geminiProvider.js
│           │   └── claudeProvider.js
│           ├── tools/              # Tool system
│           │   ├── toolSchema.js   # Tool definitions
│           │   └── toolExecutor.js # Tool execution
│           ├── memory/
│           │   └── simpleMemory.js # JSON-based memory
│           ├── prompts/
│           │   └── systemPrompt.js
│           └── config/
│               └── apiKeyManager.js
│
└── renderer/                       # Electron Renderer (UI)
    ├── index.html                  # Main HTML
    ├── styles.css                  # CSS styles
    └── renderer.js                 # UI logic
```

## Core Components

### 1. Arduino Service (`arduinoService.js`)

Handles all Arduino CLI operations:

```javascript
// Key methods
checkCLI()              // Verify CLI installed
listBoards()            // Get available boards (JSON)
listPorts()             // Get connected ports (JSON)
compile(sketch, fqbn)   // Compile sketch
upload(sketch, fqbn, port) // Upload to board
```

**FQBN Format**: `vendor:architecture:board`
- Example: `arduino:avr:uno`
- Validated before compile/upload

### 2. Serial Monitor (`serialMonitor.js`)

Real-time serial communication:

```javascript
connect(port, baudRate)  // Open connection
disconnect()             // Close connection
send(data)               // Send data
// Events: 'data', 'connected', 'disconnected', 'error'
```

### 3. AI Agent (`ai/agent.js`)

Orchestrates AI interactions:

```javascript
setProvider(name, apiKey, model)  // Configure LLM
processQuery(query, context)       // Process user input
analyzeError(error, context)       // Analyze errors
```

**Conversation Flow**:
1. User sends message
2. Agent builds context (sketch, board, port, code)
3. LLM processes with tool definitions
4. Tool calls executed by ToolExecutor
5. Results returned to user

### 4. Tool System (`ai/tools/`)

**Available Tools**:
| Tool | Description |
|------|-------------|
| `compile_sketch` | Compile Arduino sketch |
| `upload_sketch` | Upload to board |
| `list_boards` | List available boards |
| `list_ports` | List connected ports |
| `connect_serial` | Open serial monitor |
| `disconnect_serial` | Close serial |
| `send_serial` | Send data |
| `read_serial` | Read recent output |
| `analyze_error` | Analyze error message |
| `search_memory` | Search past errors |
| `record_fix` | Save successful fix |

### 5. Memory System (`ai/memory/simpleMemory.js`)

JSON-based persistence (no SQLite dependency):

```json
{
  "errors": [{ "signature": "...", "message": "...", "count": 1 }],
  "fixes": [{ "errorSignature": "...", "description": "..." }],
  "executions": [{ "tool": "...", "success": true }]
}
```

Stored at: `%APPDATA%/arduino-ide-cursor/memory.json`

### 6. API Key Manager (`ai/config/apiKeyManager.js`)

Secure API key storage using `electron-store`:
- Encrypted storage
- Per-provider keys
- Format validation

## Data Flow

### Compile Flow
```
User clicks "Verify"
      ↓
renderer.js: compileSketch()
      ↓
IPC: 'arduino:compile'
      ↓
main.js → arduinoService.compile()
      ↓
arduino-cli compile --fqbn xxx
      ↓
Result → renderer
      ↓
Display in console/problems
```

### AI Query Flow
```
User sends message
      ↓
renderer.js: sendAIMessage()
      ↓
IPC: 'ai:process-query'
      ↓
agent.js → Provider (OpenAI/Gemini/Claude)
      ↓
LLM returns tool calls
      ↓
toolExecutor.execute() → arduinoService/serialMonitor
      ↓
Results → LLM → Final response
      ↓
Display in AI panel
```

## IPC Channels

### Arduino
- `arduino:compile` - Compile sketch
- `arduino:upload` - Upload to board
- `arduino:list-boards` - Get boards
- `arduino:list-ports` - Get ports
- `arduino:check-cli` - Check CLI status

### Serial
- `serial:connect` - Open port
- `serial:disconnect` - Close port
- `serial:send` - Send data
- `serial:list-ports` - List ports
- `serial:data` (event) - Incoming data

### AI
- `ai:set-provider` - Configure AI
- `ai:process-query` - Send query
- `ai:analyze-error` - Analyze error
- `api-keys:set/get/has` - Key management

## UI Components

### Sidebar
- File selection
- Board dropdown (populated from CLI)
- Port dropdown (auto-detected)
- Verify/Upload buttons
- Serial controls

### Code Editor
- CodeMirror with C/C++ syntax
- Dark theme (Dracula)
- Line numbers
- Bracket matching

### Output Panel
- **Console**: Build output, logs
- **Serial Monitor**: Real-time data
- **Problems**: Errors with suggestions

### AI Panel
- Provider selector
- Chat interface
- Tool execution feedback

## Configuration

### package.json Dependencies
```json
{
  "electron": "^27.0.0",
  "serialport": "^12.0.0",
  "openai": "^4.20.0",
  "@anthropic-ai/sdk": "^0.20.0",
  "@google/generative-ai": "^0.2.1",
  "electron-store": "^8.1.0"
}
```

### Build Configuration
```json
{
  "build": {
    "appId": "com.arduinoidecursor.app",
    "productName": "Arduino IDE Cursor",
    "win": { "target": "nsis" }
  }
}
```

## Error Handling

1. **FQBN Validation**: Ensures format `vendor:arch:board`
2. **Port Detection**: Falls back to empty list
3. **Board List**: Provides defaults if CLI fails
4. **AI Errors**: Graceful fallback messages
5. **Memory Errors**: Operations continue without persistence

## Security

- Context isolation enabled
- No direct Node.js in renderer
- Preload bridge for IPC
- Encrypted API key storage
- No shell injection (validated inputs)

## Getting Started

1. Install Arduino CLI
2. `npm install`
3. `npm start`
4. Select board and port
5. Open sketch
6. Verify/Upload
7. Use AI for help

## Future Improvements

- [ ] Multiple file support
- [ ] Library manager
- [ ] Board manager
- [ ] Git integration
- [ ] Sketch templates
- [ ] Auto-complete for Arduino
- [ ] Live error detection

