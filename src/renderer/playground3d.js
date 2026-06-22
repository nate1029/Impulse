// ============================================
// Impulse IDE — Native 3D Chip Viewer v2
// Accurate models · Pin tooltips · Drag-to-wire
// ============================================

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Board definitions (1 unit = 1mm, Y = up) ──────────────────────────────
const BOARD_DEFS = {
  esp32: {
    name: 'ESP32 Dev Module',
    width: 28, length: 52, thickness: 1.6,
    pcbColor: 0x1a5c2a,
    chipW: 18, chipL: 18, chipColor: 0x888888,
    chipOffsetZ: -4,
    usbW: 8, usbL: 7, usbColor: 0x999999,
    usbOffsetZ: -27,
    builtinLedPin: 'D2',
    builtinLedColor: 0x0066ff,
    buttons: [
      { label: 'EN',   x: -6, z: -22 },
      { label: 'BOOT', x:  6, z: -22 },
    ],
    pins: {
      '3V3':  { x: -11, z:  22,   type: 'power', desc: '3.3V Power' },
      'GND':  { x: -11, z:  19.6, type: 'gnd',   desc: 'Ground' },
      'D15':  { x: -11, z:  17.2, type: 'io',    desc: 'GPIO15 / SPI SS' },
      'D2':   { x: -11, z:  14.8, type: 'io',    desc: 'GPIO2 / Built-in LED' },
      'D4':   { x: -11, z:  12.4, type: 'io',    desc: 'GPIO4' },
      'D16':  { x: -11, z:  10,   type: 'io',    desc: 'GPIO16 / UART2 RX' },
      'D17':  { x: -11, z:   7.6, type: 'io',    desc: 'GPIO17 / UART2 TX' },
      'D5':   { x: -11, z:   5.2, type: 'io',    desc: 'GPIO5 / SPI SCK' },
      'D18':  { x: -11, z:   2.8, type: 'io',    desc: 'GPIO18 / SPI SCK' },
      'D19':  { x: -11, z:   0.4, type: 'io',    desc: 'GPIO19 / SPI MISO' },
      'D21':  { x: -11, z:  -2,   type: 'io',    desc: 'GPIO21 / I2C SDA' },
      'D3':   { x: -11, z:  -4.4, type: 'io',    desc: 'GPIO3 / UART RX' },
      'D1':   { x: -11, z:  -6.8, type: 'io',    desc: 'GPIO1 / UART TX' },
      'D22':  { x: -11, z:  -9.2, type: 'io',    desc: 'GPIO22 / I2C SCL' },
      'D23':  { x: -11, z: -11.6, type: 'io',    desc: 'GPIO23 / SPI MOSI' },
      'VIN':  { x:  11, z:  22,   type: 'power', desc: 'VIN 5V Input' },
      'GND2': { x:  11, z:  19.6, type: 'gnd',   desc: 'Ground' },
      'D13':  { x:  11, z:  17.2, type: 'io',    desc: 'GPIO13 / SPI SCK' },
      'D12':  { x:  11, z:  14.8, type: 'io',    desc: 'GPIO12 / SPI MISO' },
      'D14':  { x:  11, z:  12.4, type: 'io',    desc: 'GPIO14 / SPI SCK' },
      'D27':  { x:  11, z:  10,   type: 'io',    desc: 'GPIO27' },
      'D26':  { x:  11, z:   7.6, type: 'io',    desc: 'GPIO26 / DAC2' },
      'D25':  { x:  11, z:   5.2, type: 'io',    desc: 'GPIO25 / DAC1' },
      'D33':  { x:  11, z:   2.8, type: 'io',    desc: 'GPIO33 / ADC1_5' },
      'D32':  { x:  11, z:   0.4, type: 'io',    desc: 'GPIO32 / ADC1_4' },
      'D35':  { x:  11, z:  -2,   type: 'io',    desc: 'GPIO35 / ADC1_7 (input only)' },
      'D34':  { x:  11, z:  -4.4, type: 'io',    desc: 'GPIO34 / ADC1_6 (input only)' },
      'VN':   { x:  11, z:  -6.8, type: 'analog',desc: 'VP/ADC0 (input only)' },
      'VP':   { x:  11, z:  -9.2, type: 'analog',desc: 'VN/ADC0 (input only)' },
      'EN':   { x:  11, z: -11.6, type: 'ctrl',  desc: 'CHIP_EN — Active High' },
    },
  },

  'arduino-uno': {
    name: 'Arduino Uno',
    width: 53, length: 68, thickness: 1.6,
    pcbColor: 0x1a3d8a,
    chipW: 14, chipL: 14, chipColor: 0x1a1a1a,
    chipOffsetZ: 4,
    usbW: 12, usbL: 16, usbColor: 0x888888,
    usbOffsetZ: -35,
    builtinLedPin: 'D13',
    builtinLedColor: 0xffaa00,
    buttons: [{ label: 'RST', x: -20, z: -28 }],
    pins: {
      'D0':  { x: -22,  z: 27,  type: 'io',    desc: 'Digital 0 / UART RX' },
      'D1':  { x: -19,  z: 27,  type: 'io',    desc: 'Digital 1 / UART TX' },
      'D2':  { x: -16,  z: 27,  type: 'io',    desc: 'Digital 2 / INT0' },
      'D3':  { x: -13,  z: 27,  type: 'io',    desc: 'Digital 3 / PWM / INT1' },
      'D4':  { x: -10,  z: 27,  type: 'io',    desc: 'Digital 4' },
      'D5':  { x:  -7,  z: 27,  type: 'io',    desc: 'Digital 5 / PWM' },
      'D6':  { x:  -4,  z: 27,  type: 'io',    desc: 'Digital 6 / PWM' },
      'D7':  { x:  -1,  z: 27,  type: 'io',    desc: 'Digital 7' },
      'D8':  { x:   2,  z: 27,  type: 'io',    desc: 'Digital 8' },
      'D9':  { x:   5,  z: 27,  type: 'io',    desc: 'Digital 9 / PWM' },
      'D10': { x:   8,  z: 27,  type: 'io',    desc: 'Digital 10 / PWM / SPI SS' },
      'D11': { x:  11,  z: 27,  type: 'io',    desc: 'Digital 11 / PWM / SPI MOSI' },
      'D12': { x:  14,  z: 27,  type: 'io',    desc: 'Digital 12 / SPI MISO' },
      'D13': { x:  17,  z: 27,  type: 'io',    desc: 'Digital 13 / SPI SCK / LED' },
      'A0':  { x: -10,  z: -27, type: 'analog',desc: 'Analog 0' },
      'A1':  { x:  -7,  z: -27, type: 'analog',desc: 'Analog 1' },
      'A2':  { x:  -4,  z: -27, type: 'analog',desc: 'Analog 2' },
      'A3':  { x:  -1,  z: -27, type: 'analog',desc: 'Analog 3' },
      'A4':  { x:   2,  z: -27, type: 'analog',desc: 'Analog 4 / I2C SDA' },
      'A5':  { x:   5,  z: -27, type: 'analog',desc: 'Analog 5 / I2C SCL' },
      'GND':  { x:  14, z: -27, type: 'gnd',   desc: 'Ground' },
      '5V':   { x:  17, z: -27, type: 'power', desc: '5V Power' },
      '3V3':  { x:  20, z: -27, type: 'power', desc: '3.3V Power' },
    },
  },

  'arduino-nano': {
    name: 'Arduino Nano',
    width: 18, length: 45, thickness: 1.6,
    pcbColor: 0x1a3d8a,
    chipW: 8, chipL: 8, chipColor: 0x1a1a1a,
    chipOffsetZ: 0,
    usbW: 7, usbL: 5, usbColor: 0x888888,
    usbOffsetZ: -24,
    builtinLedPin: 'D13',
    builtinLedColor: 0xffaa00,
    buttons: [{ label: 'RST', x: 0, z: 20 }],
    pins: {
      'D2':  { x: -7, z:  18, type: 'io',    desc: 'Digital 2 / INT0' },
      'D3':  { x: -7, z:  15, type: 'io',    desc: 'Digital 3 / INT1 / PWM' },
      'D4':  { x: -7, z:  12, type: 'io',    desc: 'Digital 4' },
      'D5':  { x: -7, z:   9, type: 'io',    desc: 'Digital 5 / PWM' },
      'D6':  { x: -7, z:   6, type: 'io',    desc: 'Digital 6 / PWM' },
      'D7':  { x: -7, z:   3, type: 'io',    desc: 'Digital 7' },
      'D8':  { x: -7, z:   0, type: 'io',    desc: 'Digital 8' },
      'D9':  { x: -7, z:  -3, type: 'io',    desc: 'Digital 9 / PWM' },
      'D10': { x: -7, z:  -6, type: 'io',    desc: 'Digital 10 / PWM / SS' },
      'D11': { x: -7, z:  -9, type: 'io',    desc: 'Digital 11 / MOSI' },
      'D12': { x: -7, z: -12, type: 'io',    desc: 'Digital 12 / MISO' },
      'D13': { x: -7, z: -15, type: 'io',    desc: 'Digital 13 / SCK / LED' },
      'A0':  { x:  7, z:  18, type: 'analog',desc: 'Analog 0' },
      'A1':  { x:  7, z:  15, type: 'analog',desc: 'Analog 1' },
      'A2':  { x:  7, z:  12, type: 'analog',desc: 'Analog 2' },
      'A3':  { x:  7, z:   9, type: 'analog',desc: 'Analog 3' },
      'A4':  { x:  7, z:   6, type: 'analog',desc: 'Analog 4 / SDA' },
      'A5':  { x:  7, z:   3, type: 'analog',desc: 'Analog 5 / SCL' },
      'A6':  { x:  7, z:   0, type: 'analog',desc: 'Analog 6' },
      'A7':  { x:  7, z:  -3, type: 'analog',desc: 'Analog 7' },
      '5V':  { x:  7, z:  -6, type: 'power', desc: '5V Power' },
      'GND': { x:  7, z:  -9, type: 'gnd',   desc: 'Ground' },
    },
  },

  'pi-pico': {
    name: 'Raspberry Pi Pico',
    width: 21, length: 51, thickness: 1.0,
    pcbColor: 0x2f6b3e,
    chipW: 7, chipL: 7, chipColor: 0x333333,
    chipOffsetZ: 2,
    usbW: 8, usbL: 4, usbColor: 0xaaaaaa,
    usbOffsetZ: -27,
    builtinLedPin: 'GP25',
    builtinLedColor: 0x00ff00,
    buttons: [{ label: 'BOOTSEL', x: 6, z: 10 }],
    pins: {
      'GP0':  { x: -8, z:  22, type: 'io',   desc: 'GP0 / UART0 TX / SPI0 RX / I2C0 SDA' },
      'GP1':  { x:  8, z:  22, type: 'io',   desc: 'GP1 / UART0 RX / SPI0 CSn / I2C0 SCL' },
      'GP2':  { x: -8, z:  19, type: 'io',   desc: 'GP2 / SPI0 SCK / I2C1 SDA' },
      'GP3':  { x:  8, z:  19, type: 'io',   desc: 'GP3 / SPI0 TX / I2C1 SCL' },
      'GP4':  { x: -8, z:  16, type: 'io',   desc: 'GP4 / UART1 TX / I2C0 SDA' },
      'GP5':  { x:  8, z:  16, type: 'io',   desc: 'GP5 / UART1 RX / I2C0 SCL' },
      'GP6':  { x: -8, z:  13, type: 'io',   desc: 'GP6 / I2C1 SDA' },
      'GP7':  { x:  8, z:  13, type: 'io',   desc: 'GP7 / I2C1 SCL' },
      'GP8':  { x: -8, z:  10, type: 'io',   desc: 'GP8 / UART1 TX' },
      'GP9':  { x:  8, z:  10, type: 'io',   desc: 'GP9 / UART1 RX' },
      'GP10': { x: -8, z:   7, type: 'io',   desc: 'GP10 / SPI1 SCK' },
      'GP11': { x:  8, z:   7, type: 'io',   desc: 'GP11 / SPI1 TX' },
      'GP12': { x: -8, z:   4, type: 'io',   desc: 'GP12 / SPI1 RX' },
      'GP13': { x:  8, z:   4, type: 'io',   desc: 'GP13 / SPI1 CSn' },
      'GP14': { x: -8, z:   1, type: 'io',   desc: 'GP14 / SPI1 SCK' },
      'GP15': { x:  8, z:   1, type: 'io',   desc: 'GP15 / SPI1 TX' },
      'GP16': { x: -8, z:  -2, type: 'io',   desc: 'GP16 / SPI0 RX' },
      'GP17': { x:  8, z:  -2, type: 'io',   desc: 'GP17 / SPI0 CSn' },
      'GP18': { x: -8, z:  -5, type: 'io',   desc: 'GP18 / SPI0 SCK' },
      'GP19': { x:  8, z:  -5, type: 'io',   desc: 'GP19 / SPI0 TX' },
      'GP20': { x: -8, z:  -8, type: 'io',   desc: 'GP20 / I2C0 SDA' },
      'GP21': { x:  8, z:  -8, type: 'io',   desc: 'GP21 / I2C0 SCL' },
      'GP22': { x: -8, z: -11, type: 'io',   desc: 'GP22' },
      'GND':  { x:  8, z: -11, type: 'gnd',  desc: 'Ground' },
      'GP26': { x: -8, z: -14, type: 'io',   desc: 'GP26 / ADC0' },
      'GP27': { x:  8, z: -14, type: 'io',   desc: 'GP27 / ADC1' },
      'GP28': { x: -8, z: -17, type: 'io',   desc: 'GP28 / ADC2' },
      '3V3':  { x:  8, z: -17, type: 'power',desc: '3.3V Output' },
      'GP25': { x:  0, z:   0, type: 'io',   desc: 'GP25 / Built-in LED' },
    },
  },

  esp8266: {
    name: 'ESP8266 NodeMCU',
    width: 26, length: 48, thickness: 1.6,
    pcbColor: 0x1a5c2a,
    chipW: 18, chipL: 12, chipColor: 0x888888,
    chipOffsetZ: 2,
    usbW: 8, usbL: 6, usbColor: 0x888888,
    usbOffsetZ: -25,
    builtinLedPin: 'D4',
    builtinLedColor: 0x0044ff,
    buttons: [{ label: 'RST', x: -8, z: -20 }, { label: 'FLASH', x: 8, z: -20 }],
    pins: {
      'D0':  { x: -10, z:  20, type: 'io',    desc: 'GPIO16 / WAKE' },
      'D1':  { x: -10, z:  17, type: 'io',    desc: 'GPIO5 / I2C SCL' },
      'D2':  { x: -10, z:  14, type: 'io',    desc: 'GPIO4 / I2C SDA' },
      'D3':  { x: -10, z:  11, type: 'io',    desc: 'GPIO0 / Flash' },
      'D4':  { x: -10, z:   8, type: 'io',    desc: 'GPIO2 / Built-in LED' },
      'D5':  { x: -10, z:   5, type: 'io',    desc: 'GPIO14 / SPI SCK' },
      'D6':  { x: -10, z:   2, type: 'io',    desc: 'GPIO12 / SPI MISO' },
      'D7':  { x: -10, z:  -1, type: 'io',    desc: 'GPIO13 / SPI MOSI' },
      'D8':  { x: -10, z:  -4, type: 'io',    desc: 'GPIO15 / SPI SS' },
      'RX':  { x: -10, z:  -7, type: 'io',    desc: 'GPIO3 / UART RX' },
      'TX':  { x: -10, z: -10, type: 'io',    desc: 'GPIO1 / UART TX' },
      'A0':  { x:  10, z:  20, type: 'analog',desc: 'Analog 0 (0–1V)' },
      '3V3': { x:  10, z:  17, type: 'power', desc: '3.3V Power' },
      'GND': { x:  10, z:  14, type: 'gnd',   desc: 'Ground' },
      '5V':  { x:  10, z:  11, type: 'power', desc: '5V (Vin)' },
    },
  },
};

