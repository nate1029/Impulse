// Wokwi-style circuit canvas.
// Parts are @wokwi/elements web components absolutely positioned inside a
// pannable/zoomable container; wires live in an SVG overlay behind them.

import { PARTS } from './parts-catalog.js';

const GRID = 4.8; // Wokwi uses 0.1in grid at ~48px/in scale

function snap(v) { return Math.round(v / GRID) * GRID; }

const WIRE_COLORS = {
  power: '#e64a19', // red
  gnd: '#333333',   // black
  signal: '#4caf50',
  default: '#2196f3',
};
const COLOR_CYCLE = ['#4caf50', '#2196f3', '#9c27b0', '#ff9800', '#e91e63', '#00bcd4', '#795548', '#607d8b'];

export class CircuitCanvas {
  constructor(rootEl) {
    this.root = rootEl;                 // .sim-canvas-wrap
    this.parts = [];                    // { id, type, x, y, el, attrs }
    this.wires = [];                    // { id, from: {partId, pin}, to: {partId, pin}, color, pathEl }
    this._nextId = {};
    this._scale = 1;
    this._panX = 40;
    this._panY = 40;
    this._drag = null;
    this._wiring = null;
    this._selected = null;
    this._selectedWire = null;
    this._colorIdx = 0;

    // Layers: SVG (wires) under parts container, pin overlay on top
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'sim-wires-svg');
    this.partsLayer = document.createElement('div');
    this.partsLayer.className = 'sim-parts-layer';
    this.pinLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.pinLayer.setAttribute('class', 'sim-pins-svg');

    this.viewport = document.createElement('div');
    this.viewport.className = 'sim-viewport';
    this.viewport.appendChild(this.svg);
    this.viewport.appendChild(this.partsLayer);
    this.viewport.appendChild(this.pinLayer);
    this.root.appendChild(this.viewport);

    // Pin tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'sim-pin-tooltip';
    this.tooltip.style.display = 'none';
    this.root.appendChild(this.tooltip);

    this._applyTransform();
    this._bindEvents();

