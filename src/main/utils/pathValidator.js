/**
 * Path Validator Utility
 * Restricts filesystem access to user-approved directories.
 * Prevents path traversal attacks and access outside the workspace.
 * @module main/utils/pathValidator
 */

const path = require('path');

/** Set of directories the user has explicitly approved (via dialog) */
const approvedRoots = new Set();

/**
 * Register a directory as user-approved (called when user opens a folder/file via dialog).
 * @param {string} dirPath - Absolute path to approve
 */
function approveDirectory(dirPath) {
  if (dirPath && typeof dirPath === 'string') {
    approvedRoots.add(path.resolve(dirPath));
  }
}

/**
 * Remove an approved directory.
 * @param {string} dirPath - Absolute path to revoke
 */
function revokeDirectory(dirPath) {
  if (dirPath && typeof dirPath === 'string') {
    approvedRoots.delete(path.resolve(dirPath));
  }
}

/**
 * Get all currently approved directories.
 * @returns {string[]}
 */
function getApprovedDirectories() {
  return Array.from(approvedRoots);
}

/**
 * Validate that a path is safe and within an approved directory.
 * @param {string} filePath - Path to validate
 * @returns {{ valid: boolean, resolved: string, error?: string }}
 */
function validatePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, resolved: '', error: 'Path is required' };
  }

  // Reject null bytes
  if (filePath.includes('\0')) {
    return { valid: false, resolved: '', error: 'Path must not contain null bytes' };
  }

  // Resolve to absolute path (normalizes ../, ./, etc.)
  const resolved = path.resolve(filePath);

  // If no directories have been approved yet, allow (first-run scenario)
  if (approvedRoots.size === 0) {
    return { valid: true, resolved };
  }

  // Check that the resolved path falls within at least one approved root
  for (const root of approvedRoots) {
    const relative = path.relative(root, resolved);
    // relative must not start with '..' (which would mean it's outside the root)
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      return { valid: true, resolved };
    }
  }

  return {
    valid: false,
    resolved,
    error: `Access denied: path "${resolved}" is outside approved directories`
  };
}

module.exports = {
  approveDirectory,
  revokeDirectory,
  getApprovedDirectories,
  validatePath
};
