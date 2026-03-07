# AI Service Overview

This folder contains the main-process AI subsystem used by Impulse IDE.

## Components

- `agent.js` - orchestrates provider calls, tool-use loops, mode behavior, and conversation history
- `providers/` - model provider adapters (OpenAI, Gemini, Claude) implementing a shared base interface
- `tools/toolSchema.js` - canonical tool definitions and JSON schemas
- `tools/toolExecutor.js` - validated tool dispatch and result normalization
- `memory/simpleMemory.js` - lightweight JSON persistence for errors/fixes/execution outcomes
- `config/apiKeyManager.js` - provider key configuration and secure local handling
- `prompts/systemPrompt.js` - mode-specific system prompts

## Data Flow

1. Renderer requests AI action through IPC.
2. `agent.js` selects mode and model provider.
3. Provider generates either direct output or tool calls.
4. `toolExecutor.js` validates and executes each tool call.
5. Results are optionally recorded in `memory/simpleMemory.js`.
6. Agent returns final response payload to renderer.

## Modes

- `agent` - full tool-enabled agentic behavior
- `ask` - direct response mode without tool execution
- `debug` - debugging-focused behavior and tool set

## Notes

- All privileged operations stay in the Electron main process.
- Keep schemas and executor behavior aligned when introducing tools.
- Prefer extending existing tool contracts over creating ad-hoc IPC patterns.
