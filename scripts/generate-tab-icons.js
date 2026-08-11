/**
 * Generates the tab bar icons (black glyphs on transparent, template-rendered).
 * Usage: node scripts/generate-tab-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'images', 'tabIcons');

/* ---------- minimal PNG encoder ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- signed distance fields (shape = alpha coverage) ---------- */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Coverage alpha (0..1) for a signed distance `d` (negative inside). */
function coverage(d) {
  return clamp(0.5 - d, 0, 1);
}

function distSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby), 0, 1);
  const dx = px - (ax + t * abx);
  const dy = py - (ay + t * aby);
  return Math.hypot(dx, dy);
}

function distCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function distRoundedRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    r
  );
}

/* ---------- icon definitions (24x24 coordinate space) ---------- */

const ICONS = {
  migrate: [
    // smartphone outline
    (x, y) => coverage(Math.abs(distRoundedRect(x, y, 12, 12, 8, 11.5, 2.5)) - 0.85),
    // speaker slit
    (x, y) => coverage(distRoundedRect(x, y, 12, 3.9, 2.1, 0.45, 0.45)),
    // home indicator
    (x, y) => coverage(distRoundedRect(x, y, 12, 19.9, 2.5, 0.55, 0.55)),
  ],
  history: [
    // clock ring
    (x, y) => coverage(Math.abs(distCircle(x, y, 12, 12, 9.5) - 0.9)),
    // minute hand (12 o'clock)
    (x, y) => coverage(distSegment(x, y, 12, 12, 12, 5.2) - 0.85),
    // hour hand (3 o'clock)
    (x, y) => coverage(distSegment(x, y, 12, 12, 16.6, 12) - 0.85),
    // center cap
    (x, y) => coverage(distCircle(x, y, 12, 12, 1.6)),
  ],
  info: [
    // ring
    (x, y) => coverage(Math.abs(distCircle(x, y, 12, 12, 9.5) - 0.9)),
    // dot
    (x, y) => coverage(distCircle(x, y, 12, 7.1, 1.7)),
    // stem
    (x, y) => coverage(distRoundedRect(x, y, 12, 14.6, 1.7, 3.4, 1.2)),
  ],
};

function render(size, shapes) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = size / 24;
  const half = 0.5 / scale;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ux = (x + 0.5) / scale;
      const uy = (y + 0.5) / scale;
      let alpha = 0;
      for (const shape of shapes) {
        const a = shape(ux, uy);
        if (a > alpha) alpha = a;
      }
      const o = (y * size + x) * 4;
      buf[o] = 0;
      buf[o + 1] = 0;
      buf[o + 2] = 0;
      buf[o + 3] = Math.round(clamp(alpha * 255, 0, 255));
    }
  }
  return buf;
}

/* ---------- write files ---------- */

function writeIcon(name, shapes) {
  const out = [];
  const sizes = { '': 24, '@2x': 48, '@3x': 72 };
  for (const [suffix, size] of Object.entries(sizes)) {
    const buf = render(size, shapes);
    out.push([`${name}${suffix}.png`, encodePNG(size, size, buf)]);
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, shapes] of Object.entries(ICONS)) {
  for (const [fileName, buffer] of writeIcon(name, shapes)) {
    fs.writeFileSync(path.join(OUT_DIR, fileName), buffer);
    console.log(`wrote ${fileName} (${buffer.length} bytes)`);
  }
}
