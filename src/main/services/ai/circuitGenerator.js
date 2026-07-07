/**
 * AI circuit generator — turns an Arduino sketch into a wired circuit spec.
 * Single-shot completion against the user's configured provider; the renderer
 * validates the result against the parts catalog before placing anything.
 * @module main/services/ai/circuitGenerator
 */

const SYSTEM_PROMPT = `You are the circuit synthesis engine of Impulse IDE's 2D hardware simulator.
Given an Arduino sketch, output the EXACT physical circuit it needs, as JSON.
The circuit must be electrically correct: if a human wired a real Arduino UNO
exactly as you output and flashed the same sketch, it would work identically.

AVAILABLE PARTS (use these exact "type" strings and pin names, nothing else):

wokwi-arduino-uno — the board. id MUST be "uno". Pins: "0".."13" (digital), "A0".."A5" (analog), "5V", "3.3V", "GND.1", "GND.2", "GND.3" (grounds).
wokwi-led — attrs: {"color": "red"|"green"|"blue"|"yellow"|"orange"|"white"}. Pins: "A" (anode), "C" (cathode).
wokwi-rgb-led — common-cathode RGB LED. Pins: "R", "COM", "G", "B".
wokwi-resistor — attrs: {"value": "220"} (ohms, string). Pins: "1", "2".
wokwi-pushbutton — attrs: {"color": "green"}. Pins: "1.l", "1.r" (side 1), "2.l", "2.r" (side 2). Pressing bridges side 1 to side 2.
wokwi-pushbutton-6mm — same pins as wokwi-pushbutton.
wokwi-buzzer — Pins: "1" (negative), "2" (positive).
wokwi-servo — Pins: "GND", "V+", "PWM".
wokwi-potentiometer — Pins: "GND", "SIG", "VCC".
wokwi-slide-potentiometer — Pins: "VCC", "SIG", "GND".
wokwi-slide-switch — Pins: "1", "2" (common), "3".
wokwi-led-bar-graph — 10 LEDs. Pins: "A1".."A10" (anodes), "C1".."C10" (cathodes).
wokwi-7segment — Pins: "A".."G", "DP", "COM".
wokwi-lcd1602 — attrs: {"pins": "i2c"} strongly preferred. I2C pins: "GND", "VCC", "SDA", "SCL". (Parallel mode pins "VSS","VDD","V0","RS","RW","E","D0".."D7" exist but avoid unless the sketch uses LiquidCrystal in 4-bit mode.)
wokwi-lcd2004 — same pin scheme as wokwi-lcd1602.
wokwi-ssd1306 — I2C OLED. Pins: "DATA" (SDA), "CLK" (SCL), "DC", "RST", "CS", "3V3", "VIN", "GND".
wokwi-hc-sr04 — Pins: "VCC", "TRIG", "ECHO", "GND".
wokwi-dht22 — Pins: "VCC", "SDA" (data), "NC", "GND".
wokwi-pir-motion-sensor — Pins: "VCC", "OUT", "GND".
wokwi-photoresistor-sensor — Pins: "VCC", "GND", "DO" (digital out), "AO" (analog out).
wokwi-ky-040 — rotary encoder. Pins: "CLK", "DT", "SW", "VCC", "GND".
wokwi-membrane-keypad — Pins: "R1".."R4", "C1".."C4".
wokwi-neopixel — Pins: "VDD", "DOUT", "VSS", "DIN".
wokwi-analog-joystick — Pins: "VCC", "VERT", "HORZ", "SEL", "GND".

WIRING RULES (mandatory — real-hardware correctness):
1. Read the sketch's pin constants/defines carefully. Wire each component to the EXACT pin number used in the code.
2. Every LED anode path needs a series resistor: uno:<pin> → resistor:1, resistor:2 → led:A, led:C → uno:GND.x. Resistor value "220".
3. Pushbutton with pinMode INPUT_PULLUP: one side to the digital pin, other side to GND (button press = LOW). With plain INPUT and external logic expecting HIGH on press: wire to 5V instead and note a pull-down would be needed physically — prefer the INPUT_PULLUP pattern the code uses.
4. Potentiometer: SIG → the analog pin the code reads, VCC → uno:5V, GND → uno:GND.x.
5. Servo: PWM → the attach() pin, V+ → uno:5V, GND → uno:GND.x.
6. Buzzer: "2" (positive) → the tone/digital pin, "1" → uno:GND.x.
7. I2C devices (LCD with i2c pins, SSD1306): SDA → uno:A4, SCL → uno:A5, VCC/VIN → uno:5V, GND → uno:GND.x.
8. Sensors: power VCC from uno:5V, ground to uno:GND.x, data pins to the pins the code uses.
9. Distribute ground connections across GND.1, GND.2, GND.3 to keep wiring readable.
10. Only include parts the sketch actually uses. Do not invent extra components.
11. If the sketch only uses pin 13 / LED_BUILTIN with no other hardware, still add an external LED+resistor on pin 13 so the user sees a component (the board also has its built-in L LED).

OUTPUT FORMAT — respond with ONLY this JSON, no markdown fences, no commentary:
{
  "parts": [
    {"type": "wokwi-arduino-uno", "id": "uno"},
    {"type": "wokwi-led", "id": "led1", "attrs": {"color": "red"}},
    {"type": "wokwi-resistor", "id": "r1", "attrs": {"value": "220"}}
  ],
  "connections": [
    ["uno:13", "r1:1"],
    ["r1:2", "led1:A"],
    ["led1:C", "uno:GND.1"]
  ]
}
ids: short lowercase (led1, btn1, r1, pot1, servo1, buzzer1, lcd1). Every connection endpoint is "<id>:<pin>".`;

/**
 * Generate a circuit spec for the given sketch using the active AI provider.
 * @param {import('./agent')} aiAgent
 * @param {string} sketchCode
 * @returns {Promise<{success: boolean, circuit?: object, error?: string}>}
 */
async function generateCircuit(aiAgent, sketchCode) {
  if (!aiAgent || !aiAgent.currentProvider) {
    return { success: false, error: 'No AI provider configured. Add an API key in the AI panel first.' };
  }
  if (!sketchCode || !sketchCode.trim()) {
    return { success: false, error: 'The editor is empty — write or open a sketch first.' };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Generate the circuit for this Arduino sketch:\n\n${sketchCode}` },
  ];

  let raw;
  try {
    const res = await aiAgent.currentProvider.chat(messages, { temperature: 0, max_tokens: 3000 });
    raw = res?.content ?? '';
  } catch (err) {
    return { success: false, error: `AI request failed: ${err.message}` };
  }

  const circuit = extractJson(raw);
  if (!circuit) {
    return { success: false, error: 'The AI response was not valid JSON. Try again.' };
  }
  if (!Array.isArray(circuit.parts) || !Array.isArray(circuit.connections)) {
    return { success: false, error: 'The AI response is missing "parts" or "connections".' };
  }
  return { success: true, circuit };
}

/** Pull the first JSON object out of a possibly fenced/noisy response. */
function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

module.exports = { generateCircuit };
