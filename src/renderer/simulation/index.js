// Simulation manager — Wokwi-style UI orchestrating the AVR runner + circuit canvas.

import { AvrRunner, F_CPU } from './avr-runner.js';
import { CircuitCanvas } from './canvas.js';
import { PARTS, CATEGORY_ORDER, unoPinToArduino, isGndPin, isPowerPin } from './parts-catalog.js';
import { validateCircuit, placeCircuit } from './circuit-ai.js';

const STORAGE_KEY = 'impulse-sim-diagram';

export class SimulationManager {
  constructor() {
    this.runner = new AvrRunner();
    this.canvas = null;
    this.running = false;
    this.paused = false;
    this._netMap = {};        // arduinoPin → [{partId, pin}] (parts wired to that UNO pin)
    this._partNets = {};      // partId → { pinName → arduinoPin }
    this._servoState = {};    // partId → { lastRise, pin }
    this._serialBuffer = '';
    this._statsTimer = null;

    this._buildUI();
    this._bindRunner();
    this._restore();
  }

  // ── UI scaffolding ────────────────────────────────────────────────────────

  _buildUI() {
    const panel = document.getElementById('simPanel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="sim-stage">
        <div class="sim-canvas-wrap" id="simCanvasWrap"></div>

        <div class="sim-fabs">
          <button class="sim-fab sim-fab-play" id="simPlayBtn" title="Start the simulation">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="sim-fab sim-fab-stop" id="simStopBtn" title="Stop the simulation" style="display:none">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          </button>
          <button class="sim-fab sim-fab-pause" id="simPauseBtn" title="Pause the simulation" style="display:none">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
          </button>
          <button class="sim-fab sim-fab-add" id="simAddBtn" title="Add a new part">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>
          </button>
          <button class="sim-fab sim-fab-ai" id="simAiBtn" title="Build circuit from code (AI)">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2l1.7 5.2L19 9l-5.3 1.8L12 16l-1.7-5.2L5 9l5.3-1.8L12 2z"/>
              <path d="M19 14l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6L15.5 18l2.6-.9L19 14z" opacity="0.8"/>
              <path d="M5 15l.7 2L7.5 18l-1.8.7L5 20.5l-.7-1.8L2.5 18l1.8-1L5 15z" opacity="0.6"/>
            </svg>
          </button>
          <button class="sim-fab sim-fab-menu" id="simMenuBtn" title="More options">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>

        <div class="sim-stats" id="simStats" style="display:none">
          <span class="sim-stats-time" title="Simulation time">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>
            <span id="simTimeLabel">00:00.000</span>
          </span>
          <span class="sim-stats-speed" title="Simulation speed vs real time">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20a8 8 0 1 1 8-8"/><path d="M12 12l4-4"/></svg>
            <span id="simSpeedLabel">0%</span>
          </span>
        </div>

        <div class="sim-picker" id="simPicker" style="display:none">
          <div class="sim-picker-search">
            <input type="text" id="simPickerSearch" placeholder="Search parts…" autocomplete="off">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <div class="sim-picker-list" id="simPickerList"></div>
        </div>

        <div class="sim-menu" id="simMenu" style="display:none">
          <button class="sim-menu-item" id="simMenuClear">Clear circuit</button>
          <button class="sim-menu-item" id="simMenuZoomFit">Reset view</button>
        </div>
      </div>

      <div class="sim-serial-pane" id="simSerialPane">
        <div id="simSerialOut" class="sim-serial-out"></div>
        <div class="sim-serial-inputrow">
          <input type="text" id="simSerialInput" placeholder="Type here to send data to the serial port…">
          <button class="sim-serial-btn" id="simSerialClear" title="Clear the serial monitor output">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
    `;

    const wrap = document.getElementById('simCanvasWrap');
    this.canvas = new CircuitCanvas(wrap);
    this.canvas.onChange = () => {
      this._rebuildNets();
      this._save();
    };
    // The canvas hands off part interactions here (its pointer handlers fire
    // reliably; listeners on the shadow element do not under the drag layer).
    this.canvas.onPartPointerDown = (part) => this._onPartPress(part);
    this.canvas.onPartPointerUp = (part) => this._onPartRelease(part);

    this._buildPicker();

    // FAB handlers
    document.getElementById('simPlayBtn').addEventListener('click', () => {
      if (this.running) this.restart(); else this.run();
    });
    document.getElementById('simStopBtn').addEventListener('click', () => this.stop());
    document.getElementById('simPauseBtn').addEventListener('click', () => this.togglePause());
    document.getElementById('simAddBtn').addEventListener('click', () => this._togglePicker());
    document.getElementById('simAiBtn').addEventListener('click', () => this.buildCircuitFromCode());
    document.getElementById('simMenuBtn').addEventListener('click', () => this._toggleMenu());
    document.getElementById('simMenuClear').addEventListener('click', () => {
      this._toggleMenu(false);
      if (confirm('Clear the whole circuit?')) {
        this.stop();
        this.canvas.clear();
        this.canvas.addPart('wokwi-arduino-uno', 60, 60);
        this._save();
      }
    });
    document.getElementById('simMenuZoomFit').addEventListener('click', () => {
      this._toggleMenu(false);
      this.canvas.zoomFit();
    });

    // Serial input → AVR RX
    const serialInput = document.getElementById('simSerialInput');
    serialInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.running) {
        const text = serialInput.value + '\n';
        serialInput.value = '';
        this.runner.serialWrite(text);
      }
    });
    document.getElementById('simSerialClear').addEventListener('click', () => this._clearSerial());

    // Close picker/menu on outside click
    document.addEventListener('pointerdown', (e) => {
      const picker = document.getElementById('simPicker');
      const menu = document.getElementById('simMenu');
      if (picker && picker.style.display !== 'none' &&
          !picker.contains(e.target) && e.target.id !== 'simAddBtn' &&
          !e.target.closest('#simAddBtn')) {
        picker.style.display = 'none';
      }
      if (menu && menu.style.display !== 'none' &&
          !menu.contains(e.target) && !e.target.closest('#simMenuBtn')) {
        menu.style.display = 'none';
      }
    });
  }

  _buildPicker() {
    const list = document.getElementById('simPickerList');
    const search = document.getElementById('simPickerSearch');
    if (!list) return;

    const render = (filter = '') => {
      list.innerHTML = '';
      const f = filter.trim().toLowerCase();
      for (const cat of CATEGORY_ORDER) {
        const items = Object.entries(PARTS).filter(([type, def]) =>
          def.category === cat && (!f || def.label.toLowerCase().includes(f)));
        if (!items.length) continue;

        const header = document.createElement('div');
        header.className = 'sim-picker-cat';
        header.textContent = cat;
        list.appendChild(header);

        for (const [type, def] of items) {
          const item = document.createElement('div');
          item.className = 'sim-picker-item';
          const thumb = document.createElement('div');
          thumb.className = 'sim-picker-thumb';
          const el = document.createElement(def.tag);
          if (def.defaultAttrs) {
            for (const [k, v] of Object.entries(def.defaultAttrs)) el.setAttribute(k, v);
          }
          thumb.appendChild(el);
          const name = document.createElement('span');
          name.className = 'sim-picker-name';
          name.textContent = def.label;
          item.appendChild(thumb);
          item.appendChild(name);
          item.addEventListener('click', () => {
            this._togglePicker(false);
            // Place near center of visible canvas
            const wrap = document.getElementById('simCanvasWrap');
            const rect = wrap.getBoundingClientRect();
            const world = this.canvas._toWorld(rect.left + rect.width / 2, rect.top + rect.height / 3);
            this.canvas.addPart(type, world.x, world.y);
            this._save();
          });
          list.appendChild(item);
        }
      }
    };

    render();
    search.addEventListener('input', () => render(search.value));
  }

  _togglePicker(force) {
    const picker = document.getElementById('simPicker');
    if (!picker) return;
    const show = force !== undefined ? force : picker.style.display === 'none';
    picker.style.display = show ? 'flex' : 'none';
    if (show) {
      const search = document.getElementById('simPickerSearch');
      search.value = '';
      search.focus();
      search.dispatchEvent(new Event('input'));
    }
  }

  _toggleMenu(force) {
    const menu = document.getElementById('simMenu');
    if (!menu) return;
    const show = force !== undefined ? force : menu.style.display === 'none';
    menu.style.display = show ? 'block' : 'none';
  }

  // ── Runner wiring ────────────────────────────────────────────────────────

  _bindRunner() {
    this.runner.onSerial = (ch) => this._appendSerial(ch);
    this.runner.onError = (msg) => {
      this._appendSerial(`\n[simulator] ${msg}\n`);
      this.stop();
    };
    this.runner.onPinChange = (pin, high, cycles) => this._onPinChange(pin, high, cycles);
  }

  // ── Net mapping ──────────────────────────────────────────────────────────

  _rebuildNets() {
    this._netMap = {};
    this._partNets = {};
    if (!this.canvas) return;

    const uno = this.canvas.parts.find(p => p.type === 'wokwi-arduino-uno');
    if (!uno) return;

    // Build adjacency: node = `${partId}:${pin}`
    const adj = {};
    const link = (a, b) => {
      (adj[a] = adj[a] || []).push(b);
      (adj[b] = adj[b] || []).push(a);
    };
    for (const w of this.canvas.wires) {
      link(`${w.from.partId}:${w.from.pin}`, `${w.to.partId}:${w.to.pin}`);
    }
    // Resistors conduct: join their two terminals
    for (const p of this.canvas.parts) {
      if (p.type === 'wokwi-resistor') {
        link(`${p.id}:1`, `${p.id}:2`);
      }
      if (p.type === 'wokwi-pushbutton' || p.type === 'wokwi-pushbutton-6mm') {
        // Same-side terminals are internally connected
        link(`${p.id}:1.l`, `${p.id}:1.r`);
        link(`${p.id}:2.l`, `${p.id}:2.r`);
      }
    }

    // BFS from each UNO digital/analog pin
    for (const pinInfo of uno.el.pinInfo || []) {
      const arduinoPin = unoPinToArduino(pinInfo.name);
      if (arduinoPin === null) continue;
      const startNode = `${uno.id}:${pinInfo.name}`;
      const visited = new Set([startNode]);
      const queue = [startNode];
      while (queue.length) {
        const node = queue.shift();
        for (const next of adj[node] || []) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }
      // Every non-UNO node reached is connected to this Arduino pin
      for (const node of visited) {
        const sep = node.indexOf(':');
        const partId = node.slice(0, sep);
        const pin = node.slice(sep + 1);
        if (partId === uno.id) continue;
        (this._netMap[arduinoPin] = this._netMap[arduinoPin] || []).push({ partId, pin });
        (this._partNets[partId] = this._partNets[partId] || {})[pin] = arduinoPin;
      }
    }
  }

  // ── Pin change → component visuals ───────────────────────────────────────

  _onPinChange(arduinoPin, high, cycles) {
    // UNO built-in LED
    const uno = this.canvas?.parts.find(p => p.type === 'wokwi-arduino-uno');
    if (uno && arduinoPin === 13) uno.el.led13 = high;

    const targets = this._netMap[arduinoPin];
    if (!targets) return;

    for (const { partId, pin } of targets) {
      const part = this.canvas.getPart(partId);
      if (!part) continue;

      switch (part.type) {
        case 'wokwi-led': {
          // LED lights when its anode net is high (assumes cathode → GND)
          if (pin === 'A') part.el.value = high;
          break;
        }
        case 'wokwi-rgb-led': {
          if (pin === 'R') part.el.ledRed = high ? 1 : 0;
          if (pin === 'G') part.el.ledGreen = high ? 1 : 0;
          if (pin === 'B') part.el.ledBlue = high ? 1 : 0;
          break;
        }
        case 'wokwi-led-bar-graph': {
          const m = /^A(\d+)$/.exec(pin);
          if (m) {
            const values = part.el.values || new Array(10).fill(0);
            values[parseInt(m[1], 10) - 1] = high ? 1 : 0;
            part.el.values = [...values];
          }
          break;
        }
        case 'wokwi-buzzer': {
          // Pin "2" is positive; sound when its net is driven high
          if (pin === '2') part.el.hasSignal = high;
          break;
        }
        case 'wokwi-servo': {
          if (pin === 'PWM' || pin === 'SIG') this._decodeServo(part, high, cycles);
          break;
        }
        default:
          break;
      }
    }
  }

  _decodeServo(part, high, cycles) {
    const st = this._servoState[part.id] || (this._servoState[part.id] = { lastRise: 0 });
    if (high) {
      st.lastRise = cycles;
    } else if (st.lastRise) {
      const pulseUs = ((cycles - st.lastRise) / F_CPU) * 1e6;
      if (pulseUs >= 400 && pulseUs <= 2600) {
        const angle = Math.max(0, Math.min(180, ((pulseUs - 1000) / 1000) * 180));
        part.el.angle = angle;
      }
    }
  }

  // ── Input parts → AVR ────────────────────────────────────────────────────

  _attachInputHandlers() {
    if (!this.canvas) return;

    for (const part of this.canvas.parts) {
      if (part._simHandlersAttached) continue;
      part._simHandlersAttached = true;

      if (part.type === 'wokwi-potentiometer' || part.type === 'wokwi-slide-potentiometer') {
        part.el.addEventListener('input', () => this._setPot(part));
        part.el.addEventListener('pointerup', () => this._setPot(part));
        part.el.addEventListener('pointermove', () => this._setPot(part));
      }
    }
  }

  // Called by the canvas when any part is pressed (pointerdown).
  _onPartPress(part) {
    if (part.type === 'wokwi-pushbutton' || part.type === 'wokwi-pushbutton-6mm') {
      part._pressAt = performance.now();
      if (part._releaseTimer) { clearTimeout(part._releaseTimer); part._releaseTimer = null; }
      part.el.pressed = true;
      this._setButton(part, true);
    } else if (part.type === 'wokwi-slide-switch') {
      // Toggle position on click
      part.el.value = part.el.value ? 0 : 1;
      this._setSlideSwitch(part);
    }
  }

  // Called by the canvas when a part is released (pointerup / pointerleave).
  _onPartRelease(part) {
    if (part.type !== 'wokwi-pushbutton' && part.type !== 'wokwi-pushbutton-6mm') return;
    if (!part._pressAt) return;
    // Guarantee a minimum hold so a fast click still beats the sketch debounce.
    const MIN_PRESS_MS = 120;
    const held = performance.now() - part._pressAt;
    const remaining = Math.max(0, MIN_PRESS_MS - held);
    if (part._releaseTimer) clearTimeout(part._releaseTimer);
    part._releaseTimer = setTimeout(() => {
      part._releaseTimer = null;
      part._pressAt = 0;
      part.el.pressed = false;
      this._setButton(part, false);
    }, remaining);
  }

  _setButton(part, pressed) {
    const nets = this._partNets[part.id] || {};
    // Button bridges its two sides when pressed. GND-wired buttons pull the
    // pin LOW when pressed; 5V-wired buttons pull it HIGH.
    const gndConnected = this._sideConnectsTo(part, isGndPin);
    for (const [pin, arduinoPin] of Object.entries(nets)) {
      if (pressed) {
        this.runner.setInputPin(arduinoPin, !gndConnected);
      } else {
        // Released: the pin floats; the pull-up (if enabled) snaps it high.
        this.runner.setPinFloating(arduinoPin);
      }
    }
  }

  _sideConnectsTo(part, predicate) {
    // Check if any wire from this part goes to a matching UNO pin
    const uno = this.canvas.parts.find(p => p.type === 'wokwi-arduino-uno');
    if (!uno) return false;
    for (const w of this.canvas.wires) {
      const ends = [
        { partId: w.from.partId, pin: w.from.pin, other: w.to },
        { partId: w.to.partId, pin: w.to.pin, other: w.from },
      ];
      for (const end of ends) {
        if (end.partId === part.id && end.other.partId === uno.id && predicate(end.other.pin)) {
          return true;
        }
      }
    }
    return false;
  }

  _setPot(part) {
    const nets = this._partNets[part.id] || {};
    for (const [pin, arduinoPin] of Object.entries(nets)) {
      if ((pin === 'SIG' || pin === 'WIPER' || pin === 'OUT') && arduinoPin >= 14) {
        this.runner.setAnalogPin(arduinoPin - 14, Number(part.el.value) || 0);
      }
    }
  }

  _setSlideSwitch(part) {
    // Slide switch: COM connects to L or R based on position (el.value: 0/1)
    const nets = this._partNets[part.id] || {};
    for (const [pin, arduinoPin] of Object.entries(nets)) {
      if (arduinoPin !== undefined && arduinoPin >= 0) {
        this.runner.setInputPin(arduinoPin, !!part.el.value);
      }
    }
  }

  // ── AI circuit builder ───────────────────────────────────────────────────

  async buildCircuitFromCode() {
    const code = window.state?.editor?.getValue?.() || '';
    if (!code.trim()) {
      this._appendSerial('[circuit-ai] The editor is empty — open or write a sketch first.\n');
      return;
    }

    const btn = document.getElementById('simAiBtn');
    if (btn?.classList.contains('working')) return; // already running
    btn?.classList.add('working');
    this._appendSerial('[circuit-ai] Analyzing your sketch and building the circuit…\n');

    let result;
    try {
      result = await window.electronAPI.ai.generateCircuit(code);
    } catch (err) {
      result = { success: false, error: err.message };
    }
    btn?.classList.remove('working');

    if (!result.success) {
      this._appendSerial(`[circuit-ai] ${result.error}\n`);
      return;
    }

    const check = validateCircuit(result.circuit);
    if (!check.ok) {
      this._appendSerial('[circuit-ai] The generated circuit failed validation:\n');
      check.errors.forEach(e => this._appendSerial(`  ✗ ${e}\n`));
      this._appendSerial('[circuit-ai] Nothing was changed. Try again.\n');
      return;
    }

    this.stop();
    const count = placeCircuit(this.canvas, result.circuit);
    check.warnings.forEach(w => this._appendSerial(`[circuit-ai] ⚠ ${w}\n`));
    this._appendSerial(`[circuit-ai] Done — placed ${count} parts, fully wired. Press ▶ to simulate.\n`);

    // Nets depend on wires, which land next frame; save + fit view after that
    setTimeout(() => {
      this._rebuildNets();
      this.canvas.zoomFit();
      this._save();
    }, 150);
  }

  // Map a compiler "No such file: X.h" error to an installable library name.
  _detectMissingLibrary(errorText) {
    const m = /(\w[\w\-.]*\.h):?\s+No such file or directory/i.exec(errorText)
      || /fatal error:\s*(\w[\w\-.]*\.h)/i.exec(errorText);
    if (!m) return null;
    const header = m[1];
    // Common header → Library Manager name. Falls back to the header stem.
    const KNOWN = {
      'Servo.h': 'Servo',
      'LiquidCrystal.h': 'LiquidCrystal',
      'LiquidCrystal_I2C.h': 'LiquidCrystal I2C',
      'Adafruit_GFX.h': 'Adafruit GFX Library',
      'Adafruit_SSD1306.h': 'Adafruit SSD1306',
      'DHT.h': 'DHT sensor library',
      'FastLED.h': 'FastLED',
      'Adafruit_NeoPixel.h': 'Adafruit NeoPixel',
      'IRremote.h': 'IRremote',
      'Wire.h': null,   // bundled with the core, not installable
      'SPI.h': null,
      'SoftwareSerial.h': null,
      'EEPROM.h': null,
    };
    if (header in KNOWN) return KNOWN[header];
    return header.replace(/\.h$/i, '');
  }

  // ── Simulation control ───────────────────────────────────────────────────

  async run() {
    const sketchPath = window.state?.currentFile;
    if (!sketchPath) {
      this._appendSerial('[simulator] Save your sketch first (Ctrl+S), then press play.\n');
      return;
    }

    this._setFabState('compiling');
    this._appendSerial('[simulator] Compiling sketch…\n');

    let result;
    try {
      result = await window.electronAPI.arduino.compileHex(sketchPath, 'arduino:avr:uno');
    } catch (err) {
      this._appendSerial(`[simulator] Compile failed: ${err.message}\n`);
      this._setFabState('idle');
      return;
    }

    // If compilation failed on a missing library header, offer to install it
    // and retry automatically — the sim shouldn't dead-end on a one-click fix.
    if (!result.success) {
      const lib = this._detectMissingLibrary(result.error || '');
      if (lib) {
        this._appendSerial(`[simulator] Missing library "${lib}". Installing…\n`);
        this._setFabState('compiling');
        try {
          const inst = await window.electronAPI.lib.install(lib);
          if (inst && inst.success !== false) {
            this._appendSerial(`[simulator] Installed ${lib}. Recompiling…\n`);
            result = await window.electronAPI.arduino.compileHex(sketchPath, 'arduino:avr:uno');
          } else {
            this._appendSerial(`[simulator] Could not install ${lib}: ${inst?.error || 'unknown error'}\n`);
          }
        } catch (err) {
          this._appendSerial(`[simulator] Library install failed: ${err.message}\n`);
        }
      }
    }

    if (!result.success) {
      this._appendSerial('[simulator] Compilation error:\n');
      this._appendSerial((result.error || 'unknown error') + '\n');
      this._setFabState('idle');
      // Also surface in Problems/console
      const consoleEl = document.getElementById('consoleOutput');
      if (consoleEl) {
        const div = document.createElement('div');
        div.className = 'console-error';
        div.textContent = result.error || 'Compilation failed';
        consoleEl.appendChild(div);
      }
      document.querySelector('.output-tab[data-tab="console"]')?.click();
      return;
    }

    this._clearSerial();
    if (!this.runner.load(result.hex)) {
      this._setFabState('idle');
      return;
    }

    this._rebuildNets();
    this._attachInputHandlers();
    this._initInputLevels();

    const uno = this.canvas?.parts.find(p => p.type === 'wokwi-arduino-uno');
    if (uno) uno.el.ledPower = true;

    this.runner.start();
    this.running = true;
    this.paused = false;
    this._setFabState('running');
    this._startStats();
  }

  restart() {
    if (!this.running) return;
    this.runner.reset();
    this._resetPartVisuals();
    this._clearSerial();
    this.runner.start();
    this.paused = false;
    this._setFabState('running');
  }

  stop() {
    this.runner.stop();
    this.runner.reset();
    this.running = false;
    this.paused = false;
    this._resetPartVisuals();
    this._setFabState('idle');
    this._stopStats();
  }

  togglePause() {
    if (!this.running) return;
    if (this.paused) {
      this.runner.start();
      this.paused = false;
    } else {
      this.runner.stop();
      this.paused = true;
    }
    this._setFabState(this.paused ? 'paused' : 'running');
  }

  _initInputLevels() {
    // Buttons idle: high if wired to GND (INPUT_PULLUP convention), low otherwise
    for (const part of this.canvas?.parts || []) {
      if (part.type === 'wokwi-pushbutton' || part.type === 'wokwi-pushbutton-6mm') {
        this._setButton(part, false);
      }
      if (part.type === 'wokwi-potentiometer' || part.type === 'wokwi-slide-potentiometer') {
        this._setPot(part);
      }
    }
  }

  _resetPartVisuals() {
    for (const part of this.canvas?.parts || []) {
      switch (part.type) {
        case 'wokwi-led': part.el.value = false; break;
        case 'wokwi-rgb-led': part.el.ledRed = 0; part.el.ledGreen = 0; part.el.ledBlue = 0; break;
        case 'wokwi-buzzer': part.el.hasSignal = false; break;
        case 'wokwi-arduino-uno': part.el.led13 = false; part.el.ledPower = false; part.el.ledRX = false; part.el.ledTX = false; break;
        default: break;
      }
    }
  }

  _setFabState(state) {
    const play = document.getElementById('simPlayBtn');
    const stop = document.getElementById('simStopBtn');
    const pause = document.getElementById('simPauseBtn');
    const stats = document.getElementById('simStats');
    if (!play) return;

    if (state === 'running' || state === 'paused') {
      // Play becomes restart
      play.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
      play.title = 'Restart the simulation';
      stop.style.display = '';
      pause.style.display = '';
      pause.innerHTML = state === 'paused'
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
      pause.title = state === 'paused' ? 'Resume the simulation' : 'Pause the simulation';
      stats.style.display = 'flex';
      play.classList.remove('compiling');
    } else if (state === 'compiling') {
      play.classList.add('compiling');
    } else {
      play.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      play.title = 'Start the simulation';
      stop.style.display = 'none';
      pause.style.display = 'none';
      stats.style.display = 'none';
      play.classList.remove('compiling');
    }
  }

  _startStats() {
    this._stopStats();
    const timeLabel = document.getElementById('simTimeLabel');
    const speedLabel = document.getElementById('simSpeedLabel');
    this._statsTimer = setInterval(() => {
      if (!this.running) return;
      const t = this.runner.time;
      const mm = String(Math.floor(t / 60)).padStart(2, '0');
      const ss = String(Math.floor(t % 60)).padStart(2, '0');
      const ms = String(Math.floor((t % 1) * 1000)).padStart(3, '0');
      if (timeLabel) timeLabel.textContent = `${mm}:${ss}.${ms}`;
      if (speedLabel) speedLabel.textContent = `${Math.round(this.runner.speed * 100)}%`;
    }, 100);
  }

  _stopStats() {
    if (this._statsTimer) {
      clearInterval(this._statsTimer);
      this._statsTimer = null;
    }
  }

  // ── Serial ───────────────────────────────────────────────────────────────

  _appendSerial(text) {
    const el = document.getElementById('simSerialOut');
    if (!el) return;
    el.textContent += text;
    el.scrollTop = el.scrollHeight;

    // Blink TX LED
    const uno = this.canvas?.parts.find(p => p.type === 'wokwi-arduino-uno');
    if (uno && this.running) {
      uno.el.ledTX = true;
      clearTimeout(this._txTimer);
      this._txTimer = setTimeout(() => { uno.el.ledTX = false; }, 80);
    }
  }

  _clearSerial() {
    const el = document.getElementById('simSerialOut');
    if (el) el.textContent = '';
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  _save() {
    if (!this.canvas) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.canvas.serialize()));
    } catch (_) { /* quota */ }
  }

  _restore() {
    let data = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (_) { /* corrupted */ }

    if (data && data.parts?.length) {
      this.canvas.deserialize(data);
      setTimeout(() => this._rebuildNets(), 100);
    } else {
      this.canvas.addPart('wokwi-arduino-uno', 60, 60);
    }
  }
}
