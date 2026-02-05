const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * AI Memory Service
 * SQLite database for persistent learning and error pattern storage
 * Uses sql.js (pure JavaScript SQLite) for cross-platform compatibility
 */
class AIMemory {
  constructor() {
    this.dbPath = this.getDatabasePath();
    this.db = null;
    this.SQL = null;
    this.initialized = false;
  }

  getDatabasePath() {
    const appDataDir = process.env.APPDATA || 
      (process.platform === 'darwin' 
        ? path.join(process.env.HOME, 'Library/Preferences')
        : path.join(process.env.HOME, '.config'));
    
    const dbDir = path.join(appDataDir, 'arduino-ide-cursor');
    return path.join(dbDir, 'ai-memory.db');
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize sql.js with error handling
      this.SQL = await initSqlJs({
        locateFile: (file) => {
          // Try to locate the wasm file in node_modules
          const wasmPath = path.join(__dirname, '../../../node_modules/sql.js/dist/sql-wasm.wasm');
          return wasmPath;
        }
      });
      
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      try {
        await fs.mkdir(dbDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      // Load or create database
      try {
        const buffer = await fs.readFile(this.dbPath);
        this.db = new this.SQL.Database(buffer);
      } catch (error) {
        // Database doesn't exist, create new
        this.db = new this.SQL.Database();
      }

      await this.createTables();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize AI Memory database:', error);
      // Continue without database - memory features will be disabled
      this.initialized = false;
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (error) {
        // If initialization fails, return empty results instead of crashing
        console.warn('AI Memory not available:', error.message);
        return false;
      }
    }
    return true;
  }

  // Helper methods for sql.js
  async run(sql, params = []) {
    if (!(await this.ensureInitialized())) return;
    this.db.run(sql, params);
    await this.saveDatabase();
  }

  async get(sql, params = []) {
    if (!(await this.ensureInitialized())) return null;
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  }

  async all(sql, params = []) {
    if (!(await this.ensureInitialized())) return [];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  async exec(sql) {
    if (!(await this.ensureInitialized())) return;
    this.db.run(sql);
    await this.saveDatabase();
  }

  async saveDatabase() {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      await fs.writeFile(this.dbPath, buffer);
    }
  }

  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS error_signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signature TEXT NOT NULL UNIQUE,
        error_type TEXT,
        pattern TEXT,
        first_seen TEXT DEFAULT (datetime('now')),
        last_seen TEXT DEFAULT (datetime('now')),
        occurrence_count INTEGER DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS board_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fqbn TEXT NOT NULL UNIQUE,
        board_name TEXT,
        first_used TEXT DEFAULT (datetime('now')),
        last_used TEXT DEFAULT (datetime('now')),
        usage_count INTEGER DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS serial_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        pattern_hash TEXT NOT NULL UNIQUE,
        context TEXT,
        first_seen TEXT DEFAULT (datetime('now')),
        occurrence_count INTEGER DEFAULT 1
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pattern_hash ON serial_patterns(pattern_hash)`,
      `CREATE TABLE IF NOT EXISTS fixes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        error_signature_id INTEGER,
        fix_description TEXT NOT NULL,
        fix_code TEXT,
        context TEXT,
        success_rate REAL DEFAULT 1.0,
        applied_count INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        last_applied TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (error_signature_id) REFERENCES error_signatures(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_error_signature ON fixes(error_signature_id)`,
      `CREATE TABLE IF NOT EXISTS execution_outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        tool_arguments TEXT,
        success INTEGER DEFAULT 0,
        error_message TEXT,
        execution_time_ms INTEGER,
        context TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tool_name ON execution_outcomes(tool_name)`,
      `CREATE INDEX IF NOT EXISTS idx_success ON execution_outcomes(success)`,
      `CREATE TABLE IF NOT EXISTS error_fix_associations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        error_signature_id INTEGER,
        fix_id INTEGER,
        success_count INTEGER DEFAULT 1,
        failure_count INTEGER DEFAULT 0,
        last_used TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (error_signature_id) REFERENCES error_signatures(id),
        FOREIGN KEY (fix_id) REFERENCES fixes(id),
        UNIQUE(error_signature_id, fix_id)
      )`
    ];

    for (const table of tables) {
      await this.exec(table);
    }
  }

  /**
   * Generate error signature hash
   */
  generateErrorSignature(errorMessage) {
    const normalized = errorMessage
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Record or update error signature
   */
  async recordErrorSignature(errorMessage, errorType = null, pattern = null) {
    await this.ensureInitialized();
    const signature = this.generateErrorSignature(errorMessage);
    
    const existing = await this.get(
      'SELECT id, occurrence_count FROM error_signatures WHERE signature = ?',
      [signature]
    );

    if (existing) {
      await this.run(
        `UPDATE error_signatures 
         SET occurrence_count = occurrence_count + 1,
             last_seen = datetime('now'),
             error_type = COALESCE(?, error_type),
             pattern = COALESCE(?, pattern)
         WHERE signature = ?`,
        [errorType, pattern, signature]
      );
      return existing.id;
    } else {
      await this.run(
        'INSERT INTO error_signatures (signature, error_type, pattern) VALUES (?, ?, ?)',
        [signature, errorType, pattern]
      );
      const result = await this.get('SELECT last_insert_rowid() as id');
      return result.id;
    }
  }

  /**
   * Search for similar errors
   */
  async searchSimilarErrors(query, limit = 10) {
    await this.ensureInitialized();
    const queryHash = this.generateErrorSignature(query);
    
    // Search by exact signature match first
    const exactMatch = await this.get(
      'SELECT * FROM error_signatures WHERE signature = ?',
      [queryHash]
    );

    if (exactMatch) {
      // Get associated fixes
      const fixes = await this.all(
        `SELECT f.*, efa.success_count, efa.failure_count
         FROM fixes f
         JOIN error_fix_associations efa ON f.id = efa.fix_id
         WHERE efa.error_signature_id = ?
         ORDER BY efa.success_count DESC, f.last_applied DESC
         LIMIT ?`,
        [exactMatch.id, limit]
      );

      return {
        match: exactMatch,
        fixes: fixes,
        confidence: 1.0
      };
    }

    // Search by pattern similarity
    const similar = await this.all(
      `SELECT *, 
        CASE 
          WHEN pattern LIKE ? THEN 0.8
          WHEN error_type = ? THEN 0.6
          ELSE 0.3
        END as similarity
       FROM error_signatures
       WHERE pattern LIKE ? OR error_type LIKE ?
       ORDER BY similarity DESC, occurrence_count DESC
       LIMIT ?`,
      [`%${query}%`, query, `%${query}%`, `%${query}%`, limit]
    );

    const results = await Promise.all(similar.map(async (err) => {
      const fixes = await this.all(
        `SELECT f.*, efa.success_count, efa.failure_count
         FROM fixes f
         JOIN error_fix_associations efa ON f.id = efa.fix_id
         WHERE efa.error_signature_id = ?
         ORDER BY efa.success_count DESC
         LIMIT 3`,
        [err.id]
      );

      return {
        error: err,
        fixes: fixes,
        confidence: err.similarity
      };
    }));

    return {
      matches: results,
      count: results.length
    };
  }

  /**
   * Record a fix
   */
  async recordFix(errorSignature, fixDescription, fixCode = null, context = null) {
    await this.ensureInitialized();
    const errorId = await this.recordErrorSignature(errorSignature);
    
    // Insert fix
    await this.run(
      `INSERT INTO fixes (error_signature_id, fix_description, fix_code, context)
       VALUES (?, ?, ?, ?)`,
      [errorId, fixDescription, fixCode, JSON.stringify(context)]
    );

    const result = await this.get('SELECT last_insert_rowid() as id');
    const fixId = result.id;

    // Create association
    await this.run(
      `INSERT OR IGNORE INTO error_fix_associations (error_signature_id, fix_id)
       VALUES (?, ?)`,
      [errorId, fixId]
    );

    return {
      fixId: fixId,
      errorId: errorId
    };
  }

  /**
   * Record execution outcome
   */
  async recordExecution(toolCall, result) {
    await this.ensureInitialized();
    await this.run(
      `INSERT INTO execution_outcomes 
       (tool_name, tool_arguments, success, error_message, execution_time_ms, context)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        toolCall.name,
        JSON.stringify(toolCall.arguments),
        result.success ? 1 : 0,
        result.error || null,
        result.executionTime || null,
        JSON.stringify(result.context || {})
      ]
    );
  }

  /**
   * Record board usage
   */
  async recordBoardUsage(fqbn, boardName) {
    await this.ensureInitialized();
    const existing = await this.get(
      'SELECT id FROM board_types WHERE fqbn = ?',
      [fqbn]
    );

    if (existing) {
      await this.run(
        `UPDATE board_types 
         SET usage_count = usage_count + 1,
             last_used = datetime('now')
         WHERE fqbn = ?`,
        [fqbn]
      );
    } else {
      await this.run(
        'INSERT INTO board_types (fqbn, board_name) VALUES (?, ?)',
        [fqbn, boardName]
      );
    }
  }

  /**
   * Record serial pattern
   */
  async recordSerialPattern(pattern, context = null) {
    await this.ensureInitialized();
    const patternHash = crypto.createHash('sha256')
      .update(pattern.toLowerCase())
      .digest('hex')
      .substring(0, 16);

    const existing = await this.get(
      'SELECT id FROM serial_patterns WHERE pattern_hash = ?',
      [patternHash]
    );

    if (existing) {
      await this.run(
        'UPDATE serial_patterns SET occurrence_count = occurrence_count + 1 WHERE pattern_hash = ?',
        [patternHash]
      );
    } else {
      await this.run(
        'INSERT INTO serial_patterns (pattern, pattern_hash, context) VALUES (?, ?, ?)',
        [pattern, patternHash, JSON.stringify(context)]
      );
    }
  }

  /**
   * Get statistics
   */
  async getStats() {
    await this.ensureInitialized();
    const errorCount = await this.get('SELECT COUNT(*) as count FROM error_signatures');
    const fixCount = await this.get('SELECT COUNT(*) as count FROM fixes');
    const executionCount = await this.get('SELECT COUNT(*) as count FROM execution_outcomes');
    const successRate = await this.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
       FROM execution_outcomes`
    );

    return {
      errorSignatures: errorCount ? errorCount.count : 0,
      fixes: fixCount ? fixCount.count : 0,
      executions: executionCount ? executionCount.count : 0,
      successRate: executionCount && executionCount.count > 0 
        ? (successRate.successful / executionCount.count) 
        : 0
    };
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      await this.saveDatabase();
      this.db.close();
    }
  }
}

module.exports = AIMemory;
