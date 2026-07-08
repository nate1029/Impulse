import {
  CPU,
  avrInstruction,
  AVRIOPort,
  AVRUSART,
  AVRADC,
  AVRTimer,
  portBConfig,
  portCConfig,
  portDConfig,
  usart0Config,
  timer0Config,
  timer1Config,
  timer2Config,
  adcConfig,
  PinState,
} from 'avr8js';
import { parseHex } from './hex-loader.js';

export const F_CPU = 16_000_000; // 16 MHz
const CYCLES_PER_MS = F_CPU / 1000;

// Arduino UNO pin → {port, bit}
const PIN_MAP = {
  0:  { port: 'D', bit: 0 },
  1:  { port: 'D', bit: 1 },
  2:  { port: 'D', bit: 2 },
  3:  { port: 'D', bit: 3 },
  4:  { port: 'D', bit: 4 },
  5:  { port: 'D', bit: 5 },
  6:  { port: 'D', bit: 6 },
  7:  { port: 'D', bit: 7 },
  8:  { port: 'B', bit: 0 },
  9:  { port: 'B', bit: 1 },
  10: { port: 'B', bit: 2 },
  11: { port: 'B', bit: 3 },
  12: { port: 'B', bit: 4 },
  13: { port: 'B', bit: 5 },
  14: { port: 'C', bit: 0 }, // A0
  15: { port: 'C', bit: 1 },
  16: { port: 'C', bit: 2 },
  17: { port: 'C', bit: 3 },
  18: { port: 'C', bit: 4 },
  19: { port: 'C', bit: 5 },
};

export class AvrRunner {
  constructor() {
    this.cpu = null;
    this.portB = null;
    this.portC = null;
    this.portD = null;
    this.usart = null;
    this.adc = null;
    this.running = false;
    this._rafId = null;
    this._pinStates = new Array(20).fill(false);
    this._externalDrive = new Array(20).fill(null); // null = floating
    this._speed = 0; // simulated speed vs realtime, 0..1+
    this._startWall = 0;
    this._startCycles = 0;

    // Callbacks
    this.onPinChange = null;   // (pin, high, cycles) => void
    this.onSerial = null;      // (char) => void
    this.onError = null;       // (msg) => void

    this._analogValues = new Array(6).fill(0);
  }

  get cycles() {
    return this.cpu ? this.cpu.cycles : 0;
  }

  // Simulated time in seconds
  get time() {
    return this.cpu ? this.cpu.cycles / F_CPU : 0;
  }

  // Ratio of simulated speed to real time (1 = realtime)
  get speed() {
    return this._speed;
  }

  load(hexString) {
    try {
      const progMem = parseHex(hexString);
      this.cpu = new CPU(progMem);

      this.portB = new AVRIOPort(this.cpu, portBConfig);
      this.portC = new AVRIOPort(this.cpu, portCConfig);
      this.portD = new AVRIOPort(this.cpu, portDConfig);

      this.usart = new AVRUSART(this.cpu, usart0Config, F_CPU);
      this.usart.onByteTransmit = (byte) => {
        if (this.onSerial) this.onSerial(String.fromCharCode(byte));
      };
      // RX pacing: the UART accepts one byte per character time, so queue
      // input and feed the next byte whenever the previous one is consumed.
      this._rxQueue = [];
      this.usart.onRxComplete = () => this._pumpRx();

      this.adc = new AVRADC(this.cpu, adcConfig);
      this._pushAnalog();

      new AVRTimer(this.cpu, timer0Config);
      new AVRTimer(this.cpu, timer1Config);
      new AVRTimer(this.cpu, timer2Config);

      this._pinStates = new Array(20).fill(false);

      const watchPort = (port, base) => {
        port.addListener(() => {
          for (let bit = 0; bit < 8; bit++) {
            const pin = base + bit;
            if (!(pin in PIN_MAP)) continue;

            // Emulate the internal pull-up: a floating input pin with the
            // pull-up enabled reads HIGH (avr8js leaves this to the caller).
            if (this._externalDrive[pin] === null &&
                port.pinState(bit) === PinState.InputPullUp &&
                !(port.pinValue & (1 << bit))) {
              port.setPin(bit, true);
              continue; // listener re-fires after setPin
            }

            const high = port.pinState(bit) === PinState.High;
            if (this._pinStates[pin] !== high) {
              this._pinStates[pin] = high;
              if (this.onPinChange) this.onPinChange(pin, high, this.cpu.cycles);
            }
          }
        });
      };
      watchPort(this.portB, 8);
      watchPort(this.portC, 14);
      watchPort(this.portD, 0);

      return true;
    } catch (err) {
      if (this.onError) this.onError(`Failed to load program: ${err.message}`);
      return false;
    }
  }

