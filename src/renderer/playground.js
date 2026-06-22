// ============================================
// Impulse IDE — Virtual Lab
// Native Three.js 3D chip + component viewer
// ============================================

import { VirtualLabRenderer } from './playground3d.js';

// ── Board catalog ──────────────────────────────────────────────────────────
const BOARDS = [
  {
    id: 'esp32',
    name: 'ESP32 Dev Module',
    wokwiType: 'wokwi-esp32-devkit-v1',
    wokwiChip: 'esp32',
    category: 'ESP',
    digitalPins: ['D0','D1','D2','D3','D4','D5','D12','D13','D14','D15','D16','D17','D18','D19','D21','D22','D23','D25','D26','D27','D32','D33'],
    analogPins: ['D32','D33','D34','D35','D36','D39'],
    i2cPins: { sda: 'D21', scl: 'D22' },
    spiPins: { mosi: 'D23', miso: 'D19', sck: 'D18', cs: 'D5' },
    pwmPins: ['D2','D4','D5','D12','D13','D14','D15','D16','D17','D18','D19','D21','D22','D23','D25','D26','D27','D32','D33'],
    gndPin: 'GND', vccPin: '3V3', v5Pin: '5V',
    color: '#e74c3c',
  },
  {
    id: 'arduino-uno',
    name: 'Arduino Uno',
    wokwiType: 'wokwi-arduino-uno',
    wokwiChip: 'arduino-uno',
    category: 'Arduino',
    digitalPins: ['D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13'],
    analogPins: ['A0','A1','A2','A3','A4','A5'],
    i2cPins: { sda: 'A4', scl: 'A5' },
    spiPins: { mosi: 'D11', miso: 'D12', sck: 'D13', cs: 'D10' },
    pwmPins: ['D3','D5','D6','D9','D10','D11'],
    gndPin: 'GND', vccPin: '5V', v5Pin: '5V',
    color: '#3498db',
  },
  {
    id: 'arduino-nano',
    name: 'Arduino Nano',
    wokwiType: 'wokwi-arduino-nano',
    wokwiChip: 'arduino-nano',
    category: 'Arduino',
    digitalPins: ['D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13'],
    analogPins: ['A0','A1','A2','A3','A4','A5','A6','A7'],
    i2cPins: { sda: 'A4', scl: 'A5' },
    spiPins: { mosi: 'D11', miso: 'D12', sck: 'D13', cs: 'D10' },
    pwmPins: ['D3','D5','D6','D9','D10','D11'],
    gndPin: 'GND', vccPin: '5V', v5Pin: '5V',
    color: '#2980b9',
  },
  {
    id: 'arduino-mega',
    name: 'Arduino Mega',
    wokwiType: 'wokwi-arduino-mega',
    wokwiChip: 'arduino-mega',
    category: 'Arduino',
    digitalPins: ['D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D22','D23','D24','D25','D26','D27','D28','D29','D30','D31','D32','D33','D34','D35','D36','D37','D38','D39','D40','D41','D42','D43','D44','D45','D46','D47','D48','D49','D50','D51','D52','D53'],
    analogPins: ['A0','A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12','A13','A14','A15'],
    i2cPins: { sda: 'D20', scl: 'D21' },
    spiPins: { mosi: 'D51', miso: 'D50', sck: 'D52', cs: 'D53' },
    pwmPins: ['D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D44','D45','D46'],
    gndPin: 'GND', vccPin: '5V', v5Pin: '5V',
    color: '#8e44ad',
  },
  {
    id: 'pi-pico',
    name: 'Raspberry Pi Pico',
    wokwiType: 'wokwi-pi-pico',
    wokwiChip: 'pi-pico',
    category: 'RP2040',
    digitalPins: ['GP0','GP1','GP2','GP3','GP4','GP5','GP6','GP7','GP8','GP9','GP10','GP11','GP12','GP13','GP14','GP15','GP16','GP17','GP18','GP19','GP20','GP21','GP22','GP26','GP27','GP28'],
    analogPins: ['GP26','GP27','GP28'],
    i2cPins: { sda: 'GP4', scl: 'GP5' },
    spiPins: { mosi: 'GP7', miso: 'GP4', sck: 'GP6', cs: 'GP5' },
    pwmPins: ['GP0','GP1','GP2','GP3','GP4','GP5','GP6','GP7','GP8','GP9','GP10','GP11','GP12','GP13','GP14','GP15','GP16','GP17','GP18','GP19','GP20','GP21','GP22'],
    gndPin: 'GND', vccPin: '3V3', v5Pin: 'VBUS',
    color: '#27ae60',
  },
  {
    id: 'esp8266',
    name: 'ESP8266 NodeMCU',
    wokwiType: 'wokwi-esp8266',
    wokwiChip: 'esp8266',
    category: 'ESP',
    digitalPins: ['D1','D2','D3','D4','D5','D6','D7','D8'],
    analogPins: ['A0'],
    i2cPins: { sda: 'D2', scl: 'D1' },
    spiPins: { mosi: 'D7', miso: 'D6', sck: 'D5', cs: 'D8' },
    pwmPins: ['D1','D2','D3','D4','D5','D6','D7','D8'],
    gndPin: 'GND', vccPin: '3V3', v5Pin: 'VIN',
    color: '#e67e22',
  },
  {
    id: 'attiny85',
    name: 'ATtiny85',
    wokwiType: 'wokwi-attiny85',
    wokwiChip: 'attiny85',
    category: 'AVR',
    digitalPins: ['PB0','PB1','PB2','PB3','PB4'],
    analogPins: ['PB2','PB3','PB4'],
    i2cPins: { sda: 'PB0', scl: 'PB2' },
    spiPins: { mosi: 'PB1', miso: 'PB0', sck: 'PB2', cs: 'PB3' },
    pwmPins: ['PB0','PB1'],
    gndPin: 'GND', vccPin: 'VCC', v5Pin: 'VCC',
    color: '#7f8c8d',
  },
];

