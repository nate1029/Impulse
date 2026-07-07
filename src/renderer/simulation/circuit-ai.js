// AI circuit builder — validates the generated spec and lays it out on canvas.

import { PARTS } from './parts-catalog.js';

// Static pin-name table for validation (matches @wokwi/elements pinInfo).
const PIN_NAMES = {
  'wokwi-arduino-uno': [
    ...Array.from({ length: 14 }, (_, i) => String(i)),
    'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A4.2', 'A5.2',
    '5V', '3.3V', 'GND.1', 'GND.2', 'GND.3', 'VIN', 'RESET', 'AREF', 'IOREF',
  ],
  'wokwi-led': ['A', 'C'],
  'wokwi-rgb-led': ['R', 'COM', 'G', 'B'],
  'wokwi-resistor': ['1', '2'],
  'wokwi-pushbutton': ['1.l', '1.r', '2.l', '2.r'],
  'wokwi-pushbutton-6mm': ['1.l', '1.r', '2.l', '2.r'],
  'wokwi-buzzer': ['1', '2'],
  'wokwi-servo': ['GND', 'V+', 'PWM'],
  'wokwi-potentiometer': ['GND', 'SIG', 'VCC'],
  'wokwi-slide-potentiometer': ['VCC', 'SIG', 'GND'],
  'wokwi-slide-switch': ['1', '2', '3'],
  'wokwi-led-bar-graph': [
    ...Array.from({ length: 10 }, (_, i) => `A${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `C${i + 1}`),
  ],
  'wokwi-7segment': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP', 'COM', 'DIG1', 'DIG2', 'DIG3', 'DIG4', 'CLN'],
  'wokwi-lcd1602': ['GND', 'VCC', 'SDA', 'SCL', 'VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A', 'K'],
  'wokwi-lcd2004': ['GND', 'VCC', 'SDA', 'SCL', 'VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A', 'K'],
  'wokwi-ssd1306': ['DATA', 'CLK', 'DC', 'RST', 'CS', '3V3', 'VIN', 'GND'],
  'wokwi-hc-sr04': ['VCC', 'TRIG', 'ECHO', 'GND'],
  'wokwi-dht22': ['VCC', 'SDA', 'NC', 'GND'],
  'wokwi-pir-motion-sensor': ['VCC', 'OUT', 'GND'],
  'wokwi-photoresistor-sensor': ['VCC', 'GND', 'DO', 'AO'],
  'wokwi-ky-040': ['CLK', 'DT', 'SW', 'VCC', 'GND'],
  'wokwi-membrane-keypad': ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'],
  'wokwi-neopixel': ['VDD', 'DOUT', 'VSS', 'DIN'],
  'wokwi-analog-joystick': ['VCC', 'VERT', 'HORZ', 'SEL', 'GND'],
};

// Rough footprint sizes for auto-layout (element px)
const SIZES = {
  'wokwi-arduino-uno': { w: 277, h: 200 },
  'wokwi-lcd1602': { w: 310, h: 145 },
  'wokwi-lcd2004': { w: 310, h: 165 },
  'wokwi-ssd1306': { w: 130, h: 130 },
  'wokwi-membrane-keypad': { w: 190, h: 240 },
  'wokwi-led-bar-graph': { w: 60, h: 130 },
  'wokwi-servo': { w: 150, h: 120 },
  default: { w: 90, h: 90 },
};

/**
 * Validate the AI circuit spec. Returns { ok, errors, warnings }.
 */
export function validateCircuit(circuit) {
  const errors = [];
  const warnings = [];

  const ids = new Set();
  let unoCount = 0;

  for (const part of circuit.parts || []) {
    if (!part || typeof part !== 'object') { errors.push('Malformed part entry'); continue; }
    if (!PARTS[part.type] && part.type !== 'wokwi-arduino-uno') {
      errors.push(`Unknown part type: ${part.type}`);
      continue;
    }
    if (!part.id || typeof part.id !== 'string') {
      errors.push(`Part of type ${part.type} is missing an id`);
      continue;
    }
    if (ids.has(part.id)) errors.push(`Duplicate part id: ${part.id}`);
    ids.add(part.id);
    if (part.type === 'wokwi-arduino-uno') unoCount++;
  }

  if (unoCount === 0) errors.push('Circuit has no Arduino UNO');
  if (unoCount > 1) errors.push('Circuit has more than one Arduino UNO');

  const partType = Object.fromEntries((circuit.parts || []).map(p => [p.id, p.type]));

  for (const conn of circuit.connections || []) {
    if (!Array.isArray(conn) || conn.length < 2) { errors.push('Malformed connection entry'); continue; }
    for (const end of [conn[0], conn[1]]) {
      if (typeof end !== 'string' || !end.includes(':')) {
        errors.push(`Bad connection endpoint: ${JSON.stringify(end)}`);
        continue;
      }
      const sep = end.indexOf(':');
      const id = end.slice(0, sep);
      const pin = end.slice(sep + 1);
      if (!ids.has(id)) {
        errors.push(`Connection references unknown part: ${id}`);
        continue;
      }
      const valid = PIN_NAMES[partType[id]];
      if (valid && !valid.includes(pin)) {
        errors.push(`${partType[id]} "${id}" has no pin "${pin}"`);
      }
    }
  }

  // Electrical sanity warnings
  const ledAnodes = new Set();
  const resistorEnds = new Set();
  for (const conn of circuit.connections || []) {
    if (!Array.isArray(conn)) continue;
    for (const end of [conn[0], conn[1]]) {
      if (typeof end !== 'string') continue;
      const [id, pin] = [end.slice(0, end.indexOf(':')), end.slice(end.indexOf(':') + 1)];
      if (partType[id] === 'wokwi-led' && pin === 'A') ledAnodes.add(end);
      if (partType[id] === 'wokwi-resistor') resistorEnds.add(id);
    }
  }
  if (ledAnodes.size > 0 && resistorEnds.size === 0) {
    warnings.push('LEDs are wired without series resistors (works in simulation; add 220Ω for real hardware).');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Place a validated circuit on the canvas with automatic layout.
 * Returns the number of parts placed.
 */
export function placeCircuit(canvas, circuit) {
  canvas.clear();

  const uno = (circuit.parts || []).find(p => p.type === 'wokwi-arduino-uno');
  const others = (circuit.parts || []).filter(p => p !== uno);

  // Board on the left, components in columns to its right
  if (uno) canvas.addPart('wokwi-arduino-uno', 40, 140, uno.attrs || {}, uno.id);

  const colX = [400, 560, 720];
  let col = 0;
  let colY = [30, 30, 30];

  for (const part of others) {
    const size = SIZES[part.type] || SIZES.default;
    // Wide parts get their own row spanning from col 0
    let x, y;
    if (size.w > 220) {
      x = 400;
      y = Math.max(...colY);
      colY = colY.map(() => y + size.h + 40);
    } else {
      // Pick the shortest column
      col = colY.indexOf(Math.min(...colY));
      x = colX[col];
      y = colY[col];
      colY[col] = y + size.h + 40;
    }
    canvas.addPart(part.type, x, y, part.attrs || {}, part.id);
  }

  // Wires need pinInfo — wait a frame for elements to upgrade/render
  requestAnimationFrame(() => {
    for (const conn of circuit.connections || []) {
      if (!Array.isArray(conn) || conn.length < 2) continue;
      const parse = (end) => {
        const sep = end.indexOf(':');
        return { partId: end.slice(0, sep), pin: end.slice(sep + 1) };
      };
      canvas.addWire(parse(conn[0]), parse(conn[1]), conn[2] || null);
    }
    requestAnimationFrame(() => canvas.updateWires());
  });

  return (circuit.parts || []).length;
}