// ── Component visual templates ─────────────────────────────────────────────
const COMPONENT_VIS = {
  led:          { h: 5,  r: 1.5, defaultColor: 0xff2200 },
  'rgb-led':    { h: 5,  r: 1.5, defaultColor: 0xffffff },
  buzzer:       { h: 8,  r: 5,   defaultColor: 0x111111 },
  servo:        { h: 10, w: 12,  l: 22, defaultColor: 0x334455 },
  oled:         { h: 2,  w: 27,  l: 18, defaultColor: 0x111111, screenColor: 0x000055 },
  lcd:          { h: 2,  w: 40,  l: 22, defaultColor: 0x3e7a3e, screenColor: 0x5a8a2a },
  dht22:        { h: 14, w: 9,   l: 16, defaultColor: 0xeeeeee },
  dht11:        { h: 14, w: 9,   l: 16, defaultColor: 0x3a6cd4 },
  button:       { h: 5,  w: 6,   l: 6,  defaultColor: 0x222222 },
  potentiometer:{ h: 8,  r: 5,   defaultColor: 0x222222 },
  neopixel:     { h: 3,  r: 2.5, defaultColor: 0x111111 },
  hcsr04:       { h: 10, w: 45,  l: 15, defaultColor: 0x2244aa },
  pir:          { h: 16, r: 9,   defaultColor: 0xffffff },
  photoresistor:{ h: 8,  r: 2,   defaultColor: 0xaaaaaa },
  'ir-receiver':{ h: 8,  r: 4,   defaultColor: 0x111111 },
  relay:        { h: 12, w: 18,  l: 35, defaultColor: 0x2244aa },
  resistor:     { h: 4,  r: 1.5, defaultColor: 0xddbb66 },
  capacitor:    { h: 10, r: 2.5, defaultColor: 0x334499 },
  segment:      { h: 4,  w: 24,  l: 14, defaultColor: 0x111111 },
};