    this.onChange = null; // circuit modified (add/move/remove/wire)
  }

  // ── Parts ────────────────────────────────────────────────────────────────

  addPart(type, x = 100, y = 100, attrs = {}, id = null) {
    const def = PARTS[type];
    if (!def) return null;

    if (!id) {
      const base = def.label.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8) || 'part';
      this._nextId[base] = (this._nextId[base] || 0) + 1;
      id = `${base}${this._nextId[base]}`;
    }

    const el = document.createElement(def.tag);
    el.className = 'sim-part';
    el.dataset.partId = id;
    const merged = { ...def.defaultAttrs, ...attrs };
    for (const [k, v] of Object.entries(merged)) {
      el.setAttribute(k, v);
    }

    const part = { id, type, x: snap(x), y: snap(y), el, attrs: merged };
    el.style.left = `${part.x}px`;
    el.style.top = `${part.y}px`;

    this.partsLayer.appendChild(el);
    this.parts.push(part);

    // Drag + select. Interactive parts (buttons) also notify the manager so it
    // can drive the press — the manager's own listeners on the shadow element
    // don't fire reliably under this layer, so the canvas owns the hand-off.
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this._select(part);
      if (this.onPartPointerDown) this.onPartPointerDown(part, e);
      this._drag = {
        part,
        startX: part.x,
        startY: part.y,
        px: e.clientX,
        py: e.clientY,
        moved: false,
      };
    });
    el.addEventListener('pointerup', (e) => {
      if (this.onPartPointerUp) this.onPartPointerUp(part, e);
    });
    el.addEventListener('pointerleave', (e) => {
      if (this.onPartPointerUp) this.onPartPointerUp(part, e);
    });

    // Pin overlay dots after element renders
    requestAnimationFrame(() => this._renderPins(part));
    el.addEventListener('pininfo-change', () => this._renderPins(part));

    if (this.onChange) this.onChange();
    return part;
  }

  removePart(id) {
    const idx = this.parts.findIndex(p => p.id === id);
    if (idx < 0) return;
    const part = this.parts[idx];
    [...this.wires]
      .filter(w => w.from.partId === id || w.to.partId === id)
      .forEach(w => this.removeWire(w.id));
    part.el.remove();
    this._removePinDots(id);
    this.parts.splice(idx, 1);
    if (this._selected === part) this._selected = null;
    if (this.onChange) this.onChange();
  }

  getPart(id) {
    return this.parts.find(p => p.id === id) || null;
  }

  // ── Pin helpers ──────────────────────────────────────────────────────────

  pinPosition(part, pinName) {
    const info = (part.el.pinInfo || []).find(p => p.name === pinName);
    if (!info) return null;
    return { x: part.x + info.x, y: part.y + info.y };
  }

  _renderPins(part) {
    this._removePinDots(part.id);
    const pins = part.el.pinInfo || [];
    for (const pin of pins) {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('class', 'sim-pin-dot');
      dot.setAttribute('data-part-id', part.id);
      dot.setAttribute('data-pin', pin.name);
      dot.setAttribute('cx', part.x + pin.x);
      dot.setAttribute('cy', part.y + pin.y);
      dot.setAttribute('r', 6);

      dot.addEventListener('pointerenter', (e) => {
        dot.classList.add('hover');
        this._showTooltip(pin, part);
      });
      dot.addEventListener('pointerleave', () => {
        dot.classList.remove('hover');
        this.tooltip.style.display = 'none';
      });
      dot.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (this._wiring) {
          this._finishWire(part.id, pin.name);
        } else {
          this._startWire(part.id, pin.name);
        }
      });
      this.pinLayer.appendChild(dot);
    }
  }

  _removePinDots(partId) {
    this.pinLayer.querySelectorAll(`[data-part-id="${partId}"]`).forEach(d => d.remove());
  }

  _refreshPartPins(part) {
    const dots = this.pinLayer.querySelectorAll(`[data-part-id="${part.id}"]`);
    const pins = part.el.pinInfo || [];
    dots.forEach(dot => {
      const pin = pins.find(p => p.name === dot.getAttribute('data-pin'));
      if (pin) {
        dot.setAttribute('cx', part.x + pin.x);
        dot.setAttribute('cy', part.y + pin.y);
      }
    });
  }

  _showTooltip(pin, part) {
    const pos = this.pinPosition(part, pin.name);
    if (!pos) return;
    const label = pin.description ? `${pin.name} — ${pin.description}` : pin.name;
    this.tooltip.textContent = label;
    this.tooltip.style.display = 'block';
    const screenX = pos.x * this._scale + this._panX;
    const screenY = pos.y * this._scale + this._panY;
    this.tooltip.style.left = `${screenX + 10}px`;
    this.tooltip.style.top = `${screenY - 28}px`;
  }

  // ── Wires ────────────────────────────────────────────────────────────────

  addWire(from, to, color = null, id = null) {
    if (!id) id = `w${this.wires.length + 1}_${Date.now() % 100000}`;
    const dup = this.wires.find(w =>
      (w.from.partId === from.partId && w.from.pin === from.pin &&
       w.to.partId === to.partId && w.to.pin === to.pin) ||
      (w.from.partId === to.partId && w.from.pin === to.pin &&
       w.to.partId === from.partId && w.to.pin === from.pin));
    if (dup) return dup;

    if (!color) {
      color = COLOR_CYCLE[this._colorIdx % COLOR_CYCLE.length];
      this._colorIdx++;
      // Sensible colors for power pins
      const pinLabel = `${from.pin} ${to.pin}`;
      if (/GND/.test(pinLabel)) color = WIRE_COLORS.gnd;
      else if (/5V|3\.3V|VIN|VCC/.test(pinLabel)) color = WIRE_COLORS.power;
    }

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('class', 'sim-wire');
    pathEl.setAttribute('stroke', color);
    this.svg.appendChild(pathEl);

    const wire = { id, from, to, color, pathEl };

    pathEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      // Double-click or Alt+click: remove immediately. Single click: select
      // (then Delete/Backspace removes it, like Wokwi).
      if (e.detail === 2 || e.altKey) {
        this.removeWire(id);
        return;
      }
      this._selectWire(wire);
    });

    this.wires.push(wire);
    this._routeWire(wire);
    if (this.onChange) this.onChange();
    return wire;
  }

  removeWire(id) {
    const idx = this.wires.findIndex(w => w.id === id);
    if (idx < 0) return;
    if (this._selectedWire && this._selectedWire.id === id) this._selectedWire = null;
    this.wires[idx].pathEl.remove();
    this.wires.splice(idx, 1);
    if (this.onChange) this.onChange();
  }

  _routeWire(wire) {
    const fp = this.getPart(wire.from.partId);
    const tp = this.getPart(wire.to.partId);
    if (!fp || !tp) return;
    const p1 = this.pinPosition(fp, wire.from.pin);
    const p2 = this.pinPosition(tp, wire.to.pin);
    if (!p1 || !p2) return;

    // Wokwi-style: rounded orthogonal path leaving pins vertically
    const d = this._wirePath(p1, p2);
    wire.pathEl.setAttribute('d', d);
  }

  _wirePath(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
      return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    }
    const r = Math.min(8, Math.abs(dx) / 2, Math.abs(dy) / 2);
    const sx = Math.sign(dx), sy = Math.sign(dy);
    const midY = p1.y + dy / 2;
    // vertical → horizontal → vertical with rounded corners
    return [
      `M ${p1.x} ${p1.y}`,
      `L ${p1.x} ${midY - sy * r}`,
      `Q ${p1.x} ${midY} ${p1.x + sx * r} ${midY}`,
      `L ${p2.x - sx * r} ${midY}`,
      `Q ${p2.x} ${midY} ${p2.x} ${midY + sy * r}`,
      `L ${p2.x} ${p2.y}`,
    ].join(' ');
  }

  updateWires() {
    this.wires.forEach(w => this._routeWire(w));
  }

  _startWire(partId, pin) {
    const part = this.getPart(partId);
    const pos = this.pinPosition(part, pin);
    if (!pos) return;
    const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    temp.setAttribute('class', 'sim-wire sim-wire-temp');
    temp.setAttribute('stroke', '#4caf50');
    this.svg.appendChild(temp);
    this._wiring = { from: { partId, pin }, start: pos, temp };
  }

  _finishWire(partId, pin) {
    if (!this._wiring) return;
    const { from, temp } = this._wiring;
    temp.remove();
    this._wiring = null;
    if (from.partId === partId && from.pin === pin) return; // same pin
    this.addWire(from, { partId, pin });
  }

  _cancelWire() {
    if (!this._wiring) return;
    this._wiring.temp.remove();
    this._wiring = null;
  }

  // ── Selection ────────────────────────────────────────────────────────────

  _select(part) {
    if (this._selected) this._selected.el.classList.remove('selected');
    this._selected = part;
    if (part) {
      part.el.classList.add('selected');
      this._selectWire(null);
    }
  }

  _selectWire(wire) {
    if (this._selectedWire) this._selectedWire.pathEl.classList.remove('selected');
    this._selectedWire = wire;
    if (wire) {
      wire.pathEl.classList.add('selected');
      this._select(null);
    }
  }

  deleteSelected() {
    if (this._selectedWire) {
      this.removeWire(this._selectedWire.id);
      return;
    }
    if (this._selected) {
      this.removePart(this._selected.id);
      this._selected = null;
    }
  }

  // ── Pan / zoom ───────────────────────────────────────────────────────────

  _applyTransform() {
    this.viewport.style.transform =
      `translate(${this._panX}px, ${this._panY}px) scale(${this._scale})`;
  }

  _toWorld(clientX, clientY) {
    const rect = this.root.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this._panX) / this._scale,
      y: (clientY - rect.top - this._panY) / this._scale,
    };
  }

  zoomFit() {
    if (!this.parts.length) return;

    // Bounding box of all parts in world coordinates. Part elements live inside
    // the scaled viewport, so offsetWidth/Height give unscaled layout size.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.parts) {
      const w = p.el.offsetWidth || 100;
      const h = p.el.offsetHeight || 100;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + w);
      maxY = Math.max(maxY, p.y + h);
    }
    if (!isFinite(minX)) return;

    const pad = 40;
    const contentW = (maxX - minX) + pad * 2;
    const contentH = (maxY - minY) + pad * 2;
    const rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const scale = Math.min(rect.width / contentW, rect.height / contentH, 1.5);
    this._scale = Math.max(0.25, scale);
    // Center the content in the viewport
    this._panX = (rect.width - (maxX - minX) * this._scale) / 2 - minX * this._scale;
    this._panY = (rect.height - (maxY - minY) * this._scale) / 2 - minY * this._scale;
    this._applyTransform();
  }

  // ── Events ───────────────────────────────────────────────────────────────

  _bindEvents() {
    const root = this.root;

    root.addEventListener('pointermove', (e) => {
      if (this._drag) {
        const { part, startX, startY, px, py } = this._drag;
        const dx = (e.clientX - px) / this._scale;
        const dy = (e.clientY - py) / this._scale;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this._drag.moved = true;
        part.x = snap(startX + dx);
        part.y = snap(startY + dy);
        part.el.style.left = `${part.x}px`;
        part.el.style.top = `${part.y}px`;
        this._refreshPartPins(part);
        this.updateWires();
      } else if (this._pan) {
        this._panX = this._pan.panX + (e.clientX - this._pan.px);
        this._panY = this._pan.panY + (e.clientY - this._pan.py);
        this._applyTransform();
      } else if (this._wiring) {
        const w = this._toWorld(e.clientX, e.clientY);
        const { start, temp } = this._wiring;
        temp.setAttribute('d', this._wirePath(start, w));
      }
    });

    root.addEventListener('pointerup', () => {
      if (this._drag) {
        if (this._drag.moved && this.onChange) this.onChange();
        this._drag = null;
      }
      this._pan = null;
    });

    root.addEventListener('pointerdown', (e) => {
      // Pan on empty canvas (not a part, not a pin)
      if (e.target === root || e.target === this.viewport ||
          e.target === this.svg || e.target === this.pinLayer ||
          e.target.classList?.contains('sim-parts-layer')) {
        if (this._wiring) { this._cancelWire(); return; }
        this._select(null);
        this._selectWire(null);
        this._pan = { px: e.clientX, py: e.clientY, panX: this._panX, panY: this._panY };
      }
    });

    root.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = root.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const newScale = Math.max(0.25, Math.min(4, this._scale * factor));
      // Zoom around cursor
      this._panX = mx - ((mx - this._panX) / this._scale) * newScale;
      this._panY = my - ((my - this._panY) / this._scale) * newScale;
      this._scale = newScale;
      this._applyTransform();
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.closest('.CodeMirror')) return;
        if ((this._selected || this._selectedWire) && this.root.offsetParent !== null) {
          e.preventDefault();
          this.deleteSelected();
        }
      }
      if (e.key === 'Escape') {
        this._cancelWire();
        this._select(null);
        this._selectWire(null);
      }
    });
  }

  // ── Serialization (diagram.json compatible-ish) ──────────────────────────

  serialize() {
    return {
      version: 1,
      editor: 'impulse',
      parts: this.parts.map(p => ({
        type: p.type,
        id: p.id,
        top: p.y,
        left: p.x,
        attrs: p.attrs || {},
      })),
      connections: this.wires.map(w => [
        `${w.from.partId}:${w.from.pin}`,
        `${w.to.partId}:${w.to.pin}`,
        w.color,
        [],
      ]),
    };
  }

  deserialize(data) {
    this.clear();
    for (const pd of data.parts || []) {
      this.addPart(pd.type, pd.left, pd.top, pd.attrs || {}, pd.id);
    }
    // Wires need pinInfo, which is available after elements render
    requestAnimationFrame(() => {
      for (const conn of data.connections || []) {
        const [fromStr, toStr, color] = conn;
        const [fromPart, ...fromPinParts] = fromStr.split(':');
        const [toPart, ...toPinParts] = toStr.split(':');
        this.addWire(
          { partId: fromPart, pin: fromPinParts.join(':') },
          { partId: toPart, pin: toPinParts.join(':') },
          color || null
        );
      }
      requestAnimationFrame(() => this.updateWires());
    });
  }

  clear() {
    [...this.parts].forEach(p => this.removePart(p.id));
    this.wires.forEach(w => w.pathEl.remove());
    this.wires = [];
    this._nextId = {};
  }
}
