/**
 * Tool Schema Definitions
 * Structured tool instructions that the AI Agent can output
 */

const TOOL_SCHEMA = {
  // Arduino Operations
  COMPILE_SKETCH: {
    name: 'compile_sketch',
    description: 'Compile an Arduino sketch using Arduino CLI. If sketchPath or boardFQBN are omitted, uses the currently open sketch and selected board from the IDE.',
    parameters: {
      type: 'object',
      properties: {
        sketchPath: {
          type: 'string',
          description: 'Full path to the .ino sketch file. Optional: uses currently open sketch if omitted.'
        },
        boardFQBN: {
          type: 'string',
          description: 'Fully Qualified Board Name (e.g., arduino:avr:uno). Optional: uses selected board if omitted.'
        }
      },
      required: []
    }
  },

  UPLOAD_SKETCH: {
    name: 'upload_sketch',
    description: 'Upload compiled code to an Arduino board. If sketchPath, boardFQBN, or port are omitted, uses the currently open sketch, selected board, and selected port from the IDE.',
    parameters: {
      type: 'object',
      properties: {
        sketchPath: {
          type: 'string',
          description: 'Full path to the .ino sketch file. Optional: uses currently open sketch if omitted.'
        },
        boardFQBN: {
          type: 'string',
          description: 'Fully Qualified Board Name. Optional: uses selected board if omitted.'
        },
        port: {
          type: 'string',
          description: 'Serial port (e.g., COM3, /dev/ttyUSB0). Optional: uses selected port if omitted.'
        }
      },
      required: []
    }
  },

  LIST_BOARDS: {
    name: 'list_boards',
    description: 'List all available Arduino boards',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  LIST_PORTS: {
    name: 'list_ports',
    description: 'List all available serial ports',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  // Serial Monitor Operations
  CONNECT_SERIAL: {
    name: 'connect_serial',
    description: 'Connect to a serial port for monitoring',
    parameters: {
      type: 'object',
      properties: {
        port: {
          type: 'string',
          description: 'Serial port path'
        },
        baudRate: {
          type: 'number',
          description: 'Baud rate (common: 9600, 115200)',
          default: 115200
        }
      },
      required: ['port']
    }
  },

  DISCONNECT_SERIAL: {
    name: 'disconnect_serial',
    description: 'Disconnect from serial port',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  SEND_SERIAL: {
    name: 'send_serial',
    description: 'Send data to the connected serial port',
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'Data to send'
        }
      },
      required: ['data']
    }
  },

  READ_SERIAL: {
    name: 'read_serial',
    description: 'Read recent serial monitor output',
    parameters: {
      type: 'object',
      properties: {
        lines: {
          type: 'number',
          description: 'Number of recent lines to read',
          default: 50
        }
      }
    }
  },

  WEB_SEARCH: {
    name: 'web_search',
    description: 'Search the web for niche board/sensor/IC info NOT in the knowledge base. Use for obscure parts, cheap clones, unfamiliar chips, quirky pinouts, library bugs. Results are re-ranked so datasheets and vetted sources (Adafruit, SparkFun, Arduino forum, chip vendors) surface first. Returns { answer, results:[{title,url,snippet,source}] }. Cite the URL you used in your reply.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query. Be specific — include the part number, board name, or exact behaviour.' },
        limit: { type: 'number', description: 'Max results, 1..10 (default 5)' }
      },
      required: ['query']
    }
  },

  FETCH_URL: {
    name: 'fetch_url',
    description: 'Fetch a webpage as readable text. Use after web_search to read a promising result. Returns { title, text, truncated }. Content is capped at 20k chars.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full http(s) URL' }
      },
      required: ['url']
    }
  },

  VERIFY_SERIAL: {
    name: 'verify_serial',
    description: 'Wait for expected output on the serial port to prove the sketch actually works on hardware. Use after upload_sketch to close the loop: pick a short, distinctive substring you know will appear (e.g. "Sensor OK", "Ready", or a value pattern). Returns { passed, matchedLine, elapsedMs, sampledLines } within timeoutMs.',
    parameters: {
      type: 'object',
      properties: {
        expected: { type: 'string', description: 'Substring or regex to match on any serial line' },
        timeoutMs: { type: 'number', description: 'How long to wait, 500..30000 (default 8000)' },
        isRegex: { type: 'boolean', description: 'Treat expected as a regex (default false)' }
      },
      required: ['expected']
    }
  },

  AUTO_DETECT_BAUD: {
    name: 'auto_detect_baud',
    description: 'Automatically detect the correct baud rate for a serial port',
    parameters: {
      type: 'object',
      properties: {
        port: {
          type: 'string',
          description: 'Serial port path'
        }
      },
      required: ['port']
    }
  },

  // Baud Rate Operations
  GET_BAUD_RATE: {
    name: 'get_baud_rate',
    description: 'Get the current baud rate setting for serial communication',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  SET_BAUD_RATE: {
    name: 'set_baud_rate',
    description: 'Set the baud rate for serial communication. Common rates: 300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000',
    parameters: {
      type: 'object',
      properties: {
        baudRate: {
          type: 'number',
          description: 'The baud rate to set (e.g., 9600, 115200)'
        }
      },
      required: ['baudRate']
    }
  },

  GET_AVAILABLE_BAUD_RATES: {
    name: 'get_available_baud_rates',
    description: 'Get list of all available baud rate options',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  // Code Editor Operations
  GET_EDITOR_CODE: {
    name: 'get_editor_code',
    description: 'Get the current code content from the editor. If the result is empty or whitespace-only, the user has no code yet—use set_editor_code to write code when they ask for it.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  SET_EDITOR_CODE: {
    name: 'set_editor_code',
    description: 'Replace the entire code content in the editor. Use when the editor is empty and the user asks for code, or after confirming replacement of existing code.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The new code to set in the editor'
        }
      },
      required: ['code']
    }
  },

  EDIT_CODE: {
    name: 'edit_code',
    description: 'Edit specific lines or sections of code in the editor. Can insert, replace, or delete code.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Operation type: "replace", "insert", or "delete"',
          enum: ['replace', 'insert', 'delete']
        },
        startLine: {
          type: 'number',
          description: 'Starting line number (1-indexed)'
        },
        endLine: {
          type: 'number',
          description: 'Ending line number (1-indexed, inclusive). For insert, this is ignored.'
        },
        newCode: {
          type: 'string',
          description: 'New code to insert or replace with. Not needed for delete.'
        }
      },
      required: ['operation', 'startLine']
    }
  },

  SEARCH_CODE: {
    name: 'search_code',
    description: 'Search for text or patterns in the current editor code',
    parameters: {
      type: 'object',
      properties: {
        searchText: {
          type: 'string',
          description: 'Text or regex pattern to search for'
        },
        isRegex: {
          type: 'boolean',
          description: 'Whether to treat searchText as a regex pattern',
          default: false
        }
      },
      required: ['searchText']
    }
  },

  REPLACE_IN_CODE: {
    name: 'replace_in_code',
    description: 'Find and replace text in the editor code',
    parameters: {
      type: 'object',
      properties: {
        searchText: {
          type: 'string',
          description: 'Text to find'
        },
        replaceText: {
          type: 'string',
          description: 'Text to replace with'
        },
        replaceAll: {
          type: 'boolean',
          description: 'Replace all occurrences or just the first',
          default: false
        }
      },
      required: ['searchText', 'replaceText']
    }
  },

  GET_CURRENT_SKETCH_PATH: {
    name: 'get_current_sketch_path',
    description: 'Get the file path of the currently open sketch',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  SAVE_SKETCH: {
    name: 'save_sketch',
    description: 'Save the current editor content to the sketch file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Optional file path. If not provided, saves to current sketch path.'
        }
      }
    }
  },

  // Analysis Operations
  ANALYZE_ERROR: {
    name: 'analyze_error',
    description: 'Analyze an error message and suggest fixes',
    parameters: {
      type: 'object',
      properties: {
        errorMessage: {
          type: 'string',
          description: 'The error message to analyze'
        },
        context: {
          type: 'object',
          description: 'Additional context (sketch path, board type, etc.)'
        }
      },
      required: ['errorMessage']
    }
  },

  SEARCH_MEMORY: {
    name: 'search_memory',
    description: 'Search the error memory database for similar past errors',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Error message or pattern to search for'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10
        }
      },
      required: ['query']
    }
  },

  RECORD_FIX: {
    name: 'record_fix',
    description: 'Record a successful fix to the memory database',
    parameters: {
      type: 'object',
      properties: {
        errorSignature: {
          type: 'string',
          description: 'Signature/pattern of the error'
        },
        fix: {
          type: 'string',
          description: 'The fix that resolved the error'
        },
        context: {
          type: 'object',
          description: 'Additional context (board, sketch, etc.)'
        }
      },
      required: ['errorSignature', 'fix']
    }
  },

  // ---- Workspace / filesystem (whole project) ----
  READ_FILE: {
    name: 'read_file',
    description: 'Read any text file in the open project by workspace-relative path (e.g. "src/main.ino"). Use this to inspect files other than the one on screen before editing.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Workspace-relative file path' } },
      required: ['path']
    }
  },
  WRITE_FILE: {
    name: 'write_file',
    description: 'Create or overwrite a file in the project with the given content. Prefer editing the active editor via edit_code for the open sketch; use write_file for OTHER files. Always read_file first if unsure of current contents.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Workspace-relative file path' },
        content: { type: 'string', description: 'Full new file content' }
      },
      required: ['path', 'content']
    }
  },
  CREATE_FILE: {
    name: 'create_file',
    description: 'Create a NEW file. Fails if the file already exists (use write_file to overwrite).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Workspace-relative file path' },
        content: { type: 'string', description: 'Initial file content' }
      },
      required: ['path']
    }
  },
  LIST_DIRECTORY: {
    name: 'list_directory',
    description: 'List files and subfolders of a directory in the project (default: project root).',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Workspace-relative directory path. Omit for root.' } },
      required: []
    }
  },
  GET_PROJECT_TREE: {
    name: 'get_project_tree',
    description: 'Get a compact tree of the whole project structure. Use once at the start to orient yourself.',
    parameters: {
      type: 'object',
      properties: { maxDepth: { type: 'number', description: 'Max depth (default 3)' } },
      required: []
    }
  },
  SEARCH_FILES: {
    name: 'search_files',
    description: 'Search the text of all project files for a string or regex. Returns matching file paths, line numbers, and the matched line.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text or regex to find' },
        isRegex: { type: 'boolean', description: 'Treat query as regex (default false)' }
      },
      required: ['query']
    }
  },

  // Get Current State
  GET_CURRENT_STATE: {
    name: 'get_current_state',
    description: 'Get the current application state including selected board, port, baud rate, serial connection status, and open sketch path',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  // Playground — hardware task instructions
  UPDATE_PLAYGROUND: {
    name: 'update_playground',
    description: 'Display hardware instructions in the Playground tab. Use this to tell the user what physical steps to perform: wiring, component placement, connections, circuit setup, breadboard layout, pin mapping, etc. Content is shown as text in the Playground panel at the bottom of the IDE.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The hardware instructions or task description to display. Can include wiring steps, pin connections, component lists, or any physical setup instructions.'
        },
        append: {
          type: 'boolean',
          description: 'If true (default), appends to existing playground content. If false, replaces all existing content.'
        }
      },
      required: ['content']
    }
  },

  // Library management — Arduino library dependencies via arduino-cli
  SEARCH_LIBRARIES: {
    name: 'search_libraries',
    description: 'Search the Arduino library index for installable libraries by name or keyword (e.g. "DHT sensor", "ArduinoJson", "Adafruit NeoPixel"). Returns matching libraries with their exact name, author, latest version, and a one-line description. Use this to find the correct library NAME before install_library when the user names a library loosely or you need a dependency for an #include.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Library name or keyword to search for' }
      },
      required: ['query']
    }
  },
  INSTALL_LIBRARY: {
    name: 'install_library',
    description: 'Install an Arduino library so its headers become available to #include and compile. Use the exact library name from search_libraries (e.g. "ArduinoJson"). Optionally pin a version like "ArduinoJson@6.21.3"; omit the version for the latest. Call this when a sketch needs a library that is not installed (a compile error like "No such file: <X.h>" usually means the library for X must be installed).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact library name, optionally "Name@version"' }
      },
      required: ['name']
    }
  },
  LIST_LIBRARIES: {
    name: 'list_libraries',
    description: 'List the Arduino libraries currently installed, with their versions. Use this to check whether a dependency is already present before installing it, or to report what is available.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  UNINSTALL_LIBRARY: {
    name: 'uninstall_library',
    description: 'Remove an installed Arduino library by its exact name. Use only when the user asks to remove a library or to resolve a version conflict.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact installed library name' }
      },
      required: ['name']
    }
  },

  // Board core management — the platform packages that make a board compilable
  SEARCH_BOARD_CORES: {
    name: 'search_board_cores',
    description: 'Search the Boards Manager for installable board cores (platform packages) by keyword (e.g. "esp32", "rp2040", "samd", "avr"). Returns core IDs like "esp32:esp32" or "arduino:avr" to use with install_board_core. A core is what makes a family of boards compilable — you need the right core installed before you can compile for that board.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword to search cores for (e.g. "esp32")' }
      },
      required: ['query']
    }
  },
  INSTALL_BOARD_CORE: {
    name: 'install_board_core',
    description: 'Install a board core (platform) so its boards can be compiled and uploaded. Use the exact core ID from search_board_cores (e.g. "esp32:esp32", "arduino:avr", "rp2040:rp2040"). A compile/upload error like "platform ... not installed" or an unknown FQBN means the core must be installed first. Cores are large downloads and can take a minute.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Exact core ID, e.g. "esp32:esp32"' }
      },
      required: ['id']
    }
  },
  LIST_BOARD_CORES: {
    name: 'list_board_cores',
    description: 'List the board cores currently installed, with their versions. Use to check whether the core for a target board is already present before installing it.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
};

