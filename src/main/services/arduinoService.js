const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs').promises;

/**
 * Arduino CLI Service
 * Handles all Arduino CLI operations: compile, upload, board/port listing
 * 
 * Architecture Components:
 * 1️⃣ Command Builder - constructs CLI commands with correct flags
 * 2️⃣ Process Runner - executes commands, captures stdout/stderr
 * 3️⃣ Output Parser - interprets results, detects success/failure
 */
class ArduinoService {
  constructor() {
    this.cliPath = 'arduino-cli';
    this.coreIndexed = false;
    // Increase buffer for large outputs (50MB for board lists)
    this.maxBuffer = 50 * 1024 * 1024; // 50MB buffer
  }

  // ==================== 2️⃣ Process Runner ====================
  
  async runCommand(command, options = {}) {
    const execOptions = {
      maxBuffer: this.maxBuffer,
      ...options
    };
    
    try {
      const { stdout, stderr } = await execAsync(command, execOptions);
      return { success: true, stdout, stderr };
    } catch (error) {
      return { 
        success: false, 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message,
        code: error.code
      };
    }
  }

  async checkCLI() {
    try {
      const result = await this.runCommand(`${this.cliPath} version`);
      return result.success && result.stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  async ensureCoreIndexed() {
    if (this.coreIndexed) return;
    
    try {
      await this.runCommand(`${this.cliPath} core update-index`);
      this.coreIndexed = true;
    } catch (error) {
      console.warn('Failed to update core index:', error.message);
    }
  }

  // ==================== 1️⃣ Command Builder ====================

  buildCompileCommand(sketchPath, boardFQBN, options = {}) {
    const args = [
      'compile',
      '--fqbn', boardFQBN,
      '--verbose'
    ];
    
    if (options.outputDir) {
      args.push('--output-dir', options.outputDir);
    }
    
    args.push(sketchPath);
    
    return `${this.cliPath} ${args.join(' ')}`;
  }

  buildUploadCommand(sketchPath, boardFQBN, port, options = {}) {
    const args = [
      'upload',
      '--fqbn', boardFQBN,
      '--port', port,
      '--verbose'
    ];
    
    args.push(sketchPath);
    
    return `${this.cliPath} ${args.join(' ')}`;
  }

  // ==================== 3️⃣ Output Parser ====================

  /**
   * Parse compile output to extract useful information
   */
  parseCompileOutput(stdout, stderr) {
    const combined = stdout + '\n' + stderr;
    const lines = combined.split('\n');
    
    const result = {
      success: false,
      programSize: null,
      maxSize: null,
      usagePercent: null,
      warnings: [],
      errors: [],
      message: ''
    };
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Parse success - "Sketch uses X bytes"
      const sizeMatch = line.match(/Sketch uses (\d+) bytes \((\d+)%\) of program storage space/);
      if (sizeMatch) {
        result.success = true;
        result.programSize = parseInt(sizeMatch[1]);
        result.usagePercent = parseInt(sizeMatch[2]);
      }
      
      // Parse max size
      const maxMatch = line.match(/Maximum is (\d+) bytes/);
      if (maxMatch) {
        result.maxSize = parseInt(maxMatch[1]);
      }
      
      // Collect errors
      if (lowerLine.includes('error:') || 
          lowerLine.includes('was not declared') ||
          lowerLine.includes('undefined reference')) {
        result.errors.push(line.trim());
      }
      
      // Collect warnings
      if (lowerLine.includes('warning:') && !lowerLine.includes('error:')) {
        result.warnings.push(line.trim());
      }
    }
    
    // Generate summary message
    if (result.success) {
      result.message = `Compilation successful. Uses ${result.programSize} bytes (${result.usagePercent}%)`;
    } else if (result.errors.length > 0) {
      result.message = result.errors[0];
    } else {
      result.message = 'Compilation failed';
    }
    
    return result;
  }

  /**
   * Parse upload output - improved detection for multiple board types
   */
  parseUploadOutput(stdout, stderr) {
    const combined = stdout + '\n' + stderr;
    const lines = combined.split('\n');
    
    const result = {
      success: false,
      progress: 0,
      errors: [],
      warnings: [],
      message: ''
    };
    
    // Success indicators for various board types
    const successPatterns = [
      /100%/,                                          // General progress completion
      /avrdude.*done/i,                                // AVR boards (Uno, Nano, Mega)
      /avrdude.*verified/i,                            // AVR verification
      /avrdude.*flash verified/i,                      // AVR flash verified
      /writing.*done/i,                                // Generic writing done
      /hard resetting via rts pin/i,                   // ESP32/ESP8266 reset after upload
      /leaving.*hard reset/i,                          // ESP32 variant
      /hash of data verified/i,                        // ESP32 hash verification
      /compressed \d+ bytes to \d+/i,                  // ESP32 compression success
      /wrote \d+ bytes/i,                              // Generic write success
      /flash written and target reset/i,              // STM32 boards
      /upload.*complete/i,                             // Generic upload complete
      /successfully/i,                                 // Generic success
      /programming.*ok/i,                              // Some programmers
    ];
    
    // Error patterns - more specific to avoid false positives
    const errorPatterns = [
      { pattern: /error:/i, type: 'error' },
      { pattern: /fatal error/i, type: 'error' },
      { pattern: /upload failed/i, type: 'error' },
      { pattern: /timeout/i, type: 'error' },
      { pattern: /permission denied/i, type: 'error' },
      { pattern: /access denied/i, type: 'error' },
      { pattern: /port.*not found/i, type: 'error' },
      { pattern: /no such file or directory/i, type: 'error' },
      { pattern: /device not found/i, type: 'error' },
      { pattern: /programmer.*not responding/i, type: 'error' },
      { pattern: /sync error/i, type: 'error' },
      { pattern: /stk500.*not in sync/i, type: 'error' },
      { pattern: /espcomm_upload_mem failed/i, type: 'error' },
      { pattern: /a]fatal error occurred/i, type: 'error' },
      { pattern: /serial port.*busy/i, type: 'error' },
    ];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Check for success indicators
      for (const pattern of successPatterns) {
        if (pattern.test(line)) {
          result.success = true;
          result.progress = 100;
          break;
        }
      }
      
      // Parse progress percentage
      const progressMatch = line.match(/(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1]);
        result.progress = Math.max(result.progress, progress);
        if (progress >= 100) {
          result.success = true;
        }
      }
      