  start() {
    if (!this.cpu || this.running) return;
    this.running = true;
    this._startWall = performance.now();
    this._startCycles = this.cpu.cycles;
    this._tick();
  }

  stop() {
    this.running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  reset() {
    this.stop();
    if (this.cpu) this.cpu.reset();
    this._pinStates = new Array(20).fill(false);
  }

  setInputPin(arduinoPin, high) {
    const m = PIN_MAP[arduinoPin];
    if (!m) return;
    this._externalDrive[arduinoPin] = high;
    const port = this._getPort(m.port);
    if (port) port.setPin(m.bit, high);
  }

  // Queue text for the simulated UART; bytes are fed at line rate.
  serialWrite(text) {
    if (!this.usart) return;
    for (const ch of text) this._rxQueue.push(ch.charCodeAt(0) & 0xff);
    this._pumpRx();
  }

  _pumpRx() {
    if (!this.usart || !this._rxQueue) return;
    while (this._rxQueue.length && this.usart.writeByte(this._rxQueue[0])) {
      this._rxQueue.shift();
    }
  }

  // Release external drive; pin floats (pull-up snaps it high if enabled)
  setPinFloating(arduinoPin) {
    const m = PIN_MAP[arduinoPin];
    if (!m) return;
    this._externalDrive[arduinoPin] = null;
    const port = this._getPort(m.port);
    if (!port) return;
    port.setPin(m.bit, port.pinState(m.bit) === PinState.InputPullUp);
  }

  setAnalogPin(channel, value) {
    if (channel < 0 || channel > 5) return;
    this._analogValues[channel] = Math.max(0, Math.min(1023, value));
    this._pushAnalog();
  }

  getPinState(arduinoPin) {
    return this._pinStates[arduinoPin] || false;
  }

  _pushAnalog() {
    if (!this.adc) return;
    // avr8js reads channel voltages (0-5V) from this array
    for (let i = 0; i < 6; i++) {
      this.adc.channelValues[i] = (this._analogValues[i] / 1023) * 5;
    }
  }

  _getPort(letter) {
    if (letter === 'B') return this.portB;
    if (letter === 'C') return this.portC;
    return this.portD;
  }

  _tick() {
    if (!this.running) return;

    const frameBudgetMs = 10;
    const targetCycles = CYCLES_PER_MS * 16; // aim ~16ms sim time per frame
    const start = performance.now();

    try {
      const cpu = this.cpu;
      const endCycles = cpu.cycles + targetCycles;
      while (cpu.cycles < endCycles) {
        // Run a small batch, then check the wall clock
        for (let i = 0; i < 5000; i++) {
          avrInstruction(cpu);
          cpu.tick();
        }
        if (performance.now() - start > frameBudgetMs) break;
      }
    } catch (err) {
      this.running = false;
      if (this.onError) this.onError(`Runtime error: ${err.message}`);
      return;
    }

    // Update speed estimate
    const wallSec = (performance.now() - this._startWall) / 1000;
    if (wallSec > 0.2) {
      const simSec = (this.cpu.cycles - this._startCycles) / F_CPU;
      this._speed = simSec / wallSec;
    }

    this._rafId = requestAnimationFrame(() => this._tick());
  }
}