const DEBUG_TOOL_NAMES = ['analyze_error', 'search_memory', 'record_fix'];

/**
 * Get all available tools as an array
 */
function getAllTools() {
  return Object.values(TOOL_SCHEMA);
}

/**
 * Get tools for debug mode (analysis and memory only)
 */
function getDebugTools() {
  return Object.values(TOOL_SCHEMA).filter(t => DEBUG_TOOL_NAMES.includes(t.name));
}

/**
 * Get tool by name
 */
function getTool(name) {
  return Object.values(TOOL_SCHEMA).find(tool => tool.name === name);
}

/**
 * Validate tool call structure
 */
function validateToolCall(toolCall) {
  if (!toolCall.name) {
    return { valid: false, error: 'Tool name is required' };
  }

  const tool = getTool(toolCall.name);
  if (!tool) {
    return { valid: false, error: `Unknown tool: ${toolCall.name}` };
  }

  // Validate required parameters
  if (tool.parameters.required) {
    for (const param of tool.parameters.required) {
      if (!(param in toolCall.arguments)) {
        return { valid: false, error: `Missing required parameter: ${param}` };
      }
    }
  }

  return { valid: true };
}

module.exports = {
  TOOL_SCHEMA,
  getAllTools,
  getDebugTools,
  getTool,
  validateToolCall
};
