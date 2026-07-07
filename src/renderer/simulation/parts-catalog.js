// Parts catalog — maps part types to @wokwi/elements tags, organized like Wokwi's picker.
// Importing '@wokwi/elements' registers all custom elements (wokwi-led, wokwi-arduino-uno, …).
import '@wokwi/elements';

export const PARTS = {
  // ── Boards ──
  'wokwi-arduino-uno': {
    tag: 'wokwi-arduino-uno',
    label: 'Arduino UNO',
    category: 'Boards',
    isBoard: true,
  },

  // ── Basic ──
  'wokwi-led': {
    tag: 'wokwi-led',
    label: 'LED',
    category: 'Basic',
    defaultAttrs: { color: 'red' },
  },
  'wokwi-pushbutton': {
    tag: 'wokwi-pushbutton',
    label: 'Pushbutton',
    category: 'Basic',
    defaultAttrs: { color: 'green' },
  },
  'wokwi-pushbutton-6mm': {
    tag: 'wokwi-pushbutton-6mm',
    label: 'Pushbutton 6mm',
    category: 'Basic',
    defaultAttrs: { color: 'green' },
  },
  'wokwi-resistor': {
    tag: 'wokwi-resistor',
    label: 'Resistor',
    category: 'Basic',
    defaultAttrs: { value: '220' },
  },

  // ── Display ──
  'wokwi-rgb-led': {
    tag: 'wokwi-rgb-led',
    label: 'RGB LED',
    category: 'Display',
  },
  'wokwi-lcd1602': {
    tag: 'wokwi-lcd1602',
    label: 'LCD 16x2',
    category: 'Display',
  },
  'wokwi-lcd2004': {
    tag: 'wokwi-lcd2004',
    label: 'LCD 20x4',
    category: 'Display',
  },
  'wokwi-ssd1306': {
    tag: 'wokwi-ssd1306',
    label: 'SSD1306 OLED display',
    category: 'Display',
  },
  'wokwi-7segment': {
    tag: 'wokwi-7segment',
    label: 'Seven Segment Display',
    category: 'Display',
  },
  'wokwi-led-bar-graph': {
    tag: 'wokwi-led-bar-graph',
    label: 'LED Bar Graph',
    category: 'Display',
  },
  'wokwi-neopixel': {
    tag: 'wokwi-neopixel',
    label: 'NeoPixel LED (WS2812)',
    category: 'Display',
  },

  // ── Input ──
  'wokwi-slide-switch': {
    tag: 'wokwi-slide-switch',
    label: 'Slide switch',
    category: 'Input',
  },
  'wokwi-analog-joystick': {
    tag: 'wokwi-analog-joystick',
    label: 'Analog Joystick',
    category: 'Input',
  },
  'wokwi-ky-040': {
    tag: 'wokwi-ky-040',
    label: 'Rotary Encoder (KY-040)',
    category: 'Input',
  },
  'wokwi-membrane-keypad': {
    tag: 'wokwi-membrane-keypad',
    label: 'Keypad',
    category: 'Input',
  },
  'wokwi-potentiometer': {
    tag: 'wokwi-potentiometer',
    label: 'Potentiometer',
    category: 'Input',
  },
  'wokwi-slide-potentiometer': {
    tag: 'wokwi-slide-potentiometer',
    label: 'Slide Potentiometer',
    category: 'Input',
  },

  // ── Output ──
  'wokwi-buzzer': {
    tag: 'wokwi-buzzer',
    label: 'Buzzer',
    category: 'Output',
  },
  'wokwi-servo': {
    tag: 'wokwi-servo',
    label: 'Servo Motor',
    category: 'Output',
  },

  // ── Sensors ──
  'wokwi-hc-sr04': {
    tag: 'wokwi-hc-sr04',
    label: 'HC-SR04 Ultrasonic Sensor',
    category: 'Sensors',
  },
  'wokwi-dht22': {
    tag: 'wokwi-dht22',
    label: 'DHT22 Temp & Humidity',
    category: 'Sensors',
  },
  'wokwi-pir-motion-sensor': {
    tag: 'wokwi-pir-motion-sensor',
    label: 'PIR Motion Sensor',
    category: 'Sensors',
  },
  'wokwi-photoresistor-sensor': {
    tag: 'wokwi-photoresistor-sensor',
    label: 'Photoresistor (LDR)',
    category: 'Sensors',
  },
};

export const CATEGORY_ORDER = ['Boards', 'Basic', 'Display', 'Input', 'Output', 'Sensors'];

// Map an Arduino UNO pinInfo name → avr8js Arduino pin number.
// Returns null for power pins / unmapped pins.
export function unoPinToArduino(pinName) {
  if (/^\d+$/.test(pinName)) return parseInt(pinName, 10);        // "0".."13"
  const analogMatch = /^A(\d)(\.\d+)?$/.exec(pinName);            // "A0".."A5", "A4.2"
  if (analogMatch) return 14 + parseInt(analogMatch[1], 10);
  return null; // GND.x, 5V, 3.3V, VIN, RESET, AREF, IOREF
}

export function isPowerPin(pinName) {
  return /^(GND(\.\d+)?|5V|3\.3V|VIN|IOREF)$/.test(pinName);
}

export function isGndPin(pinName) {
  return /^GND(\.\d+)?$/.test(pinName);
}
