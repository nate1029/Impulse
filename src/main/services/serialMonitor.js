const { EventEmitter } = require('events');

class SerialMonitor extends EventEmitter {
  constructor() {
    super();
    this.SerialPort = null;
    this._serialportLoadError = null;
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.currentBaudRate = null;
    this.commonBaudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
    this.autoBaudRateDetection = true;

    // Auto-reconnect state
    this._autoReconnect = true;
    this._lastPortPath = null;
    this._lastBaudRate = null;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 20;  // ~60s of trying
    this._reconnectIntervalMs = 3000; // Poll every 3s
    this._intentionalDisconnect = false;
  }

  /**
   * Lazy-load serialport so Electron can start even when native bindings
   * are unavailable for the current runtime.
   */
  getSerialPortClass() {
    if (this.SerialPort) return this.SerialPort;
    if (this._serialportLoadError) throw this._serialportLoadError;

    try {
      // Require on first use to avoid crashing app startup.
      this.SerialPort = require('serialport').SerialPort;
      return this.SerialPort;
    } catch (error) {
      const wrapped = new Error(
        `Serial monitor unavailable: ${error.message}. Reinstall dependencies or rebuild native modules for this Electron version.`
      );
      wrapped.cause = error;
      this._serialportLoadError = wrapped;
      throw wrapped;
    }
  }

  async listPorts() {
    try {
      const SerialPort = this.getSerialPortClass();
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Unknown',
        vendorId: port.vendorId,
        productId: port.productId,
        serialNumber: port.serialNumber
      }));
    } catch (error) {
      throw new Error(`Failed to list serial ports: ${error.message}`);
    }
  }

  async connect(portPath, baudRate = 9600) {
    if (this.isConnected) {
      await this.disconnect();
    }

    try {
      const SerialPort = this.getSerialPortClass();
      this.port = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        autoOpen: false
      });

      // Set up event handlers BEFORE opening the port.
      // NOTE: We intentionally stream raw chunks instead of a line-based parser.
      // Many devices don't always end lines with '\n' (or may output binary),
      // and a Readline parser can make it look like "serial monitor doesn't work"
      // because it buffers until a delimiter is found.
      this.parser = null;

      this.port.on('data', (chunk) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        this.emit('data', {
          timestamp: new Date().toISOString(),
          data: text,
          baudRate: this.currentBaudRate
        });
      });

      this.port.on('error', (error) => {
        this.emit('error', error);
      });

      this.port.on('close', () => {
        this.isConnected = false;
        this.emit('disconnected');
        // Trigger auto-reconnect if disconnect was not intentional (USB yanked)
        if (this._autoReconnect && !this._intentionalDisconnect && this._lastPortPath) {
          this._startReconnect();
        }
      });

      // Open the port (using promise-based API)
      await new Promise((resolve, reject) => {
        this.port.open((error) => {
          if (error) {
            reject(new Error(`Failed to open port: ${error.message}`));
          } else {
            resolve();
          }
        });
      });

      this.isConnected = true;
      this.currentBaudRate = baudRate;
      this._lastPortPath = portPath;
      this._lastBaudRate = baudRate;
      this._intentionalDisconnect = false;
      this._reconnectAttempts = 0;
      this._stopReconnect();
      this.emit('connected');
    } catch (error) {
      throw new Error(`Failed to create serial connection: ${error.message}`);
    }
  }

  async disconnect() {
    this._intentionalDisconnect = true;
    this._stopReconnect();
    return new Promise((resolve) => {
      if (this.port && this.isConnected) {
        this.port.close((error) => {
          if (error) {
            console.error('Error closing port:', error);
          }
          this.isConnected = false;
          this.port = null;
          this.parser = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async send(data) {
    if (!this.isConnected || !this.port) {
      throw new Error('Serial port not connected');
    }

    return new Promise((resolve, reject) => {
      this.port.write(data, (error) => {
        if (error) {
          reject(new Error(`Failed to send data: ${error.message}`));
        } else {
          // Wait for drain to ensure data is sent
          this.port.drain((error) => {
            if (error) {
              reject(new Error(`Failed to drain: ${error.message}`));
            } else {
              resolve();
            }
          });
        }
      });
    });
  }

  async tryBaudRates(portPath) {
    if (!this.autoBaudRateDetection) {
      return null;
    }

    for (const baudRate of this.commonBaudRates) {
      try {
        await this.connect(portPath, baudRate);
        // Wait a bit to see if we get valid data
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (this.isConnected) {
          return baudRate;
        }
      } catch (error) {
        // Try next baud rate
        continue;
      }
    }

    return null;
  }

  setBaudRate(baudRate) {
    if (this.isConnected && this.port) {
      this.currentBaudRate = baudRate;
      // Note: Changing baud rate requires reconnection
      // This is a simplified version
    }
  }

  /**
   * Check if connected (method version for compatibility)
   */
  isConnectedStatus() {
    return this.isConnected;
  }

  /**
   * Get current baud rate
   */
  getBaudRate() {
    return this.currentBaudRate;
  }

  // ==================== Auto-Reconnect ====================

  /**
   * Start polling for the port to reappear after USB disconnect.
   * Emits 'reconnecting' with attempt count, and reconnects automatically.
   */
  _startReconnect() {
    if (this._reconnectTimer) return; // Already reconnecting
    this._reconnectAttempts = 0;

    this.emit('reconnecting', { attempt: 0, port: this._lastPortPath });

    this._reconnectTimer = setInterval(async () => {
      this._reconnectAttempts++;

      if (this._reconnectAttempts > this._maxReconnectAttempts) {
        this._stopReconnect();
        this.emit('reconnect-failed', { port: this._lastPortPath });
        return;
      }

      try {
        // Check if the port has reappeared
        const SerialPort = this.getSerialPortClass();
        const ports = await SerialPort.list();
        const found = ports.some(p => p.path === this._lastPortPath);

        if (found) {
          this._stopReconnect();
          this.emit('reconnecting', {
            attempt: this._reconnectAttempts,
            port: this._lastPortPath,
            status: 'port-found'
          });

          // Small delay to let the OS finish enumerating the device
          await new Promise(r => setTimeout(r, 1000));

          try {
            await this.connect(this._lastPortPath, this._lastBaudRate);
            this.emit('reconnected', { port: this._lastPortPath });
          } catch (err) {
            // Port appeared but connection failed — keep trying
            this._startReconnect();
          }
        } else {
          this.emit('reconnecting', {
            attempt: this._reconnectAttempts,
            port: this._lastPortPath,
            status: 'waiting'
          });
        }
      } catch (err) {
        // List failed — keep trying
      }
    }, this._reconnectIntervalMs);
  }

  _stopReconnect() {
    if (this._reconnectTimer) {
      clearInterval(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /**
   * Enable/disable auto-reconnect
   */
  setAutoReconnect(enabled) {
    this._autoReconnect = enabled;
    if (!enabled) {
      this._stopReconnect();
    }
  }
}

module.exports = SerialMonitor;

