const { EventEmitter } = require('events');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class SerialMonitor extends EventEmitter {
  constructor() {
    super();
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.currentBaudRate = null;
    this.commonBaudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
    this.autoBaudRateDetection = true;
  }

  async listPorts() {
    try {
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
      this.emit('connected');
    } catch (error) {
      throw new Error(`Failed to create serial connection: ${error.message}`);
    }
  }

  async disconnect() {
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
}

module.exports = SerialMonitor;

