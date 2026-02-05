# AI Agent Architecture Documentation

## Executive Summary

The AI Agent layer has been successfully integrated into the Arduino IDE Cursor application. This document outlines the complete architecture, implementation details, and usage patterns.

## Architecture Overview

The AI Agent follows a **provider-agnostic, tool-based architecture** that:

1. **Separates concerns**: Agent → Provider → Tool Executor → Services
2. **Enables multi-model support**: OpenAI, Gemini, Claude
3. **Learns from experience**: SQLite-based persistent memory
4. **Uses structured tools**: JSON schema-based tool definitions
5. **Secures credentials**: Encrypted API key storage

## Component Hierarchy

```
AIAgent (agent.js)
├── Provider Layer (providers/)
│   ├── BaseProvider (interface)
│   ├── OpenAIProvider
│   ├── GeminiProvider
│   └── ClaudeProvider
├── Tool System (tools/)
│   ├── Tool Schema (definitions)
│   └── Tool Executor (execution)
├── Memory System (memory/)
│   └── AIMemory (SQLite database)
└── Configuration (config/)
    └── APIKeyManager (secure storage)
```

## Key Features Implemented

### ✅ Multi-Model Support
- **OpenAI**: GPT-4, GPT-3.5, GPT-4o models
- **Google Gemini**: Gemini Pro, Gemini 1.5 Pro/Flash
- **Anthropic Claude**: Claude 3.5 Sonnet, Opus, Haiku
- **Runtime switching**: Change providers without restart
- **Model selection**: Choose specific models per provider

### ✅ Structured Tool System
- **12 tools defined**: Compile, upload, serial, analysis operations
- **JSON Schema validation**: Type-safe parameter validation
- **Error handling**: Graceful failures with detailed errors
- **Execution tracking**: All tool calls logged to memory

### ✅ Persistent Learning
- **SQLite database**: Local storage for all learning data
- **Error signatures**: Hash-based error pattern matching
- **Fix tracking**: Success rates, application counts
- **Board patterns**: Learn common board configurations
- **Serial patterns**: Recognize serial output signatures

### ✅ Secure API Key Management
- **Encrypted storage**: Using electron-store with encryption
- **Provider isolation**: Keys stored per provider
- **Validation**: Format validation before storage
- **Secure retrieval**: Keys never exposed to renderer

## Tool Definitions

### Arduino Operations
1. **compile_sketch** - Compile Arduino sketch
2. **upload_sketch** - Upload to board
3. **list_boards** - List available boards
4. **list_ports** - List serial ports

### Serial Monitor
5. **connect_serial** - Connect to serial port
6. **disconnect_serial** - Disconnect
7. **send_serial** - Send data
8. **read_serial** - Read recent output
9. **auto_detect_baud** - Auto-detect baud rate

### Analysis
10. **analyze_error** - Analyze error with AI
11. **search_memory** - Search error memory
12. **record_fix** - Record successful fix

## Database Schema

### error_signatures
- Stores normalized error patterns
- Tracks occurrence counts
- Links to fixes

### fixes
- Stores fix descriptions and code
- Tracks success rates
- Records application context

### execution_outcomes
- Logs all tool executions
- Tracks success/failure rates
- Records execution times

### error_fix_associations
- Links errors to fixes
- Tracks success/failure counts
- Enables recommendation scoring

## Integration Points

### Main Process (`src/main/main.js`)
- Initializes AI Agent with services
- Provides IPC handlers for UI
- Manages provider lifecycle

### IPC Handlers
- `ai:set-provider` - Set active provider
- `ai:process-query` - Process user query
- `ai:analyze-error` - Analyze error
- `ai:analyze-serial` - Analyze serial output
- `api-keys:*` - Manage API keys

### Preload Bridge (`src/main/preload.js`)
- Exposes AI methods to renderer
- Maintains security boundaries
- Provides type-safe interfaces

## Memory-First Strategy

The agent implements a **memory-first** approach:

1. **Before LLM query**: Search memory for similar errors
2. **Exact match**: Return immediately (no API call)
3. **Similar matches**: Include in LLM context
4. **After success**: Record to memory

**Benefits:**
- Reduced API costs
- Faster responses
- Improved accuracy over time
- Offline capability for known errors

## Provider Implementation Details

### OpenAI
- Uses `openai` SDK v4
- Supports function calling
- Models: gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo

### Gemini
- Uses `@google/generative-ai` SDK
- Supports function calling
- Models: gemini-pro, gemini-1.5-pro, gemini-1.5-flash

### Claude
- Uses `@anthropic-ai/sdk`
- Supports tool use
- Models: claude-3-5-sonnet, claude-3-opus, claude-3-haiku

## Security Considerations

1. **API Keys**: Encrypted with machine-specific key
2. **IPC Security**: Context isolation enabled
3. **No Direct Execution**: All actions through Tool Executor
4. **Input Validation**: All tool calls validated
5. **Error Sanitization**: Errors don't expose sensitive data

## Usage Patterns

### Basic Query
```javascript
const result = await aiAgent.processQuery(
  'Help me compile my Arduino sketch'
);
// Agent will use tools to compile, report results
```

### Error Analysis
```javascript
const analysis = await aiAgent.analyzeError(
  'undefined reference to setup()',
  { sketchPath: '/path/to/sketch.ino' }
);
// Checks memory first, then queries LLM if needed
```

### Serial Analysis
```javascript
const analysis = await aiAgent.analyzeSerialOutput(
  serialOutputString,
  50 // lines to analyze
);
// Analyzes patterns, suggests actions
```

## Testing Checklist

- [x] Provider initialization
- [x] Tool schema validation
- [x] Tool execution routing
- [x] Memory storage and retrieval
- [x] API key management
- [x] Error analysis flow
- [x] Serial monitoring integration
- [x] IPC communication
- [x] Provider switching

## Next Steps

1. **UI Integration**: Add AI chat interface to renderer
2. **Model Selector**: UI for provider/model selection
3. **API Key UI**: Secure key input forms
4. **Memory Viewer**: UI to browse learned patterns
5. **Analytics**: Display memory statistics

## Dependencies Added

```json
{
  "better-sqlite3": "^9.2.2",
  "openai": "^4.20.0",
  "@anthropic-ai/sdk": "^0.20.0",
  "@google/generative-ai": "^0.2.1",
  "electron-store": "^8.1.0"
}
```

## File Structure

```
src/main/services/ai/
├── agent.js                    # Main agent orchestrator
├── providers/
│   ├── baseProvider.js        # Abstract provider interface
│   ├── openaiProvider.js      # OpenAI implementation
│   ├── geminiProvider.js      # Gemini implementation
│   └── claudeProvider.js      # Claude implementation
├── tools/
│   ├── toolSchema.js          # Tool definitions
│   └── toolExecutor.js        # Tool execution engine
├── memory/
│   └── aiMemory.js            # SQLite memory system
├── prompts/
│   └── systemPrompt.js        # System prompts
└── config/
    └── apiKeyManager.js       # Secure key storage
```

## Conclusion

The AI Agent layer is **fully functional** and ready for UI integration. All core requirements have been met:

✅ Multi-model support (OpenAI, Gemini, Claude)  
✅ Structured tool system  
✅ Persistent learning database  
✅ Secure API key management  
✅ Provider-agnostic architecture  
✅ Memory-first error resolution  
✅ Integration with existing services  

The system is ready for UI development and user testing.