      // Check for errors (but not false positives like "error correction")
      for (const { pattern, type } of errorPatterns) {
        if (pattern.test(line)) {
          // Exclude false positives
          if (!lowerLine.includes('error correction') && 
              !lowerLine.includes('no error')) {
            result.errors.push(line.trim());
          }
        }
      }
      
      // Collect warnings
      if (lowerLine.includes('warning:') && !lowerLine.includes('error:')) {
        result.warnings.push(line.trim());
      }
    }
    
    // If we found errors but also success indicators, check if it's a fatal error
    if (result.errors.length > 0) {
      const hasFatalError = result.errors.some(e => 
        /fatal|failed|cannot|unable/i.test(e)
      );
      if (hasFatalError) {
        result.success = false;
      }
    }
    
    // Generate message
    if (result.success) {
      result.message = 'Upload complete';
    } else if (result.errors.length > 0) {
      // Get the most relevant error message
      const relevantError = result.errors.find(e => 
        /error:|failed|timeout|denied|not found/i.test(e)
      ) || result.errors[0];
      result.message = relevantError;
    } else {
      result.message = 'Upload status unknown - check output for details';
    }
    
    return result;
  }

  // ==================== Board/Port Management ====================

  /**
   * List all installed boards using JSON output
   * Uses spawn for large outputs to avoid buffer overflow
   */
  async listBoards() {
    await this.ensureCoreIndexed();
    
    try {
      // Use spawn for large outputs to handle buffer issues
      const boards = await this.listBoardsWithSpawn();
      
      if (boards.length === 0) {
        return this.getCommonBoards();
      }
      
      // Limit to first 150 boards to prevent UI slowdown
      const limitedBoards = boards.slice(0, 150);
      
      // Add common boards at the top if they exist
      const commonFQBNs = [
        'arduino:avr:uno',
        'arduino:avr:nano',
        'arduino:avr:nano:cpu=atmega328old',
        'arduino:avr:mega',
        'arduino:avr:leonardo',
        'esp32:esp32:esp32',
        'esp32:esp32:esp32s3',
        'esp8266:esp8266:nodemcuv2',
        'esp8266:esp8266:generic'
      ];
      
      const sortedBoards = [];
      
      // Add common boards first
      for (const fqbn of commonFQBNs) {
        const found = limitedBoards.find(b => b.fqbn === fqbn);
        if (found && !sortedBoards.some(b => b.fqbn === found.fqbn)) {
          sortedBoards.push(found);
        }
      }
      
      // Add remaining boards
      for (const board of limitedBoards) {
        if (!sortedBoards.some(b => b.fqbn === board.fqbn)) {
          sortedBoards.push(board);
        }
      }
      
      return sortedBoards;
    } catch (error) {
      console.error('Failed to list boards:', error.message);
      return this.getCommonBoards();
    }
  }

  /**
   * List boards using spawn to handle large outputs
   */
  async listBoardsWithSpawn() {
    return new Promise((resolve, reject) => {
      const args = ['board', 'listall', '--format', 'json'];
      const boardProcess = spawn(this.cliPath, args);
      
      let stdout = '';
      let stderr = '';
      
      boardProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      boardProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      boardProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Board list error:', stderr);
          resolve([]); // Return empty array, will fall back to common boards
          return;
        }
        
        try {
          const data = JSON.parse(stdout);
          const boards = [];
          
          // Handle different JSON structures from different CLI versions
          const boardList = data.boards || data;
          
          if (Array.isArray(boardList)) {
            for (const board of boardList) {
              if (board.fqbn && board.name) {
                boards.push({
                  name: board.name,
                  fqbn: board.fqbn
                });
              }
            }
          }
          
          resolve(boards);
        } catch (parseError) {
          console.error('Failed to parse board list:', parseError.message);
          resolve([]);
        }
      });
      
      boardProcess.on('error', (error) => {
        console.error('Failed to spawn board list process:', error.message);
        resolve([]);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        boardProcess.kill();
        resolve([]);
      }, 30000);
    });
  }

  getCommonBoards() {
    return [
      { name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
      { name: 'Arduino Nano', fqbn: 'arduino:avr:nano' },
      { name: 'Arduino Nano (Old Bootloader)', fqbn: 'arduino:avr:nano:cpu=atmega328old' },
      { name: 'Arduino Mega 2560', fqbn: 'arduino:avr:mega' },
      { name: 'Arduino Leonardo', fqbn: 'arduino:avr:leonardo' },
      { name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
      { name: 'ESP8266 NodeMCU', fqbn: 'esp8266:esp8266:nodemcuv2' },
      { name: 'ESP8266 Generic', fqbn: 'esp8266:esp8266:generic' }
    ];
  }

  /**
   * List connected boards/ports using JSON output
   */
  async listPorts() {
    try {
      const result = await this.runCommand(`${this.cliPath} board list --format json`);
      
      if (!result.success) {
        throw new Error(result.stderr);
      }
      
      const data = JSON.parse(result.stdout);
      const ports = [];
      
      // Handle different JSON structures
      const portList = data.detected_ports || data.ports || data;
      
      if (Array.isArray(portList)) {
        for (const item of portList) {
          const port = item.port || item;
          if (port && port.address) {
            const boardName = item.matching_boards && item.matching_boards[0] 
              ? item.matching_boards[0].name 
              : (port.protocol_label || 'Unknown');
            
            ports.push({
              port: port.address,
              protocol: port.protocol || 'serial',
              board: boardName
            });
          }
        }
      }
      
      return ports;
    } catch (error) {
      console.error('Failed to list ports:', error.message);
      return [];
    }
  }

  /**
   * Validate FQBN format
   */
  validateFQBN(fqbn) {
    if (!fqbn) return false;
    // FQBN format: vendor:architecture:board[:options]
    // e.g., arduino:avr:uno or esp32:esp32:esp32
    const parts = fqbn.split(':');
    return parts.length >= 3;
  }

  // ==================== Compile/Upload Operations ====================

  /**
   * Compile an Arduino sketch
   */
  async compile(sketchPath, boardFQBN) {
    if (!sketchPath || !boardFQBN) {
      throw new Error('Sketch path and board FQBN are required');
    }

    if (!this.validateFQBN(boardFQBN)) {
      throw new Error(`Invalid FQBN format: "${boardFQBN}". Expected format: vendor:architecture:board (e.g., arduino:avr:uno)`);
    }

    // Verify sketch exists
    try {
      await fs.access(sketchPath);
    } catch (error) {
      throw new Error(`Sketch not found: ${sketchPath}`);
    }

    await this.ensureCoreIndexed();

    return new Promise((resolve, reject) => {
      const args = [
        'compile',
        '--fqbn', boardFQBN,
        '--verbose',
        sketchPath
      ];

      const compileProcess = spawn(this.cliPath, args, {
        cwd: path.dirname(sketchPath)
      });

      let stdout = '';
      let stderr = '';

      compileProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      compileProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      compileProcess.on('close', (code) => {
        // Use the output parser
        const parsed = this.parseCompileOutput(stdout, stderr);
        
        if (code === 0 || parsed.success) {
          resolve({
            success: true,
            output: stdout,
            warnings: parsed.warnings,
            programSize: parsed.programSize,
            usagePercent: parsed.usagePercent,
            message: parsed.message
          });
        } else {
          reject(new Error(parsed.message || `Compilation failed with code ${code}`));
        }
      });

      compileProcess.on('error', (error) => {
        reject(new Error(`Failed to start compilation: ${error.message}`));
      });
    });
  }

  /**
   * Upload to Arduino board
   */
  async upload(sketchPath, boardFQBN, port) {
    if (!sketchPath || !boardFQBN || !port) {
      throw new Error('Sketch path, board FQBN, and port are required');
    }

    if (!this.validateFQBN(boardFQBN)) {
      throw new Error(`Invalid FQBN format: "${boardFQBN}". Expected format: vendor:architecture:board`);
    }

    // First compile
    await this.compile(sketchPath, boardFQBN);

    return new Promise((resolve, reject) => {
      const args = [
        'upload',
        '--fqbn', boardFQBN,
        '--port', port,
        '--verbose',
        sketchPath
      ];

      const uploadProcess = spawn(this.cliPath, args, {
        cwd: path.dirname(sketchPath)
      });

      let stdout = '';
      let stderr = '';

      uploadProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      uploadProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      uploadProcess.on('close', (code) => {
        // Use the output parser
        const parsed = this.parseUploadOutput(stdout, stderr);
        
        // Success if exit code is 0 OR parser detected success
        // (some boards return non-zero but upload successfully)
        const isSuccess = code === 0 || parsed.success;
        
        // Only fail if we have explicit errors and no success indicators
        const hasCriticalErrors = parsed.errors.some(e => 
          /fatal|failed|cannot connect|access denied|permission denied/i.test(e)
        );
        
        if (isSuccess && !hasCriticalErrors) {
          resolve({
            success: true,
            output: stdout + '\n' + stderr,
            port: port,
            message: parsed.message || 'Upload complete',
            warnings: parsed.warnings
          });
        } else {
          // Provide detailed error message
          const errorMsg = parsed.errors.length > 0 
            ? parsed.errors.join('\n') 
            : (parsed.message || `Upload failed with exit code ${code}`);
          reject(new Error(errorMsg));
        }
      });

      uploadProcess.on('error', (error) => {
        reject(new Error(`Failed to start upload: ${error.message}`));
      });
    });
  }

  /**
   * Upload only (without compiling first) - useful when already compiled
   */
  async uploadOnly(sketchPath, boardFQBN, port) {
    if (!sketchPath || !boardFQBN || !port) {
      throw new Error('Sketch path, board FQBN, and port are required');
    }

    return new Promise((resolve, reject) => {
      const args = [
        'upload',
        '--fqbn', boardFQBN,
        '--port', port,
        '--verbose',
        sketchPath
      ];

      const uploadProcess = spawn(this.cliPath, args, {
        cwd: path.dirname(sketchPath)
      });

      let stdout = '';
      let stderr = '';

      uploadProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      uploadProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      uploadProcess.on('close', (code) => {
        const parsed = this.parseUploadOutput(stdout, stderr);
        const isSuccess = code === 0 || parsed.success;
        
        if (isSuccess) {
          resolve({
            success: true,
            output: stdout + '\n' + stderr,
            port: port,
            message: parsed.message || 'Upload complete'
          });
        } else {
          reject(new Error(parsed.message || `Upload failed with code ${code}`));
        }
      });

      uploadProcess.on('error', (error) => {
        reject(new Error(`Failed to start upload: ${error.message}`));
      });
    });
  }

  // ==================== Library Operations ====================

  /**
   * Update the library index (call before search for fresh results)
   */
  async libUpdateIndex() {
    const result = await this.runCommand(`${this.cliPath} lib update-index`);
    return result.success;
  }

  /**
   * Search for libraries. Returns { libraries: [{ name, author, version, sentence, paragraph, category, available_versions }] }
   */
  async libSearch(query) {
    const q = query != null ? String(query).trim() : '';
    if (!q) return { libraries: [] };
    return new Promise((resolve, reject) => {
      const args = ['lib', 'search', '--format', 'json', '--omit-releases-details', q];
      const proc = spawn(this.cliPath, args);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(stderr || 'Library search failed'));
          return;
        }
        try {
          const data = JSON.parse(stdout);
          const libs = (data.libraries || []).slice(0, 100).map(lib => ({
            name: lib.name,
            author: lib.latest?.author || '',
            version: lib.latest?.version || (lib.available_versions && lib.available_versions[0]) || '',
            sentence: lib.latest?.sentence || '',
            paragraph: lib.latest?.paragraph || '',
            category: lib.latest?.category || 'Uncategorized',
            website: lib.latest?.website || '',
            available_versions: lib.available_versions || []
          }));
          resolve({ libraries: libs });
        } catch (e) {
          reject(new Error(`Failed to parse lib search: ${e.message}`));
        }
      });
      proc.on('error', err => reject(new Error(`Failed to run: ${err.message}`)));
    });
  }

  /**
   * Install a library. libSpec = "Name" or "Name@1.0.0"
   */
  async libInstall(libSpec) {
    const spec = String(libSpec || '').trim();
    if (!spec) throw new Error('Library name is required');
    return new Promise((resolve, reject) => {
      const args = ['lib', 'install', '--format', 'json', spec];
      const proc = spawn(this.cliPath, args);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code === 0) {
          resolve({ success: true, output: stdout + stderr });
        } else {
          reject(new Error(stderr || stdout || `Install failed with code ${code}`));
        }
      });
      proc.on('error', err => reject(new Error(`Failed to run: ${err.message}`)));
    });
  }

  /**
   * List installed libraries. Returns { installed_libraries: [{ name, author, version, sentence, ... }] }
   */
  async libList() {
    const result = await this.runCommand(`${this.cliPath} lib list --format json`);
    if (!result.success) {
      throw new Error(result.stderr || 'Library list failed');
    }
    try {
      const data = JSON.parse(result.stdout);
      const libs = (data.installed_libraries || []).map(item => {
        const lib = item.library || item;
        return {
          name: lib.name,
          author: lib.author || '',
          version: lib.version || '',
          sentence: lib.sentence || '',
          paragraph: lib.paragraph || '',
          category: lib.category || 'Uncategorized',
          website: lib.website || '',
          install_dir: lib.install_dir
        };
      });
      return { installed_libraries: libs };
    } catch (e) {
      throw new Error(`Failed to parse lib list: ${e.message}`);
    }
  }

  /**
   * Uninstall a library by name
   */
  async libUninstall(libName) {
    const name = String(libName || '').trim();
    if (!name) throw new Error('Library name is required');
    const result = await this.runCommand(`${this.cliPath} lib uninstall "${name}"`);
    if (!result.success) {
      throw new Error(result.stderr || result.stdout || 'Uninstall failed');
    }
    return { success: true };
  }
}

module.exports = ArduinoService;

