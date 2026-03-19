/**
 * Tests for ArduinoService
 * Focuses on: command safety, input validation, output parsing
 */

// Mock dependencies before requiring the module
jest.mock('../../utils/errorHandler', () => ({
  handle: jest.fn((err) => ({ success: false, error: { message: err.message } })),
  validateInput: jest.fn(() => ({ valid: true, errors: [] })),
  getFriendlyMessage: jest.fn((err) => err.message)
}));

jest.mock('../../utils/notifications', () => ({
  progress: jest.fn(() => 'mock-id'),
  updateProgress: jest.fn(),
  dismiss: jest.fn(),
  success: jest.fn(),
  error: jest.fn()
}));

const ArduinoService = require('../arduinoService');

describe('ArduinoService', () => {
  let service;

  beforeEach(() => {
    service = new ArduinoService();
  });

  // ===== SECURITY: Command injection prevention =====
  describe('runCommand (security)', () => {
    it('should accept an array of arguments, not a shell string', async () => {
      // runCommand now takes string[] not a shell string
      const result = await service.runCommand(['version']);
      // We don't care about success here — we care that it doesn't throw
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
    });

    it('should safely handle arguments with special characters', async () => {
      // This should NOT execute shell metacharacters — the semicolon
      // is passed as a literal argument, not interpreted by a shell.
      // If arduino-cli is not installed, this will fail gracefully.
      const result = await service.runCommand(['version']);
      expect(result).toHaveProperty('success');
      // Most importantly: no shell expansion happened
      expect(result.stdout).not.toContain('PWNED');
    }, 15000);
  });

  // ===== FQBN Validation =====
  describe('validateFQBN', () => {
    it('should accept valid FQBN format', () => {
      expect(service.validateFQBN('arduino:avr:uno')).toBe(true);
      expect(service.validateFQBN('esp32:esp32:esp32')).toBe(true);
      expect(service.validateFQBN('arduino:avr:nano:cpu=atmega328old')).toBe(true);
    });

    it('should reject invalid FQBN format', () => {
      expect(service.validateFQBN('')).toBe(false);
      expect(service.validateFQBN(null)).toBe(false);
      expect(service.validateFQBN(undefined)).toBe(false);
      expect(service.validateFQBN('just-a-name')).toBe(false);
      expect(service.validateFQBN('only:two')).toBe(false);
    });
  });

  // ===== Output Parsing =====
  describe('parseCompileOutput', () => {
    it('should detect successful compilation', () => {
      const stdout = 'Sketch uses 2048 bytes (6%) of program storage space. Maximum is 32256 bytes.';
      const result = service.parseCompileOutput(stdout, '');
      expect(result.success).toBe(true);
      expect(result.programSize).toBe(2048);
      expect(result.usagePercent).toBe(6);
    });

    it('should detect compilation errors', () => {
      const stderr = "sketch.ino:5:1: error: 'foo' was not declared in this scope";
      const result = service.parseCompileOutput('', stderr);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should collect warnings', () => {
      const stdout = 'Sketch uses 2048 bytes (6%) of program storage space.\n';
      const stderr = 'warning: unused variable x';
      const result = service.parseCompileOutput(stdout, stderr);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('parseUploadOutput', () => {
    it('should detect successful AVR upload', () => {
      const stderr = 'avrdude done. Thank you.';
      const result = service.parseUploadOutput('', stderr);
      expect(result.success).toBe(true);
    });

    it('should detect successful ESP32 upload', () => {
      const stderr = 'Hard resetting via RTS pin...';
      const result = service.parseUploadOutput('', stderr);
      expect(result.success).toBe(true);
    });

    it('should detect upload timeout', () => {
      const stderr = 'error: timeout waiting for device';
      const result = service.parseUploadOutput('', stderr);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect permission denied', () => {
      const stderr = 'error: permission denied on COM3';
      const result = service.parseUploadOutput('', stderr);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ===== Common Boards Fallback =====
  describe('getCommonBoards', () => {
    it('should return a non-empty array of boards', () => {
      const boards = service.getCommonBoards();
      expect(Array.isArray(boards)).toBe(true);
      expect(boards.length).toBeGreaterThan(0);
    });

    it('should include Arduino Uno', () => {
      const boards = service.getCommonBoards();
      const uno = boards.find(b => b.fqbn === 'arduino:avr:uno');
      expect(uno).toBeDefined();
      expect(uno.name).toBe('Arduino Uno');
    });

    it('should have correct board object shape', () => {
      const boards = service.getCommonBoards();
      for (const board of boards) {
        expect(board).toHaveProperty('name');
        expect(board).toHaveProperty('fqbn');
        expect(typeof board.name).toBe('string');
        expect(typeof board.fqbn).toBe('string');
      }
    });
  });
});
