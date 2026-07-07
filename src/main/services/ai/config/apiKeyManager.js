const Store = require('electron-store');
const crypto = require('crypto');

/**
 * Secure API Key Manager
 * Stores API keys encrypted using electron-store
 */
class APIKeyManager {
  constructor() {
    this.store = new Store({
      name: 'api-keys',
      encryptionKey: this.getEncryptionKey()
    });
  }

  /**
   * Get or generate encryption key
   */
  getEncryptionKey() {
    // In production, this should be derived from machine-specific data
    // For now, use a fixed key (in production, use a more secure method)
    const machineId = require('os').hostname();
    return crypto.createHash('sha256')
      .update(machineId + 'arduino-ide-cursor-secret')
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Store API key for a provider
   */
  setAPIKey(provider, apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('API key cannot be empty');
    }

    // Trim whitespace
    const trimmedKey = apiKey.trim();
    
    // Basic validation
    if (trimmedKey.length < 10) {
      throw new Error('API key appears to be invalid (too short)');
    }

    try {
      this.store.set(`keys.${provider}`, trimmedKey);
      return true;
    } catch (error) {
      throw new Error(`Failed to save API key: ${error.message}`);
    }
  }

  /**
   * Get API key for a provider
   */
  getAPIKey(provider) {
    return this.store.get(`keys.${provider}`, null);
  }

  /**
   * Check if API key exists for provider
   */
  hasAPIKey(provider) {
    return this.getAPIKey(provider) !== null;
  }

  /**
   * Remove API key for a provider
   */
  removeAPIKey(provider) {
    this.store.delete(`keys.${provider}`);
    return true;
  }

  /**
   * Get all stored providers
   */
  getAllProviders() {
    const keys = this.store.get('keys', {});
    return Object.keys(keys);
  }

  /**
   * Clear all API keys
   */
  clearAll() {
    this.store.delete('keys');
    return true;
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider) {
    return {
      hasKey: this.hasAPIKey(provider),
      key: this.hasAPIKey(provider) ? '***' + this.getAPIKey(provider).slice(-4) : null
    };
  }
}

module.exports = APIKeyManager;