// ── Texture helpers ──────────────────────────────────────────────────────────
function makeTextSprite(text, { fontSize = 28, bg = 'rgba(10,15,30,0.88)', fg = '#e8f4ff', border = '#3a8fd6', padding = 10 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px monospace`;
  const tw = ctx.measureText(text).width;
  canvas.width  = tw + padding * 2 + 4;
  canvas.height = fontSize + padding * 2;

  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  const r = 6;
  const [cw, ch] = [canvas.width, canvas.height];
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(cw - r, 0); ctx.quadraticCurveTo(cw, 0, cw, r);
  ctx.lineTo(cw, ch - r); ctx.quadraticCurveTo(cw, ch, cw - r, ch);
  ctx.lineTo(r, ch); ctx.quadraticCurveTo(0, ch, 0, ch - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = fg;
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.fillText(text, padding + 2, fontSize + padding / 2);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(canvas.width / 6, canvas.height / 6, 1);
  return sprite;
}

// ── Code parser ───────────────────────────────────────────────────────────────
export function parseArduinoCode(code) {
  const vars = {};
  const defineRe  = /#define\s+(\w+)\s+(\d+)/g;
  const constRe   = /(?:const\s+)?int\s+(\w+)\s*=\s*(\d+)/g;
  let m;
  while ((m = defineRe.exec(code)) !== null) vars[m[1]] = parseInt(m[2]);
  while ((m = constRe.exec(code))  !== null) vars[m[1]] = parseInt(m[2]);

  function resolvePin(raw) {
    raw = raw.trim();
    if (vars[raw] !== undefined) return vars[raw];
    const n = parseInt(raw);
    return isNaN(n) ? null : n;
  }

  const loopMatch = /void\s+loop\s*\(\s*\)\s*\{([\s\S]*)/i.exec(code);
  if (!loopMatch) return { events: [], pinModes: {} };
  let depth = 1, i = 0, body = '';
  const src = loopMatch[1];
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
    body += src[i++];
  }

  const pinModes = {};
  const setupMatch = /void\s+setup\s*\(\s*\)\s*\{([\s\S]*?)\}/i.exec(code);
  if (setupMatch) {
    const pmRe = /pinMode\s*\(\s*(\w+)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)/g;
    while ((m = pmRe.exec(setupMatch[1])) !== null) {
      const pin = resolvePin(m[1]);
      if (pin !== null) pinModes[pin] = m[2];
    }
  }

  const events = [];
  const stmtRe = /(\w[\w.]*)\s*\(([^)]*)\)/g;
  while ((m = stmtRe.exec(body)) !== null) {
    const fn   = m[1];
    const args = m[2].split(',').map(s => s.trim());
    if (fn === 'digitalWrite') {
      const pin = resolvePin(args[0]);
      if (pin !== null) events.push({ type: 'digitalWrite', pin, value: args[1] === 'HIGH' ? 1 : 0 });
    } else if (fn === 'analogWrite') {
      const pin = resolvePin(args[0]);
      const val = parseInt(args[1]);
      if (pin !== null && !isNaN(val)) events.push({ type: 'analogWrite', pin, value: val });
    } else if (fn === 'delay') {
      const ms = parseInt(args[0]);
      if (!isNaN(ms)) events.push({ type: 'delay', ms });
    } else if (fn === 'tone') {
      const pin = resolvePin(args[0]);
      if (pin !== null) events.push({ type: 'tone', pin, freq: parseInt(args[1]) || 0 });
    } else if (fn === 'noTone') {
      const pin = resolvePin(args[0]);
      if (pin !== null) events.push({ type: 'noTone', pin });
    }
  }

  return { events, pinModes };
}

function buildTimeline(events) {
  const timeline = [];
  let t = 0;
  events.forEach(ev => {
    if (ev.type === 'delay') { t += ev.ms; }
    else if (ev.type === 'digitalWrite') { timeline.push({ t, pin: ev.pin, value: ev.value, type: 'digital' }); }
    else if (ev.type === 'analogWrite')  { timeline.push({ t, pin: ev.pin, value: ev.value / 255, type: 'pwm' }); }
    else if (ev.type === 'tone')   { timeline.push({ t, pin: ev.pin, value: 1, type: 'digital' }); }
    else if (ev.type === 'noTone') { timeline.push({ t, pin: ev.pin, value: 0, type: 'digital' }); }
  });
  return { timeline, duration: t };
}

// ── Main 3D renderer class ────────────────────────────────────────────────────
export class VirtualLabRenderer {
  constructor(canvas, { onPinAssign } = {}) {
    this.canvas      = canvas;
    this.onPinAssign = onPinAssign || null; // callback(uid, newPinName)

    this.animTimers  = [];
    this.running     = false;
    this.animFrameId = null;
    this.pinMap      = {};   // { pinName: { mesh, light, mat } }
    this.components  = {};   // { uid: { group, pinName, type, mesh, mat, light } }
    this.pinMeshes   = [];   // [{mesh, name, desc}] for raycasting
    this.currentBoard = null;
    this.boardGroup   = null;

    // Drag state
    this._drag = null;       // { uid, group, startPos, planeY }
    this._snapTarget = null; // { pinName, snapMesh }

    // Tooltip overlay
    this._tooltip = this._createTooltip();

    this._initScene();
    this._initLights();
    this._initInteraction();
    this._startRenderLoop();
  }

  _createTooltip() {
    const div = document.createElement('div');
    div.style.cssText = `
      position:fixed; pointer-events:none; display:none; z-index:9999;
      background:rgba(10,15,30,0.92); color:#e8f4ff; border:1.5px solid #3a8fd6;
      border-radius:6px; padding:5px 10px; font:bold 12px monospace;
      white-space:nowrap; box-shadow:0 2px 12px rgba(0,100,255,0.3);
    `;
    document.body.appendChild(div);
    return div;
  }

  _initScene() {
    const w = this.canvas.clientWidth  || 800;
    const h = this.canvas.clientHeight || 500;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.scene.fog = new THREE.Fog(0x0d1117, 200, 400);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    this.camera.position.set(40, 50, 70);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance   = 15;
    this.controls.maxDistance   = 250;
    this.controls.maxPolarAngle = Math.PI / 2;

    const grid = new THREE.GridHelper(300, 60, 0x1a2030, 0x1a2030);
    grid.position.y = -2;
    this.scene.add(grid);

    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();
  }

  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(50, 100, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.width  = 2048;
    sun.shadow.mapSize.height = 2048;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8899ff, 0.3);
    fill.position.set(-50, 30, -40);
    this.scene.add(fill);
  }

  _initInteraction() {
    const el = this.canvas;

    el.addEventListener('mousemove', e => this._onMouseMove(e));
    el.addEventListener('mousedown', e => this._onMouseDown(e));
    el.addEventListener('mouseup',   e => this._onMouseUp(e));
    el.addEventListener('mouseleave', () => {
      this._tooltip.style.display = 'none';
      if (this._drag) this._cancelDrag();
    });
  }

  _getNDC(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      cx: e.clientX, cy: e.clientY,
    };
  }

  _onMouseMove(e) {
    const { x, y, cx, cy } = this._getNDC(e);
    this._mouse.set(x, y);

    if (this._drag) {
      this._doDrag(x, y);
      return;
    }

    // Raycast for pin hover tooltip
    this._raycaster.setFromCamera(this._mouse, this.camera);
    const pinMeshList = this.pinMeshes.map(p => p.mesh);
    const compMeshes  = Object.values(this.components).map(c => c.mesh).filter(Boolean);
    const allHit = this._raycaster.intersectObjects([...pinMeshList, ...compMeshes], true);

    if (allHit.length > 0) {
      const hit = allHit[0].object;
      const ud  = hit.userData;
      let label = '';

      if (ud.pinName) {
        const desc = ud.pinDesc ? ` — ${ud.pinDesc}` : '';
        label = `${ud.pinName}${desc}`;
      } else if (ud.compUid) {
        const comp = this.components[ud.compUid];
        if (comp) label = `${comp.type.toUpperCase()} → ${comp.pinName || 'unconnected'}`;
      }

      if (label) {
        this._tooltip.textContent = label;
        this._tooltip.style.display = 'block';
        this._tooltip.style.left = (cx + 14) + 'px';
        this._tooltip.style.top  = (cy - 10) + 'px';
        return;
      }
    }
    this._tooltip.style.display = 'none';
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    const { x, y } = this._getNDC(e);
    this._raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    const compMeshes = [];
    Object.entries(this.components).forEach(([uid, comp]) => {
      comp.group.traverse(obj => {
        if (obj.isMesh) {
          obj.userData.compUid = uid;
          compMeshes.push(obj);
        }
      });
    });

    const hits = this._raycaster.intersectObjects(compMeshes, false);
    if (!hits.length) return;

    const uid  = hits[0].object.userData.compUid;
    const comp = this.components[uid];
    if (!comp) return;

    // Start drag — disable orbit controls
    this.controls.enabled = false;
    const def = BOARD_DEFS[this.currentBoard];
    const planeY = def ? def.thickness / 2 + 6 : 6;
    this._drag = { uid, group: comp.group, planeY };

    // Show snap ring at all pins
    this._showSnapRings();
  }

  _doDrag(nx, ny) {
    if (!this._drag) return;
    const def = BOARD_DEFS[this.currentBoard];
    if (!def) return;

    // Project mouse onto horizontal plane at board surface
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this._drag.planeY);
    this._raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const point = new THREE.Vector3();
    this._raycaster.ray.intersectPlane(plane, point);
    if (!point) return;

    // Find nearest pin
    let nearest = null, nearDist = Infinity, nearPin = null;
    Object.entries(def.pins).forEach(([name, pin]) => {
      const dx = pin.x - point.x;
      const dz = pin.z - point.z;
      const d  = Math.sqrt(dx * dx + dz * dz);
      if (d < nearDist) { nearDist = d; nearest = name; nearPin = pin; }
    });

    const SNAP_RADIUS = 12; // mm — generous so it's easy to feel
    const willSnap = nearDist < SNAP_RADIUS;

    if (willSnap && nearPin) {
      // Preview-snap: show component hovering exactly over target pin
      this._drag.group.position.set(nearPin.x, this._drag.planeY, nearPin.z);
    } else {
      this._drag.group.position.set(point.x, this._drag.planeY, point.z);
    }

    this._updateSnapHighlight(nearest, willSnap ? nearest : null, def);
    this._drag.snapTarget = willSnap ? nearest : null;
  }

  _onMouseUp(e) {
    if (!this._drag) return;
    const { uid, snapTarget } = this._drag;
    this.controls.enabled = true;

    if (snapTarget) {
      this.updateComponentPin(uid, snapTarget);
      if (this.onPinAssign) this.onPinAssign(uid, snapTarget);
    } else {
      // Leave floating — detach from pin
      const comp = this.components[uid];
      if (comp) comp.pinName = null;
      if (this.onPinAssign) this.onPinAssign(uid, null);
    }

    this._hideSnapRings();
    this._drag = null;
  }

  _cancelDrag() {
    if (!this._drag) return;
    const { uid } = this._drag;
    const comp = this.components[uid];
    if (comp && comp.pinName) this.updateComponentPin(uid, comp.pinName);
    this._hideSnapRings();
    this.controls.enabled = true;
    this._drag = null;
  }

  _showSnapRings() {
    if (this._snapRings) this._hideSnapRings();
    this._snapRings = [];
    const def = BOARD_DEFS[this.currentBoard];
    if (!def) return;

    Object.entries(def.pins).forEach(([name, pin]) => {
      // Simple thin ring per pin — barely visible at rest
      const geo = new THREE.RingGeometry(1.0, 1.5, 20);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x2255aa, side: THREE.DoubleSide, transparent: true, opacity: 0.25,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pin.x, def.thickness / 2 + 0.15, pin.z);
      ring.userData.forPin = name;
      ring.userData.mat    = mat;
      this.boardGroup.add(ring);
      this._snapRings.push(ring);
    });

    this._snapLabel    = null;
    this._snapLabelPin = null;
  }

  _updateSnapHighlight(nearest, active, def) {
    if (!this._snapRings) return;

    this._snapRings.forEach(ring => {
      const isActive = ring.userData.forPin === active;
      const mat = ring.userData.mat;
      if (isActive) {
        mat.color.setHex(0x00dd66);
        mat.opacity = 0.9;
        ring.scale.set(1.3, 1, 1.3);
      } else {
        mat.color.setHex(0x2255aa);
        mat.opacity = 0.22;
        ring.scale.set(1, 1, 1);
      }
    });

    // Compact pin-name label above active pin (just the name, no description)
    if (active && this._snapLabelPin !== active) {
      if (this._snapLabel) {
        this.boardGroup.remove(this._snapLabel);
        this._snapLabel.material.map?.dispose();
        this._snapLabel.material.dispose();
        this._snapLabel = null;
      }
      const pinDef = def?.pins[active];
      const sprite = makeTextSprite(active, {
        fontSize: 18, bg: 'rgba(0,18,8,0.82)', fg: '#00ee77', border: '#00aa44', padding: 6,
      });
      const activeRing = this._snapRings.find(r => r.userData.forPin === active);
      if (activeRing) {
        sprite.position.set(
          activeRing.position.x,
          (def ? def.thickness / 2 : 0) + 22,
          activeRing.position.z,
        );
      }
      this.boardGroup.add(sprite);
      this._snapLabel    = sprite;
      this._snapLabelPin = active;
    }

    if (!active && this._snapLabel) {
      this.boardGroup.remove(this._snapLabel);
      this._snapLabel.material.map?.dispose();
      this._snapLabel.material.dispose();
      this._snapLabel    = null;
      this._snapLabelPin = null;
    }
  }

  _hideSnapRings() {
    if (this._snapLabel) {
      this.boardGroup?.remove(this._snapLabel);
      this._snapLabel.material.map?.dispose();
      this._snapLabel.material.dispose();
      this._snapLabel    = null;
      this._snapLabelPin = null;
    }
    if (!this._snapRings) return;
    this._snapRings.forEach(g => {
      this.boardGroup?.remove(g);
      g.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    });
    this._snapRings = null;
  }

  _startRenderLoop() {
    const tick = () => {
      this.animFrameId = requestAnimationFrame(tick);
      this.controls.update();

      // Animate snap ring pulse every frame while dragging
      if (this._drag && this._drag.snapTarget && this._snapRings) {
        const def = BOARD_DEFS[this.currentBoard];
        this._updateSnapHighlight(this._drag.snapTarget, this._drag.snapTarget, def);
      }

      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  resize(w, h) {
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.controls.update();
  }

  // ── Board loading ──────────────────────────────────────────────────────────
  loadBoard(boardId) {
    if (this.boardGroup) {
      this.scene.remove(this.boardGroup);
      this.boardGroup.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    this.pinMap       = {};
    this.components   = {};
    this.pinMeshes    = [];
    this.currentBoard = boardId;

    const def = BOARD_DEFS[boardId];
    if (!def) return;

    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this._buildBoard(def);
    this._resetCamera(def);
  }

  _buildBoard(def) {
    const g = this.boardGroup;
    const y0 = def.thickness / 2;

    // ── PCB base ──
    const pcbMat = new THREE.MeshStandardMaterial({ color: def.pcbColor, roughness: 0.8, metalness: 0.05 });
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(def.width, def.thickness, def.length), pcbMat);
    pcb.receiveShadow = true;
    g.add(pcb);

    // ── Solder mask layer (slight sheen) ──
    const maskMat = new THREE.MeshStandardMaterial({ color: def.pcbColor, roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.55 });
    const mask = new THREE.Mesh(new THREE.PlaneGeometry(def.width - 0.5, def.length - 0.5), maskMat);
    mask.rotation.x = -Math.PI / 2;
    mask.position.y = y0 + 0.02;
    g.add(mask);

    // ── Copper trace layer ──
    const traceMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.3, metalness: 0.7, transparent: true, opacity: 0.15 });
    const trace = new THREE.Mesh(new THREE.PlaneGeometry(def.width - 2, def.length - 2), traceMat);
    trace.rotation.x = -Math.PI / 2;
    trace.position.y = y0 + 0.03;
    g.add(trace);

    // ── Mounting holes (4 corners) ──
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x0a0f0a, roughness: 0.5 });
    const holeR = 1.5;
    const hx = def.width / 2 - 3, hz = def.length / 2 - 3;
    [[-hx,-hz],[-hx,hz],[hx,-hz],[hx,hz]].forEach(([cx,cz]) => {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(holeR, holeR, def.thickness + 0.1, 16), holeMat);
      h.position.set(cx, 0, cz);
      g.add(h);
      // Copper ring around hole
      const ring = new THREE.Mesh(new THREE.RingGeometry(holeR, holeR + 1, 20), new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx, y0 + 0.04, cz);
      g.add(ring);
    });

    // ── Main chip / IC ──
    this._buildChip(def, g, y0);

    // ── USB connector ──
    this._buildUSB(def, g, y0);

    // ── Buttons ──
    def.buttons.forEach(btn => this._buildButton(btn, g, y0, def));

    // ── Antenna area (ESP32/ESP8266) ──
    if (def.pcbColor === 0x1a5c2a) {
      const antMat = new THREE.MeshStandardMaterial({ color: 0x2a8040, roughness: 0.6 });
      const ant = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 12), antMat);
      ant.position.set(def.width / 2 - 2.5, y0 + 0.25, def.usbOffsetZ + 6);
      g.add(ant);
    }

    // ── Built-in LED ──
    this._addBoardLED(def);

    // ── Pins ──
    Object.entries(def.pins).forEach(([name, pin]) => {
      this._addPin(def, name, pin);
    });

    // ── Pin row silkscreen bars ──
    this._addPinRowSilkscreen(def, g, y0);
  }

  _buildChip(def, g, y0) {
    // IC package body
    const chipMat = new THREE.MeshStandardMaterial({ color: def.chipColor, roughness: 0.25, metalness: 0.5 });
    const chip = new THREE.Mesh(new THREE.BoxGeometry(def.chipW, 2.5, def.chipL), chipMat);
    chip.position.set(0, y0 + 1.25, def.chipOffsetZ);
    chip.castShadow = true;
    g.add(chip);

    // Chip top epoxy marking (slight indent)
    const markMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const mark = new THREE.Mesh(new THREE.BoxGeometry(def.chipW * 0.7, 0.1, def.chipL * 0.7), markMat);
    mark.position.set(0, y0 + 2.55, def.chipOffsetZ);
    g.add(mark);

    // Pin 1 indicator dot (notch or circle)
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 }));
    dot.position.set(-def.chipW / 2 + 1.5, y0 + 2.56, def.chipOffsetZ + def.chipL / 2 - 1.5);
    g.add(dot);

    // IC lead frame pins on all 4 sides (small metallic rectangles)
    const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
    const sides = [
      { axis: 'x', count: Math.floor(def.chipL / 2.5), along: 'z', sign: -1, half: def.chipW },
      { axis: 'x', count: Math.floor(def.chipL / 2.5), along: 'z', sign:  1, half: def.chipW },
    ];
    sides.forEach(({ count, along, sign, half }) => {
      const span = (count - 1) * 2.2;
      for (let i = 0; i < count; i++) {
        const lead = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.8), leadMat);
        const pos = -span / 2 + i * 2.2;
        if (along === 'z') {
          lead.position.set(sign * (half / 2 + 1), y0 + 0.6, def.chipOffsetZ + pos);
        } else {
          lead.position.set(def.chipOffsetZ + pos, y0 + 0.6, sign * (half / 2 + 1));
        }
        lead.castShadow = false;
        g.add(lead);
      }
    });
  }

  _buildUSB(def, g, y0) {
    const usbMat = new THREE.MeshStandardMaterial({ color: def.usbColor, roughness: 0.35, metalness: 0.75 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(def.usbW, 4, def.usbL), usbMat);
    body.position.set(0, y0 + 2, def.usbOffsetZ - def.usbL / 2);
    g.add(body);

    // USB port inner recess (darker rectangle)
    const port = new THREE.Mesh(new THREE.BoxGeometry(def.usbW - 2, 2.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }));
    port.position.set(0, y0 + 2, def.usbOffsetZ - def.usbL + 0.25);
    g.add(port);

    // USB shield tabs
    [-def.usbW / 2 + 0.5, def.usbW / 2 - 0.5].forEach(tx => {
      const tab = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 2), usbMat);
      tab.position.set(tx, y0 + 0.75, def.usbOffsetZ - def.usbL + 1);
      g.add(tab);
    });
  }

  _buildButton(btn, g, y0, def) {
    // Tactile button housing (square black body)
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 5), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 }));
    body.position.set(btn.x, y0 + 1.75, btn.z);
    g.add(body);

    // Button cap (slightly rounded top)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 1, 16), new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.5 }));
    cap.position.set(btn.x, y0 + 3.5, btn.z);
    g.add(cap);

    // 4 legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
    [[-2, -2],[2, -2],[-2, 2],[2, 2]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 6), legMat);
      leg.position.set(btn.x + lx, y0 - 0.2, btn.z + lz);
      g.add(leg);
    });

    // Silkscreen label sprite
    const sprite = makeTextSprite(btn.label, { fontSize: 20, bg: 'transparent', fg: '#ffffff', border: 'transparent' });
    sprite.position.set(btn.x, y0 + 5.5, btn.z);
    g.add(sprite);
  }

  _addPinRowSilkscreen(def, g, y0) {
    // White silkscreen bars alongside pin rows
    const silkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, opacity: 0.6, transparent: true });
    const pinGroups = {};
    Object.values(def.pins).forEach(pin => {
      const key = `${pin.x}`;
      if (!pinGroups[key]) pinGroups[key] = [];
      pinGroups[key].push(pin.z);
    });
    Object.entries(pinGroups).forEach(([xStr, zList]) => {
      const x = parseFloat(xStr);
      const zMin = Math.min(...zList);
      const zMax = Math.max(...zList);
      const len  = zMax - zMin + 2;
      const bar  = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, len), silkMat);
      bar.position.set(x + (x < 0 ? -1.5 : 1.5), y0 + 0.05, (zMin + zMax) / 2);
      g.add(bar);
    });
  }

  _addBoardLED(def) {
    const pinName = def.builtinLedPin;
    const pinDef  = def.pins[pinName];
    if (!pinDef) return;

    const color = def.builtinLedColor;
    const mat   = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.15, roughness: 0.25, transparent: true, opacity: 0.92,
    });
    // LED dome shape using SphereGeometry (top half)
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    mesh.position.set(pinDef.x, def.thickness / 2 + 1.8, pinDef.z);
    mesh.userData.pinName = pinName;
    mesh.userData.pinDesc = 'Built-in LED';
    this.boardGroup.add(mesh);

    // LED base cylinder
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 1, 14), mat);
    base.position.set(pinDef.x, def.thickness / 2 + 0.5, pinDef.z);
    this.boardGroup.add(base);

    const light = new THREE.PointLight(color, 0, 30);
    light.position.copy(mesh.position);
    this.boardGroup.add(light);

    this.pinMap[pinName] = { mesh, light, mat, type: 'led', isBuiltin: true };
  }

  _addPin(def, name, pin) {
    const colorMap = {
      power: 0xff3300,
      gnd:   0x333333,
      analog:0xffaa00,
      io:    0xccaa44,
      ctrl:  0x888888,
    };
    const color = colorMap[pin.type] || 0xccaa44;

    // Pin header post
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.85 });
    const postH = def.thickness + 4;
    const post  = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, postH, 8), mat);
    post.position.set(pin.x, 0, pin.z);
    post.userData.pinName = name;
    post.userData.pinDesc = pin.desc || '';
    this.boardGroup.add(post);

    // Solder pad ring on PCB top
    const padMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide });
    const pad = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.2, 12), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(pin.x, def.thickness / 2 + 0.05, pin.z);
    pad.userData.pinName = name;
    pad.userData.pinDesc = pin.desc || '';
    this.boardGroup.add(pad);

    this.pinMeshes.push({ mesh: post, name, desc: pin.desc || '' });
    this.pinMeshes.push({ mesh: pad,  name, desc: pin.desc || '' });
  }

  _resetCamera(def) {
    const d = Math.max(def.width, def.length) * 1.6;
    this.camera.position.set(d * 0.5, d * 0.6, d * 0.8);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  // ── Component management ───────────────────────────────────────────────────
  addComponent(uid, componentId, pinName, cfg = {}) {
    const def = BOARD_DEFS[this.currentBoard];
    if (!def) return;
    const pinDef = def.pins[pinName];
    const pos = pinDef
      ? new THREE.Vector3(pinDef.x, def.thickness / 2 + 6, pinDef.z)
      : new THREE.Vector3((Math.random() - 0.5) * 60, def.thickness / 2 + 6, (Math.random() - 0.5) * 60);
    this._placeComponentMesh(uid, componentId, pos, pinName, cfg);
  }

  _placeComponentMesh(uid, componentId, pos, pinName, cfg = {}) {
    const vis = COMPONENT_VIS[componentId] || COMPONENT_VIS.led;
    const group = new THREE.Group();
    group.position.copy(pos);
    this.boardGroup.add(group);

    let mesh, mat, light = null;

    if (componentId === 'led' || componentId === 'rgb-led' || componentId === 'neopixel') {
      const rawColor = cfg.ledColor || vis.defaultColor;
      const color    = typeof rawColor === 'string' ? parseInt(rawColor.replace('#', ''), 16) : rawColor;
      mat  = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.1,
        roughness: 0.15, transparent: true, opacity: 0.92,
      });

      // LED epoxy dome (hemisphere)
      const dome = new THREE.Mesh(new THREE.SphereGeometry(vis.r, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.7), mat);
      dome.position.y = vis.r * 0.85 + 2;
      dome.userData.compUid = uid;
      group.add(dome);
      mesh = dome;

      // LED base cylinder
      const baseMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.75 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(vis.r, vis.r, 2, 16), baseMat);
      base.position.y = 1;
      base.userData.compUid = uid;
      group.add(base);

      // Two leads (anode/cathode)
      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.15 });
      [-0.5, 0.5].forEach((ox, i) => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.5, 6), leadMat);
        lead.position.set(ox, -2.75, 0);
        group.add(lead);
      });

      // Flat bottom
      const flat = new THREE.Mesh(new THREE.CircleGeometry(vis.r, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }));
      flat.rotation.x = Math.PI / 2;
      flat.position.y = 0.01;
      group.add(flat);

      light = new THREE.PointLight(color, 0, 40);
      light.position.y = vis.r + 2;
      group.add(light);

    } else if (componentId === 'resistor') {
      // Resistor body cylinder
      mat = new THREE.MeshStandardMaterial({ color: 0xd4b483, roughness: 0.6 });
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(vis.r, vis.r, 8, 14), mat);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.y = 3;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Color bands (4-band resistor)
      const bands = [0xcc2200, 0x333333, 0xff6600, 0xffcc00];
      const bandMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
      bands.forEach((bColor, bi) => {
        const bm = bandMat.clone();
        bm.color.setHex(bColor);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(vis.r + 0.05, vis.r + 0.05, 0.8, 14), bm);
        band.rotation.z = Math.PI / 2;
        band.position.set(0, 3, 0);
        band.position.x = -2.4 + bi * 1.6;
        group.add(band);
      });

      // Leads
      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.15 });
      [-5.5, 5.5].forEach(lx => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), leadMat);
        lead.position.set(lx, 3, 0);
        lead.rotation.z = Math.PI / 2;
        group.add(lead);
      });

    } else if (componentId === 'capacitor') {
      // Electrolytic capacitor
      mat = new THREE.MeshStandardMaterial({ color: 0x334499, roughness: 0.4, metalness: 0.3 });
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(vis.r, vis.r, vis.h, 18), mat);
      mesh.position.y = vis.h / 2;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Aluminum top with K mark stripe
      const topMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.7, roughness: 0.3 });
      const top = new THREE.Mesh(new THREE.CylinderGeometry(vis.r, vis.r, 0.5, 18), topMat);
      top.position.y = vis.h + 0.25;
      group.add(top);

      const stripeMat = new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.7 });
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(vis.r * 0.8, vis.h + 0.6, vis.r * 0.5), stripeMat);
      stripe.position.y = vis.h / 2;
      group.add(stripe);

      // Leads
      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
      [[-0.7, 0.22], [0.7, -0.1]].forEach(([lx, lz]) => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 6), leadMat);
        lead.position.set(lx, -2.5, lz);
        group.add(lead);
      });

    } else if (componentId === 'button') {
      // Tactile push button
      mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
      mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 6), mat);
      mesh.position.y = 1.75;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Button cap
      const capColor = cfg.btnColor || 0xcc3300;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1.5, 14), new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.4 }));
      cap.position.y = 4.25;
      cap.userData.compUid = uid;
      group.add(cap);

      // 4 legs
      const legMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.9, roughness: 0.2 });
      [[-2.5,-2.5],[-2.5,2.5],[2.5,-2.5],[2.5,2.5]].forEach(([lx,lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 6), legMat);
        leg.position.set(lx, -0.5, lz);
        group.add(leg);
      });

    } else if (componentId === 'buzzer') {
      mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(vis.r, vis.r * 1.05, vis.h, 20), mat);
      mesh.position.y = vis.h / 2;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Sound holes ring
      const holeMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8), holeMat);
        hole.position.set(Math.cos(angle) * (vis.r - 1.5), vis.h + 0.15, Math.sin(angle) * (vis.r - 1.5));
        group.add(hole);
      }
      const centerHole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8), holeMat);
      centerHole.position.y = vis.h + 0.15;
      group.add(centerHole);

      const plusMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
      const plus = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.2), plusMat);
      plus.position.set(-vis.r + 0.5, 0.1, 0);
      group.add(plus);

      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
      [[-0.8, 0.22], [0.8, -0.1]].forEach(([lx]) => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.5, 6), leadMat);
        lead.position.set(lx, -2.25, 0);
        group.add(lead);
      });

    } else if (componentId === 'dht22' || componentId === 'dht11') {
      mat = new THREE.MeshStandardMaterial({ color: vis.defaultColor, roughness: 0.6 });
      mesh = new THREE.Mesh(new THREE.BoxGeometry(vis.w, vis.h, vis.l), mat);
      mesh.position.y = vis.h / 2;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Grid holes on front face
      const gridMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5 });
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
          const cell = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.3), gridMat);
          cell.position.set(-3 + col * 2, 3 + row * 2, vis.l / 2 + 0.15);
          group.add(cell);
        }
      }

      // 3 pins bottom
      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
      [-2, 0, 2].forEach((lx, i) => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 6), leadMat);
        lead.position.set(lx, -2, 0);
        group.add(lead);
      });

    } else if (componentId === 'hcsr04') {
      // HC-SR04 ultrasonic sensor
      mat = new THREE.MeshStandardMaterial({ color: vis.defaultColor, roughness: 0.5 });
      mesh = new THREE.Mesh(new THREE.BoxGeometry(vis.w, 3, vis.l), mat);
      mesh.position.y = 1.5;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Two ultrasonic transducers (big cylinders)
      const transMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3, metalness: 0.2 });
      const transMesh1 = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 5, 24), transMat);
      const transMesh2 = transMesh1.clone();
      transMesh1.rotation.x = Math.PI / 2;
      transMesh2.rotation.x = Math.PI / 2;
      transMesh1.position.set(-12, 1.5, vis.l / 2 + 2.5);
      transMesh2.position.set( 12, 1.5, vis.l / 2 + 2.5);
      group.add(transMesh1); group.add(transMesh2);

      // Transducer mesh membrane
      const membMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.4 });
      [transMesh1, transMesh2].forEach(t => {
        const memb = new THREE.Mesh(new THREE.CircleGeometry(4, 20), membMat);
        memb.position.copy(t.position);
        memb.position.z += 2.6;
        group.add(memb);
      });

      // Small IC chip on board
      const ic = new THREE.Mesh(new THREE.BoxGeometry(8, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }));
      ic.position.set(0, 2.75, 0);
      group.add(ic);

      // 4 header pins
      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
      [-3, -1, 1, 3].forEach(lx => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 6), leadMat);
        lead.position.set(lx * 1.5, -2, -vis.l / 2);
        group.add(lead);
      });

    } else if (componentId === 'servo') {
      mat = new THREE.MeshStandardMaterial({ color: vis.defaultColor, roughness: 0.5 });
      mesh = new THREE.Mesh(new THREE.BoxGeometry(vis.w, vis.h, vis.l), mat);
      mesh.position.y = vis.h / 2;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Servo horn
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 2, 18), hornMat);
      horn.position.set(0, vis.h + 1, -2);
      group.add(horn);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 2), hornMat);
      arm.position.set(5, vis.h + 2, -2);
      group.add(arm);

      // Cable connector
      const conn = new THREE.Mesh(new THREE.BoxGeometry(4.5, 6, 2), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 }));
      conn.position.set(0, vis.h / 2, vis.l / 2 + 1);
      group.add(conn);

      light = new THREE.PointLight(0xffff88, 0, 25);
      light.position.y = vis.h + 2;
      group.add(light);

    } else if (componentId === 'oled') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(vis.w, 3, vis.l), new THREE.MeshStandardMaterial({ color: vis.defaultColor, roughness: 0.7 }));
      body.position.y = 1.5;
      body.userData.compUid = uid;
      group.add(body);
      mesh = body;

      // Screen surface (emissive blue)
      const screenMat = new THREE.MeshStandardMaterial({ color: vis.screenColor, emissive: vis.screenColor, emissiveIntensity: 0.4, roughness: 0.1 });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(vis.w - 3, 0.3, vis.l - 3), screenMat);
      screen.position.y = 3.15;
      group.add(screen);

      // Fake pixel grid lines
      const gridMat = new THREE.MeshStandardMaterial({ color: 0x0011aa, roughness: 0.3, transparent: true, opacity: 0.6 });
      for (let r = 0; r < 4; r++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(vis.w - 4, 0.1, 0.3), gridMat);
        line.position.set(0, 3.2, -4 + r * 2.5);
        group.add(line);
      }

      // 4 header pins
      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
      [-3,-1,1,3].forEach((lx, i) => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5, 6), leadMat);
        lead.position.set(lx * 1.5, -2.5, -vis.l / 2 + 1);
        group.add(lead);
      });

      light = new THREE.PointLight(0x0033ff, 0.4, 30);
      light.position.y = 4;
      group.add(light);

    } else if (componentId === 'photoresistor') {
      mat = new THREE.MeshStandardMaterial({ color: 0xddddbb, roughness: 0.3, transparent: true, opacity: 0.7 });
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(vis.r * 1.5, vis.r * 1.5, 1.2, 12), mat);
      mesh.position.y = 3;
      mesh.rotation.x = Math.PI / 2;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Zigzag trace on top (approx)
      const traceMat = new THREE.MeshStandardMaterial({ color: 0x555500, roughness: 0.5 });
      for (let i = 0; i < 5; i++) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 1.5), traceMat);
        seg.position.set(-1.2 + i * 0.6, 3.7, 0);
        group.add(seg);
      }

      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
      [-0.6, 0.6].forEach(lx => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5, 6), leadMat);
        lead.position.set(lx, 0.5, 0);
        group.add(lead);
      });

    } else if (componentId === 'pir') {
      mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.6 });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(vis.r, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      mesh.position.y = vis.r;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // PCB base under dome
      const base = new THREE.Mesh(new THREE.CylinderGeometry(vis.r, vis.r, 2, 20), new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.5 }));
      base.position.y = 1;
      base.userData.compUid = uid;
      group.add(base);

      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
      [-2, 0, 2].forEach(lx => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 6), leadMat);
        lead.position.set(lx * 1.5, -1.5, 0);
        group.add(lead);
      });

    } else if (componentId === 'relay') {
      mat = new THREE.MeshStandardMaterial({ color: vis.defaultColor, roughness: 0.5 });
      mesh = new THREE.Mesh(new THREE.BoxGeometry(vis.w, vis.h, vis.l), mat);
      mesh.position.y = vis.h / 2;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Coil core visible end
      const coilMat = new THREE.MeshStandardMaterial({ color: 0xaa4400, roughness: 0.4 });
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6, 14), coilMat);
      coil.position.set(-3, vis.h / 2 + 0.5, 4);
      group.add(coil);

      // Terminal block
      const termMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 });
      const term = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 6), termMat);
      term.position.set(5, vis.h / 2 - 1, 4);
      group.add(term);
      // Terminal screws
      const screwMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8 });
      [-1.5, 1.5].forEach(tz => {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.8, 10), screwMat);
        screw.position.set(5, vis.h / 2 + 2.1, tz + 4);
        group.add(screw);
      });

    } else if (componentId === 'potentiometer') {
      mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(vis.r, vis.r, 5, 18), mat);
      mesh.position.y = 2.5;
      mesh.userData.compUid = uid;
      group.add(mesh);

      // Knob
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(vis.r * 0.65, vis.r * 0.65, 3.5, 18), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 }));
      knob.position.y = 6.75;
      group.add(knob);
      // Knob indicator line
      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
      ind.position.set(0, 8, vis.r * 0.4);
      group.add(ind);

      const leadMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
      [-2, 0, 2].forEach(lx => {
        const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 6), leadMat);
        lead.position.set(lx, -2, 0);
        group.add(lead);
      });

    } else {
      // Generic box fallback
      mat  = new THREE.MeshStandardMaterial({ color: vis.defaultColor || 0x444466, roughness: 0.6 });
      const bw = vis.w || (vis.r ? vis.r * 2.5 : 8);
      const bh = vis.h || 8;
      const bl = vis.l || (vis.r ? vis.r * 2.5 : 8);
      mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), mat);
      mesh.position.y = bh / 2;
      mesh.userData.compUid = uid;
      group.add(mesh);
    }

    if (mesh) mesh.castShadow = true;
    this.components[uid] = { group, pinName, type: componentId, mesh, mat, light };
  }

  removeComponent(uid) {
    const comp = this.components[uid];
    if (!comp) return;
    this.boardGroup?.remove(comp.group);
    comp.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    delete this.components[uid];
  }

  updateComponentPin(uid, newPinName) {
    const comp = this.components[uid];
    if (!comp) return;
    const def = BOARD_DEFS[this.currentBoard];
    if (!def) return;
    const pinDef = def.pins[newPinName];
    if (!pinDef) return;
    comp.group.position.set(pinDef.x, def.thickness / 2 + 6, pinDef.z);
    comp.pinName = newPinName;
  }

  updateComponentColor(uid, colorHex) {
    const comp = this.components[uid];
    if (!comp) return;

    // Update all emissive materials in the component group
    comp.group.traverse(obj => {
      if (obj.isMesh && obj.material && obj.material.emissive) {
        obj.material.color.setHex(colorHex);
        obj.material.emissive.setHex(colorHex);
      }
    });
    if (comp.mat) {
      comp.mat.color.setHex(colorHex);
      comp.mat.emissive.setHex(colorHex);
    }
    if (comp.light) comp.light.color.setHex(colorHex);
  }

  // ── Pin state setters ──────────────────────────────────────────────────────
  _setPinHigh(pinNumber) {
    Object.entries(this.pinMap).forEach(([name, item]) => {
      if (parseInt(name.replace(/[^\d]/g, '')) === pinNumber) {
        item.mat.emissiveIntensity = 1.2;
        if (item.light) item.light.intensity = 1.5;
      }
    });
    Object.values(this.components).forEach(comp => {
      if (!comp.pinName) return;
      if (parseInt(comp.pinName.replace(/[^\d]/g, '')) === pinNumber) {
        if (comp.mat) comp.mat.emissiveIntensity = 1.5;
        if (comp.light) comp.light.intensity = 2.5;
      }
    });
  }

  _setPinLow(pinNumber) {
    Object.entries(this.pinMap).forEach(([name, item]) => {
      if (parseInt(name.replace(/[^\d]/g, '')) === pinNumber) {
        item.mat.emissiveIntensity = 0.08;
        if (item.light) item.light.intensity = 0;
      }
    });
    Object.values(this.components).forEach(comp => {
      if (!comp.pinName) return;
      if (parseInt(comp.pinName.replace(/[^\d]/g, '')) === pinNumber) {
        if (comp.mat) comp.mat.emissiveIntensity = 0;
        if (comp.light) comp.light.intensity = 0;
      }
    });
  }

  _setPinPwm(pinNumber, ratio) {
    Object.values(this.components).forEach(comp => {
      if (!comp.pinName) return;
      if (parseInt(comp.pinName.replace(/[^\d]/g, '')) === pinNumber) {
        if (comp.mat) comp.mat.emissiveIntensity = ratio * 1.5;
        if (comp.light) comp.light.intensity = ratio * 2.5;
      }
    });
  }

  // ── Animation ──────────────────────────────────────────────────────────────
  runAnimation(code) {
    this.stopAnimation();
    const { events } = parseArduinoCode(code);
    if (!events.length) return;

    const { timeline, duration } = buildTimeline(events);
    if (!duration || !timeline.length) return;

    this.running = true;

    const scheduleLoop = () => {
      const loopTimeout = setTimeout(() => {
        if (!this.running) return;
        scheduleLoop();
      }, duration);
      this.animTimers.push(loopTimeout);

      timeline.forEach(entry => {
        const t = setTimeout(() => {
          if (!this.running) return;
          if (entry.type === 'digital') {
            if (entry.value) this._setPinHigh(entry.pin);
            else             this._setPinLow(entry.pin);
          } else if (entry.type === 'pwm') {
            this._setPinPwm(entry.pin, entry.value);
          }
        }, entry.t);
        this.animTimers.push(t);
      });
    };

    scheduleLoop();
  }

  stopAnimation() {
    this.running = false;
    this.animTimers.forEach(t => clearTimeout(t));
    this.animTimers = [];
    Object.values(this.pinMap).forEach(item => {
      item.mat.emissiveIntensity = 0.1;
      if (item.light) item.light.intensity = 0;
    });
    Object.values(this.components).forEach(comp => {
      if (comp.mat) comp.mat.emissiveIntensity = 0;
      if (comp.light) comp.light.intensity = 0;
    });
  }

  destroy() {
    this.stopAnimation();
    cancelAnimationFrame(this.animFrameId);
    this._tooltip.remove();
    this.renderer.dispose();
  }
}
