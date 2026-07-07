/**
 * Tests for pathValidator
 * Focuses on: path traversal prevention, directory approval, sandboxing
 */

const path = require('path');
const { validatePath, approveDirectory, revokeDirectory, getApprovedDirectories } = require('../pathValidator');

describe('pathValidator', () => {
  afterEach(() => {
    // Clean up approved directories between tests
    for (const dir of getApprovedDirectories()) {
      revokeDirectory(dir);
    }
  });

  describe('validatePath (no approved dirs)', () => {
    it('should allow any path when no directories are approved', () => {
      const result = validatePath('/some/random/path');
      expect(result.valid).toBe(true);
    });

    it('should reject null/undefined/empty paths', () => {
      expect(validatePath(null).valid).toBe(false);
      expect(validatePath(undefined).valid).toBe(false);
      expect(validatePath('').valid).toBe(false);
    });

    it('should reject paths with null bytes', () => {
      const result = validatePath('/path/with\0null');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('null bytes');
    });
  });

  describe('validatePath (with approved dirs)', () => {
    it('should allow paths within approved directory', () => {
      const root = path.resolve('/projects/my-sketch');
      approveDirectory(root);

      const result = validatePath(path.join(root, 'sketch.ino'));
      expect(result.valid).toBe(true);
    });

    it('should reject paths outside approved directories', () => {
      const root = path.resolve('/projects/my-sketch');
      approveDirectory(root);

      const result = validatePath(path.resolve('/etc/passwd'));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside approved');
    });

    it('should block path traversal attempts', () => {
      const root = path.resolve('/projects/my-sketch');
      approveDirectory(root);

      const traversal = path.join(root, '..', '..', 'etc', 'passwd');
      const result = validatePath(traversal);
      expect(result.valid).toBe(false);
    });

    it('should allow paths in any of multiple approved directories', () => {
      const root1 = path.resolve('/projects/sketch-a');
      const root2 = path.resolve('/projects/sketch-b');
      approveDirectory(root1);
      approveDirectory(root2);

      expect(validatePath(path.join(root1, 'main.ino')).valid).toBe(true);
      expect(validatePath(path.join(root2, 'main.ino')).valid).toBe(true);
    });
  });

  describe('approveDirectory / revokeDirectory', () => {
    it('should track approved directories', () => {
      const dir = path.resolve('/test/dir');
      approveDirectory(dir);
      expect(getApprovedDirectories()).toContain(dir);
    });

    it('should revoke approved directories', () => {
      const dir = path.resolve('/test/dir');
      approveDirectory(dir);
      revokeDirectory(dir);
      expect(getApprovedDirectories()).not.toContain(dir);
    });

    it('should handle null/undefined gracefully', () => {
      expect(() => approveDirectory(null)).not.toThrow();
      expect(() => revokeDirectory(undefined)).not.toThrow();
    });
  });
});