// ── Component catalog ───────────────────────────────────────────────────────
const COMPONENTS = {
  outputs: [
    {
      id: 'led',
      name: 'LED',
      wokwiType: 'wokwi-led',
      icon: '💡',
      description: 'Single color LED',
      attrs: { color: 'red' },
      pinConfig: [{ label: 'Pin', key: 'pin', type: 'digital' }],
      buildConnections: (id, boardId, board, cfg) => {
        const rid = `r_${id}`;
        return {
          extraParts: [
            { type: 'wokwi-resistor', id: rid, attrs: { value: '220', label: '220Ω' } },
          ],
          connections: [
            [`${boardId}:${cfg.pin}`, `${rid}:1`, 'green', []],
            [`${rid}:2`, `${id}:A`, 'green', []],
            [`${id}:K`, `${boardId}:${board.gndPin}`, 'black', []],
          ],
        };
      },
    },
    {
      id: 'rgb-led',
      name: 'RGB LED',
      wokwiType: 'wokwi-rgb-led',
      icon: '🌈',
      description: 'RGB color LED',
      attrs: {},
      pinConfig: [
        { label: 'Red Pin', key: 'rPin', type: 'pwm' },
        { label: 'Green Pin', key: 'gPin', type: 'pwm' },
        { label: 'Blue Pin', key: 'bPin', type: 'pwm' },
      ],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.rPin}`, `${id}:R`, 'red', []],
          [`${boardId}:${cfg.gPin}`, `${id}:G`, 'green', []],
          [`${boardId}:${cfg.bPin}`, `${id}:B`, 'blue', []],
          [`${id}:COM`, `${boardId}:${board.gndPin}`, 'black', []],
        ],
      }),
    },
    {
      id: 'buzzer',
      name: 'Buzzer',
      wokwiType: 'wokwi-buzzer',
      icon: '🔔',
      description: 'Piezo buzzer',
      attrs: {},
      pinConfig: [{ label: 'Pin', key: 'pin', type: 'digital' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:1`, 'orange', []],
          [`${id}:2`, `${boardId}:${board.gndPin}`, 'black', []],
        ],
      }),
    },
    {
      id: 'servo',
      name: 'Servo Motor',
      wokwiType: 'wokwi-servo',
      icon: '⚙️',
      description: 'Servo motor (PWM)',
      attrs: {},
      pinConfig: [{ label: 'Signal Pin', key: 'pin', type: 'pwm' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:PWM`, 'orange', []],
          [`${boardId}:${board.vccPin}`, `${id}:V+`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:V-`, 'black', []],
        ],
      }),
    },
    {
      id: 'oled',
      name: 'OLED Display',
      wokwiType: 'wokwi-ssd1306',
      icon: '🖥️',
      description: 'SSD1306 128x64 I2C OLED',
      attrs: {},
      pinConfig: [],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${board.i2cPins.sda}`, `${id}:SDA`, 'blue', []],
          [`${boardId}:${board.i2cPins.scl}`, `${id}:SCL`, 'cyan', []],
          [`${boardId}:${board.vccPin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
    {
      id: 'lcd',
      name: 'LCD 16x2',
      wokwiType: 'wokwi-lcd1602',
      icon: '📟',
      description: '16x2 character LCD (I2C)',
      attrs: { pins: 'i2c' },
      pinConfig: [],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${board.i2cPins.sda}`, `${id}:SDA`, 'blue', []],
          [`${boardId}:${board.i2cPins.scl}`, `${id}:SCL`, 'cyan', []],
          [`${boardId}:${board.v5Pin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
    {
      id: 'neopixel',
      name: 'NeoPixel',
      wokwiType: 'wokwi-neopixel',
      icon: '✨',
      description: 'WS2812B addressable LED',
      attrs: {},
      pinConfig: [{ label: 'Data Pin', key: 'pin', type: 'digital' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:DIN`, 'green', []],
          [`${boardId}:${board.v5Pin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:VSS`, 'black', []],
        ],
      }),
    },
    {
      id: 'segment',
      name: '7-Segment Display',
      wokwiType: 'wokwi-7segment',
      icon: '🔢',
      description: '4-digit 7-segment display',
      attrs: { digits: '4' },
      pinConfig: [
        { label: 'CLK Pin', key: 'clkPin', type: 'digital' },
        { label: 'DIO Pin', key: 'dioPin', type: 'digital' },
      ],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.clkPin}`, `${id}:CLK`, 'orange', []],
          [`${boardId}:${cfg.dioPin}`, `${id}:DIO`, 'yellow', []],
          [`${boardId}:${board.v5Pin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
  ],
  inputs: [
    {
      id: 'button',
      name: 'Push Button',
      wokwiType: 'wokwi-pushbutton',
      icon: '🔘',
      description: 'Tactile push button',
      attrs: {},
      pinConfig: [{ label: 'Pin', key: 'pin', type: 'digital' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:1.l`, 'green', []],
          [`${id}:2.l`, `${boardId}:${board.gndPin}`, 'black', []],
        ],
      }),
    },
    {
      id: 'potentiometer',
      name: 'Potentiometer',
      wokwiType: 'wokwi-potentiometer',
      icon: '🎛️',
      description: 'Analog rotary potentiometer',
      attrs: {},
      pinConfig: [{ label: 'Analog Pin', key: 'pin', type: 'analog' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:SIG`, 'purple', []],
          [`${boardId}:${board.vccPin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
    {
      id: 'dht22',
      name: 'DHT22 Sensor',
      wokwiType: 'wokwi-dht22',
      icon: '🌡️',
      description: 'Temp & humidity sensor',
      attrs: {},
      pinConfig: [{ label: 'Data Pin', key: 'pin', type: 'digital' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:SDA`, 'yellow', []],
          [`${boardId}:${board.vccPin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
    {
      id: 'dht11',
      name: 'DHT11 Sensor',
      wokwiType: 'wokwi-dht11',
      icon: '🌤️',
      description: 'Basic temp & humidity sensor',
      attrs: {},
      pinConfig: [{ label: 'Data Pin', key: 'pin', type: 'digital' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:SDA`, 'yellow', []],
          [`${boardId}:${board.vccPin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
    {
      id: 'hcsr04',
      name: 'HC-SR04 Ultrasonic',
      wokwiType: 'wokwi-hc-sr04',
      icon: '📡',
      description: 'Ultrasonic distance sensor',
      attrs: {},
      pinConfig: [
        { label: 'Trig Pin', key: 'trigPin', type: 'digital' },
        { label: 'Echo Pin', key: 'echoPin', type: 'digital' },
      ],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.trigPin}`, `${id}:TRIG`, 'orange', []],
          [`${boardId}:${cfg.echoPin}`, `${id}:ECHO`, 'yellow', []],
          [`${boardId}:${board.v5Pin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
    {
      id: 'pir',
      name: 'PIR Motion Sensor',
      wokwiType: 'wokwi-pir-motion-sensor',
      icon: '👁️',
      description: 'Passive infrared motion sensor',
      attrs: {},
      pinConfig: [{ label: 'Output Pin', key: 'pin', type: 'digital' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:OUT`, 'yellow', []],
          [`${boardId}:${board.v5Pin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
    {
      id: 'photoresistor',
      name: 'Photoresistor',
      wokwiType: 'wokwi-photoresistor-sensor',
      icon: '🔆',
      description: 'Light dependent resistor (LDR)',
      attrs: {},
      pinConfig: [{ label: 'Analog Pin', key: 'pin', type: 'analog' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:AO`, 'purple', []],
          [`${boardId}:${board.vccPin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
    {
      id: 'ir-receiver',
      name: 'IR Receiver',
      wokwiType: 'wokwi-ir-receiver',
      icon: '📻',
      description: 'Infrared signal receiver (38kHz)',
      attrs: {},
      pinConfig: [{ label: 'Data Pin', key: 'pin', type: 'digital' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:OUT`, 'yellow', []],
          [`${boardId}:${board.vccPin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
    {
      id: 'relay',
      name: 'Relay Module',
      wokwiType: 'wokwi-relay-module',
      icon: '🔌',
      description: 'Single-channel relay module',
      attrs: {},
      pinConfig: [{ label: 'Control Pin', key: 'pin', type: 'digital' }],
      buildConnections: (id, boardId, board, cfg) => ({
        extraParts: [],
        connections: [
          [`${boardId}:${cfg.pin}`, `${id}:IN`, 'yellow', []],
          [`${boardId}:${board.v5Pin}`, `${id}:VCC`, 'red', []],
          [`${boardId}:${board.gndPin}`, `${id}:GND`, 'black', []],
        ],
      }),
    },
  ],
  passive: [
    {
      id: 'resistor',
      name: 'Resistor',
      wokwiType: 'wokwi-resistor',
      icon: '〰️',
      description: 'Standard resistor',
      attrs: { value: '1000' },
      pinConfig: [],
      buildConnections: () => ({ extraParts: [], connections: [] }),
    },
    {
      id: 'capacitor',
      name: 'Capacitor',
      wokwiType: 'wokwi-capacitor',
      icon: '🔋',
      description: 'Ceramic/electrolytic capacitor',
      attrs: { capacitance: '100e-6' },
      pinConfig: [],
      buildConnections: () => ({ extraParts: [], connections: [] }),
    },
  ],
};

const ALL_COMPONENTS = [
  ...COMPONENTS.outputs,
  ...COMPONENTS.inputs,
  ...COMPONENTS.passive,
];

// ── Lab state ────────────────────────────────────────────────────────────────
let labState = {
  boardId: 'esp32',
  placedComponents: [], // { uid, componentId, cfg: { pin, ... }, color }
  uidCounter: 0,
  simRunning: false,
  wokwiReady: false,
  iframeEl: null,
  drawerOpen: false,
  outputPanelExpandedForLab: false,
  renderer: null, // VirtualLabRenderer instance
};

// ── Diagram generation ───────────────────────────────────────────────────────
function generateDiagram() {
  const board = BOARDS.find(b => b.id === labState.boardId);
  if (!board) return null;

  const parts = [
    { type: board.wokwiType, id: 'board', top: 10, left: 10, attrs: {} },
  ];
  const connections = [];

  let topOffset = 20;
  const componentLeftStart = 380;
  const componentSpacing = 120;

  labState.placedComponents.forEach((placed, idx) => {
    const compDef = ALL_COMPONENTS.find(c => c.id === placed.componentId);
    if (!compDef) return;

    const compTop = topOffset + idx * componentSpacing;
    parts.push({
      type: compDef.wokwiType,
      id: placed.uid,
      top: compTop,
      left: componentLeftStart,
      attrs: { ...compDef.attrs },
    });

    const built = compDef.buildConnections(placed.uid, 'board', board, placed.cfg);

    built.extraParts.forEach((ep, epIdx) => {
      parts.push({
        ...ep,
        top: compTop + 40 + epIdx * 40,
        left: componentLeftStart + 80,
      });
    });

    built.connections.forEach(conn => connections.push(conn));
  });

  return {
    version: 1,
    author: 'Impulse IDE',
    editor: 'wokwi',
    parts,
    connections,
  };
}

// ── Editor code helpers ───────────────────────────────────────────────────────
function getEditorCode() {
  try {
    const cm = window.state?.editor;
    if (cm) return cm.getValue();
    const ta = document.getElementById('codeEditor');
    if (ta) return ta.value;
  } catch (_) {}
  return '// No code loaded\nvoid setup() {}\nvoid loop() {}';
}

function getSketchName() {
  const f = window.state?.currentFile;
  if (f) return f.split('/').pop() || 'sketch.ino';
  return 'sketch.ino';
}

// ── Wokwi iframe communication ───────────────────────────────────────────────
function sendToWokwi(msg) {
  const iframe = labState.iframeEl;
  if (!iframe || !iframe.contentWindow) return;
  try { iframe.contentWindow.postMessage(msg, 'https://wokwi.com'); } catch (_) {}
}

function loadProjectIntoWokwi() {
  const diagram = generateDiagram();
  if (!diagram) return;
  const code = getEditorCode();
  const sketchName = getSketchName();
  sendToWokwi({ type: 'load', payload: { diagram, files: { [sketchName]: code } } });
}

function handleWokwiMessage(event) {
  if (event.origin !== 'https://wokwi.com') return;
  const { type } = event.data || {};
  if (type === 'ready') {
    labState.wokwiReady = true;
    loadProjectIntoWokwi();
    updateSimControls();
    showSimulatorMode();
  } else if (type === 'simstate') {
    labState.simRunning = event.data.payload === 'start';
    updateSimControls();
  }
}

// ── Extract Wokwi project ID from a URL ──────────────────────────────────────
function extractWokwiProjectId(url) {
  const match = url.match(/wokwi\.com\/projects\/(\d+)/);
  return match ? match[1] : null;
}

// ── Switch sim area between welcome and live iframe ──────────────────────────
function showWelcomeMode() {
  const welcome = document.getElementById('vlab-welcome');
  const iframe  = document.getElementById('vlab-wokwi-iframe');
  if (welcome) welcome.style.display = 'flex';
  if (iframe)  iframe.style.display  = 'none';
  labState.wokwiReady = false;
  labState.simRunning = false;
  updateSimControls();
}

function showSimulatorMode() {
  const welcome = document.getElementById('vlab-welcome');
  const iframe  = document.getElementById('vlab-wokwi-iframe');
  if (welcome) welcome.style.display = 'none';
  if (iframe)  iframe.style.display  = 'block';
}

function embedWokwiProject(projectId) {
  const iframe = document.getElementById('vlab-wokwi-iframe');
  if (!iframe) return;
  labState.wokwiReady = false;
  labState.simRunning = false;
  updateSimControls();
  iframe.src = `https://wokwi.com/embed/${projectId}`;
  showSimulatorMode();
  // Show loading overlay on top of iframe until it loads
  const loadingOverlay = document.getElementById('vlab-embed-loading');
  if (loadingOverlay) loadingOverlay.style.display = 'flex';
  iframe.onload = () => {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    labState.wokwiReady = true;
    labState.simRunning = true; // Wokwi embed auto-runs
    updateSimControls();
    // Try to send code via postMessage
    setTimeout(() => loadProjectIntoWokwi(), 1000);
  };
}

// ── Diagram JSON export ──────────────────────────────────────────────────────
function exportDiagramJson() {
  const diagram = generateDiagram();
  const json = JSON.stringify(diagram, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'diagram.json';
  a.click();
  URL.revokeObjectURL(url);
}

function openInWokwi() {
  const board = BOARDS.find(b => b.id === labState.boardId);
  if (!board) return;
  const url = `https://wokwi.com/projects/new/${board.wokwiChip}`;
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

// ── AI Lab Setup ─────────────────────────────────────────────────────────────
async function aiSetupLab() {
  // 1. Get code from editor or disk
  let code = window.state?.editor?.getValue?.() || '';
  if (!code.trim()) {
    const filePath = window.state?.currentFile;
    if (filePath) {
      try { code = await window.electronAPI.fs.read(filePath) || ''; } catch(e) {}
    }
  }
  if (!code.trim()) {
    showToast('No code found — open a file first');
    return;
  }

  // 2. Build prompt with available component IDs and board pins
  const board = BOARDS.find(b => b.id === labState.boardId);
  const availPins = board ? board.digitalPins.concat(board.analogPins || [], board.pwmPins || []) : [];
  const uniquePins = [...new Set(availPins)];
  const compList = ALL_COMPONENTS.map(c => ({
    id: c.id,
    name: c.name,
    pins: c.pinConfig.map(p => p.key),
  }));

  const systemPrompt = `You are a hardware setup assistant for Arduino/ESP32 projects.
Given Arduino code, extract which electronic components are used and which microcontroller pins they connect to.
Return ONLY a valid JSON array (no markdown, no explanation) like:
[
  { "componentId": "led", "color": "red", "pins": { "pin": "D5" } },
  { "componentId": "led", "color": "yellow", "pins": { "pin": "D17" } }
]

Available component IDs and their pin keys:
${JSON.stringify(compList, null, 2)}

Board pins available: ${uniquePins.join(', ')}

Rules:
- Only include components actually used in the code
- Match pin numbers exactly as they appear in the code (e.g. GPIO5 → D5, pin 5 → D5)
- For LEDs, infer color from variable names (RED_LED→red, GREEN_LED→green, YELLOW_LED→yellow, BLUE_LED→blue)
- For RGB LEDs use rPin/gPin/bPin keys
- If a component has multiple pins (like DHT22 needs "pin"), include all required keys
- Return [] if no recognizable components found`;

  const aiBtn = document.getElementById('vlab-ai-setup-btn');
  if (aiBtn) { aiBtn.textContent = '⏳ Analyzing…'; aiBtn.disabled = true; }

  try {
    const aiResult = await window.electronAPI.ai.openaiChat({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Arduino code:\n\`\`\`cpp\n${code}\n\`\`\`` },
      ],
    });

    if (!aiResult.success) throw new Error(aiResult.error || 'AI request failed');

    const raw = aiResult.content?.trim() || '[]';
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
    const components = JSON.parse(jsonStr);

    if (!Array.isArray(components) || components.length === 0) {
      showToast('AI found no components in this code');
      return;
    }

    // 4. Clear existing components and add the AI-determined ones
    [...labState.placedComponents].forEach(p => removeComponent(p.uid));

    for (const item of components) {
      const compDef = ALL_COMPONENTS.find(c => c.id === item.componentId);
      if (!compDef) continue;

      const uid = `comp_${labState.uidCounter++}`;
      const cfg = { ...getDefaultPinConfig(compDef, board), ...(item.pins || {}) };

      labState.placedComponents.push({ uid, componentId: item.componentId, cfg });

      const pinName = cfg.pin || Object.values(cfg)[0] || null;
      labState.renderer?.addComponent(uid, item.componentId, pinName, cfg);

      // Apply color if provided
      if (item.color) {
        const colorMap = { red: 0xff2200, green: 0x00cc44, yellow: 0xffcc00, blue: 0x0044ff, white: 0xffffff, orange: 0xff8800 };
        const hex = colorMap[item.color.toLowerCase()] || 0xff2200;
        labState.renderer?.updateComponentColor(uid, hex);
      }
    }

    renderComponentList();
    syncDiagramIfReady();

    // 5. Auto-run the animation
    labState.renderer?.runAnimation(code);
    labState.simRunning = true;
    updateSimControls();

    showToast(`✨ AI set up ${components.length} component${components.length > 1 ? 's' : ''} and started animation`);
  } catch(e) {
    console.error('AI setup error:', e);
    showToast(`AI setup failed: ${e.message}`);
  } finally {
    if (aiBtn) { aiBtn.textContent = '✨ AI Setup'; aiBtn.disabled = false; }
  }
}

// ── Component removal ────────────────────────────────────────────────────────
function removeComponent(uid) {
  labState.renderer?.removeComponent(uid);
  labState.placedComponents = labState.placedComponents.filter(c => c.uid !== uid);
  renderComponentList();
  syncDiagramIfReady();
}

function syncDiagramIfReady() {
  if (labState.wokwiReady) loadProjectIntoWokwi();
}

// ── Default pin assignment per component on a given board ────────────────────
function getDefaultPinConfig(compDef, board) {
  const cfg = {};
  const used = new Set(labState.placedComponents.map(p => Object.values(p.cfg)).flat());

  compDef.pinConfig.forEach(pc => {
    let pool;
    if (pc.type === 'analog') pool = board.analogPins;
    else if (pc.type === 'pwm') pool = board.pwmPins;
    else pool = board.digitalPins;

    const pin = pool.find(p => !used.has(p)) || pool[0];
    cfg[pc.key] = pin;
    used.add(pin);
  });

  return cfg;
}

// ── UI rendering ─────────────────────────────────────────────────────────────
function renderBoardSelector() {
  const sel = document.getElementById('vlab-board-select');
  if (!sel) return;
  sel.innerHTML = '';
  const categories = [...new Set(BOARDS.map(b => b.category))];
  categories.forEach(cat => {
    const grp = document.createElement('optgroup');
    grp.label = cat;
    BOARDS.filter(b => b.category === cat).forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      if (b.id === labState.boardId) opt.selected = true;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
  sel.addEventListener('change', () => {
    labState.boardId = sel.value;
    labState.wokwiReady = false;
    labState.simRunning = false;
    labState.placedComponents = [];
    labState.renderer?.stopAnimation();
    labState.renderer?.loadBoard(labState.boardId);
    renderComponentList();
    renderBoardBadge();
    updateSimControls();
    updateCompCount();
  });
}

function renderBoardBadge() {
  const badge = document.getElementById('vlab-board-badge');
  if (!badge) return;
  const board = BOARDS.find(b => b.id === labState.boardId);
  if (!board) return;
  badge.textContent = board.name;
  badge.style.color = board.color;
}

function renderComponentDrawer() {
  const drawer = document.getElementById('vlab-component-drawer');
  if (!drawer) return;
  drawer.innerHTML = '';

  const sections = [
    { label: 'Outputs', items: COMPONENTS.outputs },
    { label: 'Inputs & Sensors', items: COMPONENTS.inputs },
    { label: 'Passive', items: COMPONENTS.passive },
  ];

  sections.forEach(section => {
    const header = document.createElement('div');
    header.className = 'vlab-drawer-section-header';
    header.textContent = section.label;
    drawer.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'vlab-drawer-grid';
    section.items.forEach(comp => {
      const tile = document.createElement('button');
      tile.className = 'vlab-comp-tile';
      tile.innerHTML = `
        <span class="vlab-comp-icon">${comp.icon}</span>
        <span class="vlab-comp-name">${comp.name}</span>
      `;
      tile.title = comp.description;
      tile.addEventListener('click', () => {
        addComponent(comp.id);
        closeDrawer();
      });
      grid.appendChild(tile);
    });
    drawer.appendChild(grid);
  });
}

function openDrawer() {
  labState.drawerOpen = true;
  const drawer = document.getElementById('vlab-component-drawer');
  const overlay = document.getElementById('vlab-drawer-overlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('active');
}

function closeDrawer() {
  labState.drawerOpen = false;
  const drawer = document.getElementById('vlab-component-drawer');
  const overlay = document.getElementById('vlab-drawer-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

function addComponent(componentId) {
  const compDef = ALL_COMPONENTS.find(c => c.id === componentId);
  if (!compDef) return;
  const board = BOARDS.find(b => b.id === labState.boardId);
  if (!board) return;

  const uid = `comp_${labState.uidCounter++}`;
  const cfg = getDefaultPinConfig(compDef, board);

  labState.placedComponents.push({ uid, componentId, cfg });

  // Add to 3D scene — use the first cfg value as pin name
  const pinName = cfg.pin || Object.values(cfg)[0] || null;
  labState.renderer?.addComponent(uid, componentId, pinName, cfg);

  renderComponentList();
  syncDiagramIfReady();
}

function renderComponentList() {
  const list = document.getElementById('vlab-component-list');
  if (!list) return;
  list.innerHTML = '';

  if (labState.placedComponents.length === 0) {
    list.innerHTML = '<div class="vlab-empty-list">No components added yet.<br>Click <strong>+ Component</strong> to add one.</div>';
    return;
  }

  const board = BOARDS.find(b => b.id === labState.boardId);

  labState.placedComponents.forEach(placed => {
    const compDef = ALL_COMPONENTS.find(c => c.id === placed.componentId);
    if (!compDef) return;

    const card = document.createElement('div');
    card.className = 'vlab-comp-card';

    let pinsHtml = '';
    compDef.pinConfig.forEach(pc => {
      const pool = pc.type === 'analog' ? board.analogPins
        : pc.type === 'pwm' ? board.pwmPins
        : board.digitalPins;

      const isFloating = placed.cfg[pc.key] === null || placed.cfg[pc.key] === undefined;
      const floatingOpt = `<option value="" ${isFloating ? 'selected' : ''}>— floating —</option>`;
      const opts = pool.map(p =>
        `<option value="${p}" ${!isFloating && placed.cfg[pc.key] === p ? 'selected' : ''}>${p}</option>`
      ).join('');

      pinsHtml += `
        <div class="vlab-pin-row">
          <label class="vlab-pin-label">${pc.label}</label>
          <select class="vlab-pin-select" data-uid="${placed.uid}" data-key="${pc.key}">
            ${floatingOpt}${opts}
          </select>
        </div>`;
    });

    // Color picker for LED components
    if (placed.componentId === 'led') {
      const ledColor = placed.cfg.ledColor || 'red';
      const colorOptions = [
        { value: 'red',    label: 'Red',    hex: '#ff2200' },
        { value: 'yellow', label: 'Yellow', hex: '#ffcc00' },
        { value: 'green',  label: 'Green',  hex: '#00cc44' },
        { value: 'blue',   label: 'Blue',   hex: '#0044ff' },
        { value: 'white',  label: 'White',  hex: '#ffffff' },
      ];
      const colorOpts = colorOptions.map(c =>
        `<option value="${c.value}" ${ledColor === c.value ? 'selected' : ''}>${c.label}</option>`
      ).join('');
      pinsHtml += `
        <div class="vlab-pin-row">
          <label class="vlab-pin-label">Color</label>
          <select class="vlab-pin-select vlab-led-color" data-uid="${placed.uid}" data-key="ledColor">
            ${colorOpts}
          </select>
        </div>`;
    }

    card.innerHTML = `
      <div class="vlab-comp-card-header">
        <span class="vlab-comp-card-icon">${compDef.icon}</span>
        <span class="vlab-comp-card-name">${compDef.name}</span>
        <button class="vlab-comp-remove" data-uid="${placed.uid}" title="Remove">×</button>
      </div>
      ${pinsHtml ? `<div class="vlab-pin-config">${pinsHtml}</div>` : ''}
    `;

    list.appendChild(card);
  });

  list.querySelectorAll('.vlab-comp-remove').forEach(btn => {
    btn.addEventListener('click', () => removeComponent(btn.dataset.uid));
  });

  list.querySelectorAll('.vlab-pin-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const { uid, key } = sel.dataset;
      const placed = labState.placedComponents.find(c => c.uid === uid);
      if (placed) {
        placed.cfg[key] = sel.value || null;
        if (key === 'pin') {
          if (sel.value) {
            labState.renderer?.updateComponentPin(uid, sel.value);
          } else {
            // Detach — leave floating
            const comp = labState.renderer?.components?.[uid];
            if (comp) comp.pinName = null;
          }
        }
        if (key === 'ledColor') {
          const colorMap = { red: 0xff2200, yellow: 0xffcc00, green: 0x00cc44, blue: 0x0044ff, white: 0xffffff };
          labState.renderer?.updateComponentColor(uid, colorMap[sel.value] || 0xff2200);
        }
        syncDiagramIfReady();
      }
    });
  });
}

function updateSimControls() {
  const runBtn = document.getElementById('vlab-run-btn');
  const statusDot = document.getElementById('vlab-sim-status');
  const statusText = document.getElementById('vlab-sim-status-text');

  if (runBtn) {
    if (labState.simRunning) {
      runBtn.textContent = '⏸ Pause';
      runBtn.classList.add('running');
    } else {
      runBtn.textContent = '▶ Run';
      runBtn.classList.remove('running');
    }
  }

  if (statusDot && statusText) {
    if (labState.simRunning) {
      statusDot.className = 'vlab-status-dot running';
      statusText.textContent = 'Animation running';
    } else if (labState.renderer) {
      statusDot.className = 'vlab-status-dot ready';
      statusText.textContent = '3D viewer ready';
    } else {
      statusDot.className = 'vlab-status-dot loading';
      statusText.textContent = 'Initializing…';
    }
  }
}

function refreshSimulator() {
  labState.wokwiReady = false;
  labState.simRunning = false;
  updateSimControls();
  showWelcomeMode();
  // Update the "Open in Wokwi" chip link in the welcome panel
  renderWelcomeChipInfo();
}

function renderWelcomeChipInfo() {
  const board = BOARDS.find(b => b.id === labState.boardId);
  if (!board) return;
  const chipEl = document.getElementById('vlab-welcome-chip');
  if (chipEl) {
    chipEl.textContent = board.name;
    chipEl.style.color = board.color;
  }
  const linkBtn = document.getElementById('vlab-open-wokwi-welcome');
  if (linkBtn) {
    linkBtn.dataset.chip = board.wokwiChip;
  }
}

function syncCode() {
  if (labState.wokwiReady) {
    loadProjectIntoWokwi();
    showToast('Code synced to simulator');
  } else {
    showToast('Simulator not ready yet');
  }
}

function showToast(msg) {
  let toast = document.getElementById('vlab-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'vlab-toast';
    toast.className = 'vlab-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ── Auto-expand the output panel when playground tab is active ───────────────
function autoExpandOutputPanel() {
  const panel = document.getElementById('outputPanel');
  if (!panel) return;
  const currentH = panel.offsetHeight;
  if (currentH < 500) {
    panel.style.height = '520px';
    labState.outputPanelExpandedForLab = true;
  }
}

// ── Build the playground DOM ─────────────────────────────────────────────────
function buildPlaygroundUI() {
  const container = document.getElementById('playgroundOutput');
  if (!container) return;

  container.innerHTML = `
    <div class="vlab-root">
      <!-- Toolbar -->
      <div class="vlab-toolbar">
        <div class="vlab-toolbar-left">
          <span class="vlab-title">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="15" rx="2"/>
              <path d="M16 7V5a2 2 0 00-4 0v2M8 7V5a2 2 0 00-4 0v2"/>
              <circle cx="12" cy="14" r="3" fill="currentColor" stroke="none"/>
            </svg>
            Virtual Lab
          </span>
          <span id="vlab-board-badge" class="vlab-board-badge">ESP32 Dev Module</span>
        </div>

        <div class="vlab-toolbar-center">
          <div class="vlab-status-row">
            <span id="vlab-sim-status" class="vlab-status-dot loading"></span>
            <span id="vlab-sim-status-text" class="vlab-status-text">Loading simulator…</span>
          </div>
        </div>

        <div class="vlab-toolbar-right">
          <select id="vlab-board-select" class="vlab-board-select" title="Select board"></select>
          <button id="vlab-ai-setup-btn" class="vlab-btn vlab-btn-ai" title="Let AI read your code and auto-place components on the right pins">
            ✨ AI Setup
          </button>
          <button id="vlab-add-comp-btn" class="vlab-btn vlab-btn-secondary" title="Add component">
            + Component
          </button>
          <button id="vlab-sync-btn" class="vlab-btn vlab-btn-secondary" title="Sync editor code to simulator">
            ⇄ Sync Code
          </button>
          <button id="vlab-run-btn" class="vlab-btn vlab-btn-primary" title="Run / Pause simulation">
            ▶ Run
          </button>
          <button id="vlab-export-btn" class="vlab-btn vlab-btn-ghost" title="Export diagram.json">
            ↓ Export
          </button>
          <button id="vlab-open-wokwi-btn" class="vlab-btn vlab-btn-ghost" title="Open in Wokwi browser">
            ↗ Wokwi
          </button>
        </div>
      </div>

      <!-- Body: component panel + simulator iframe -->
      <div class="vlab-body">
        <!-- Component drawer overlay -->
        <div id="vlab-drawer-overlay" class="vlab-drawer-overlay"></div>

        <!-- Component sidebar -->
        <div class="vlab-sidebar">
          <div class="vlab-sidebar-header">
            <span>Components</span>
            <span id="vlab-comp-count" class="vlab-comp-count">0</span>
          </div>
          <div id="vlab-component-list" class="vlab-component-list">
            <div class="vlab-empty-list">No components added yet.<br>Click <strong>+ Component</strong> to add one.</div>
          </div>
        </div>

        <!-- Simulator area — Three.js canvas -->
        <div class="vlab-sim-area">
          <canvas id="vlab-3d-canvas" class="vlab-3d-canvas"></canvas>
          <div class="vlab-3d-hint">Drag to rotate &nbsp;·&nbsp; Scroll to zoom &nbsp;·&nbsp; Right-drag to pan</div>
        </div>
      </div>

      <!-- Component drawer (slide-in from left) -->
      <div id="vlab-component-drawer" class="vlab-component-drawer">
        <div class="vlab-drawer-header">
          <span>Add Component</span>
          <button id="vlab-drawer-close" class="vlab-drawer-close">×</button>
        </div>
        <div class="vlab-drawer-search">
          <input type="text" id="vlab-drawer-search" class="vlab-drawer-search-input" placeholder="Search components…">
        </div>
        <div class="vlab-drawer-body" id="vlab-drawer-body"></div>
      </div>
    </div>
  `;

  // Board selector
  renderBoardSelector();
  renderBoardBadge();

  // Component drawer content
  renderComponentDrawer();

  // Wire search in drawer
  const searchInput = document.getElementById('vlab-drawer-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      document.querySelectorAll('.vlab-comp-tile').forEach(tile => {
        const name = tile.querySelector('.vlab-comp-name')?.textContent.toLowerCase() || '';
        tile.style.display = name.includes(q) ? '' : 'none';
      });
      document.querySelectorAll('.vlab-drawer-section-header').forEach(h => {
        const grid = h.nextElementSibling;
        const anyVisible = grid && [...grid.querySelectorAll('.vlab-comp-tile')].some(t => t.style.display !== 'none');
        h.style.display = anyVisible ? '' : 'none';
      });
    });
  }

  // Add component button
  document.getElementById('vlab-add-comp-btn')?.addEventListener('click', openDrawer);
  document.getElementById('vlab-drawer-close')?.addEventListener('click', closeDrawer);
  document.getElementById('vlab-drawer-overlay')?.addEventListener('click', closeDrawer);

  // Sync code (still generates diagram.json for reference)
  document.getElementById('vlab-sync-btn')?.addEventListener('click', () => {
    showToast('3D view synced — click ▶ Run to animate');
  });

  // AI auto-setup
  document.getElementById('vlab-ai-setup-btn')?.addEventListener('click', aiSetupLab);

  // Export diagram.json
  document.getElementById('vlab-export-btn')?.addEventListener('click', exportDiagramJson);

  // Open in Wokwi browser (toolbar button)
  document.getElementById('vlab-open-wokwi-btn')?.addEventListener('click', openInWokwi);

  // Run / Stop animation
  document.getElementById('vlab-run-btn')?.addEventListener('click', async () => {
    if (!labState.simRunning) {
      let editorCode = window.state?.editor?.getValue?.() || '';
      // If editor is empty, try reading the currently open file from disk
      if (!editorCode.trim()) {
        const filePath = window.state?.currentFile;
        if (filePath) {
          try {
            editorCode = await window.electronAPI.fs.read(filePath) || '';
          } catch(e) { /* ignore */ }
        }
      }
      const board      = BOARDS.find(b => b.id === labState.boardId);
      const ledPin     = board ? (board.digitalPins[1] || board.digitalPins[0] || 'D2') : 'D2';
      const pinNum     = ledPin.replace(/[^\d]/g, '') || '2';
      // Use editor code if available, otherwise run a sample blink so there's always visual output
      const code = editorCode.trim() || `
void setup() { pinMode(${pinNum}, OUTPUT); }
void loop() { digitalWrite(${pinNum}, HIGH); delay(500); digitalWrite(${pinNum}, LOW); delay(500); }
      `;
      labState.renderer?.runAnimation(code);
      labState.simRunning = true;
      updateSimControls();
      showToast(editorCode.trim() ? 'Animation running from editor code' : 'Running sample blink — open a file to animate your own code');
    } else {
      labState.renderer?.stopAnimation();
      labState.simRunning = false;
      updateSimControls();
      showToast('Animation stopped');
    }
  });

  // Update component count badge when list changes
  updateCompCount();
}

function updateCompCount() {
  const countEl = document.getElementById('vlab-comp-count');
  if (countEl) countEl.textContent = labState.placedComponents.length;
}

// Monkey-patch renderComponentList to also update count
const _origRenderComponentList = renderComponentList;
// (done inline via the count update at the end of renderComponentList)

// ── Listen for messages from Wokwi iframe ───────────────────────────────────
function attachMessageListener() {
  window.removeEventListener('message', handleWokwiMessage);
  window.addEventListener('message', handleWokwiMessage);
}

// ── Tab activation hook ──────────────────────────────────────────────────────
function hookPlaygroundTabActivation() {
  document.querySelectorAll('.output-tab[data-tab="playground"]').forEach(tab => {
    tab.addEventListener('click', () => {
      autoExpandOutputPanel();
    });
  });
}

// ── Init Three.js renderer ────────────────────────────────────────────────────
function initRenderer() {
  const canvas = document.getElementById('vlab-3d-canvas');
  if (!canvas) return;

  // Destroy previous renderer if reinitializing
  if (labState.renderer) {
    labState.renderer.destroy();
    labState.renderer = null;
  }

  labState.renderer = new VirtualLabRenderer(canvas, {
    onPinAssign(uid, newPinName) {
      // Sync UI when user drag-drops a component to a new pin
      const placed = labState.placedComponents.find(c => c.uid === uid);
      if (placed) {
        placed.cfg.pin = newPinName;
        renderComponentList();
        syncDiagramIfReady();
      }
    },
  });
  labState.renderer.loadBoard(labState.boardId);
  // Expose globally so renderer.js resize call can reach it
  window._vlabRenderer = labState.renderer;

  // Set status to ready
  const dot  = document.getElementById('vlab-sim-status');
  const text = document.getElementById('vlab-sim-status-text');
  if (dot)  { dot.className  = 'vlab-status-dot ready'; }
  if (text) { text.textContent = '3D viewer ready'; }

  // ResizeObserver watches the sim-area container, not the canvas
  const simArea = canvas.parentElement;
  if (simArea) {
    const resizeObs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 10 && height > 10) labState.renderer?.resize(width, height);
      }
    });
    resizeObs.observe(simArea);
  }
}

// ── Public init ───────────────────────────────────────────────────────────────
export function initPlayground() {
  buildPlaygroundUI();
  hookPlaygroundTabActivation();
  updateSimControls();
  initRenderer();

  // Observe component list changes to update count badge
  const observer = new MutationObserver(() => updateCompCount());
  const listEl = document.getElementById('vlab-component-list');
  if (listEl) observer.observe(listEl, { childList: true, subtree: false });
}
