#!/usr/bin/env node
/**
 * Generates the four placeholder face PNGs used by "Road to Colombia".
 *
 * Why a hand-rolled generator instead of shipping binary art? The four
 * faces are throwaway placeholders (see src/assets/faces/README.md for how
 * to replace them with real artwork), and generating them from code means
 * they can be regenerated or tweaked without any image-editing tooling or
 * network access. It draws simple cartoon shapes onto a raw RGBA buffer,
 * supersamples 2x for cheap anti-aliasing, and encodes a standard 8-bit
 * RGBA PNG using only Node's built-in `zlib` module (no dependencies).
 *
 * Usage: node scripts/generate-placeholder-faces.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'assets', 'faces');
const SIZE = 256; // final PNG size (documented, see faces/README.md)
const SS = 2; // supersampling factor for anti-aliasing
const CANVAS = SIZE * SS;

// ---------------------------------------------------------------------
// Minimal software rasterizer (premultiplied-alpha RGBA float buffer)
// ---------------------------------------------------------------------
class Canvas {
  constructor(size) {
    this.size = size;
    this.data = new Float64Array(size * size * 4); // premultiplied RGBA, 0..255
  }

  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size || a <= 0) return;
    const i = (y * this.size + x) * 4;
    const inv = 1 - a;
    this.data[i] = r * a + this.data[i] * inv;
    this.data[i + 1] = g * a + this.data[i + 1] * inv;
    this.data[i + 2] = b * a + this.data[i + 2] * inv;
    this.data[i + 3] = a * 255 + this.data[i + 3] * inv;
  }

  fillCircle(cx, cy, r, [cr, cg, cb, ca]) {
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(this.size - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(this.size - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const edge = r - d;
        if (edge <= -1) continue;
        const cov = Math.max(0, Math.min(1, edge + 0.5));
        if (cov > 0) this.blend(x, y, cr, cg, cb, ca * cov);
      }
    }
  }

  fillRing(cx, cy, r, width, [cr, cg, cb, ca]) {
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(this.size - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(this.size - 1, Math.ceil(cy + r + 1));
    const innerR = r - width;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const outerCov = Math.max(0, Math.min(1, r - d + 0.5));
        const innerCov = Math.max(0, Math.min(1, d - innerR + 0.5));
        const cov = outerCov * innerCov;
        if (cov > 0) this.blend(x, y, cr, cg, cb, ca * cov);
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, color) {
    const x0 = Math.max(0, Math.floor(cx - rx - 1));
    const x1 = Math.min(this.size - 1, Math.ceil(cx + rx + 1));
    const y0 = Math.max(0, Math.floor(cy - ry - 1));
    const y1 = Math.min(this.size - 1, Math.ceil(cy + ry + 1));
    const [cr, cg, cb, ca] = color;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = Math.hypot(nx, ny);
        const edge = (1 - d) * Math.min(rx, ry);
        const cov = Math.max(0, Math.min(1, edge + 0.5));
        if (cov > 0) this.blend(x, y, cr, cg, cb, ca * cov);
      }
    }
  }

  // Even-odd scanline polygon fill with 4x vertical supersampling per pixel
  // row for softer edges on diagonal hair/hat shapes.
  fillPolygon(points, color) {
    const [cr, cg, cb, ca] = color;
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const [x, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(this.size - 1, Math.ceil(maxY));
    minX = Math.max(0, Math.floor(minX));
    maxX = Math.min(this.size - 1, Math.ceil(maxX));
    const coverage = new Float64Array(maxX - minX + 1);
    const SUB = 4;
    for (let y = minY; y <= maxY; y++) {
      coverage.fill(0);
      for (let s = 0; s < SUB; s++) {
        const sy = y + (s + 0.5) / SUB;
        const xs = [];
        for (let i = 0; i < points.length; i++) {
          const [x1, y1] = points[i];
          const [x2, y2] = points[(i + 1) % points.length];
          if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) {
            const t = (sy - y1) / (y2 - y1);
            xs.push(x1 + t * (x2 - x1));
          }
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i < xs.length; i += 2) {
          const xa = xs[i];
          const xb = xs[i + 1];
          if (xb === undefined) break;
          const xaC = Math.max(minX, xa);
          const xbC = Math.min(maxX + 1, xb);
          for (let x = Math.floor(xaC); x < xbC; x++) {
            const left = Math.max(x, xaC);
            const right = Math.min(x + 1, xbC);
            const cov = Math.max(0, right - left);
            coverage[x - minX] += (cov * 1) / SUB;
          }
        }
      }
      for (let x = minX; x <= maxX; x++) {
        const cov = coverage[x - minX];
        if (cov > 0) this.blend(x, y, cr, cg, cb, ca * Math.min(1, cov));
      }
    }
  }

  strokeLine(x1, y1, x2, y2, width, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (width / 2);
    const ny = (dx / len) * (width / 2);
    this.fillPolygon(
      [
        [x1 + nx, y1 + ny],
        [x2 + nx, y2 + ny],
        [x2 - nx, y2 - ny],
        [x1 - nx, y1 - ny],
      ],
      color
    );
    // round caps
    this.fillCircle(x1, y1, width / 2, color);
    this.fillCircle(x2, y2, width / 2, color);
  }

  // Downsample by integer factor (box filter over premultiplied data),
  // returns a new plain (non-premultiplied) Uint8ClampedArray RGBA buffer.
  downsample(factor) {
    const outSize = this.size / factor;
    const out = new Uint8ClampedArray(outSize * outSize * 4);
    const area = factor * factor;
    for (let y = 0; y < outSize; y++) {
      for (let x = 0; x < outSize; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let sy = 0; sy < factor; sy++) {
          for (let sx = 0; sx < factor; sx++) {
            const i = ((y * factor + sy) * this.size + (x * factor + sx)) * 4;
            r += this.data[i];
            g += this.data[i + 1];
            b += this.data[i + 2];
            a += this.data[i + 3];
          }
        }
        r /= area;
        g /= area;
        b /= area;
        a /= area;
        const outA = a / 255;
        const o = (y * outSize + x) * 4;
        out[o] = outA > 0.001 ? r / outA : 0;
        out[o + 1] = outA > 0.001 ? g / outA : 0;
        out[o + 2] = outA > 0.001 ? b / outA : 0;
        out[o + 3] = a;
      }
    }
    return { data: out, size: outSize };
  }
}

function rgba(hex, a = 1) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

// ---------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA, no external dependencies)
// ---------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgbaBuffer, size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter type: none
    rgbaBuffer.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------
// Face drawing
// ---------------------------------------------------------------------
function drawBaseHead(c, cx, cy, r, skin) {
  c.fillCircle(cx, cy, r, skin);
  // simple ear bumps
  c.fillCircle(cx - r * 0.96, cy + r * 0.05, r * 0.16, skin);
  c.fillCircle(cx + r * 0.96, cy + r * 0.05, r * 0.16, skin);
}

function drawEyes(c, cx, cy, spacing, eyeY, eyeR, irisColor, opts = {}) {
  const { lookOffset = 0 } = opts;
  for (const side of [-1, 1]) {
    const ex = cx + side * spacing;
    c.fillEllipse(ex, eyeY, eyeR, eyeR * 1.05, rgba('#ffffff'));
    c.fillCircle(ex + side * lookOffset, eyeY, eyeR * 0.55, irisColor);
    c.fillCircle(ex + side * lookOffset, eyeY, eyeR * 0.24, rgba('#1a1410'));
    c.fillCircle(ex + side * lookOffset - eyeR * 0.18, eyeY - eyeR * 0.22, eyeR * 0.14, rgba('#ffffff'));
  }
}

function drawEyebrows(c, cx, cy, spacing, eyeY, eyeR, color, angle = 0.15) {
  for (const side of [-1, 1]) {
    const ex = cx + side * spacing;
    const y = eyeY - eyeR * 2.1;
    c.strokeLine(
      ex - eyeR * 1.1,
      y + side * angle * eyeR,
      ex + eyeR * 1.1,
      y - side * angle * eyeR,
      eyeR * 0.5,
      color
    );
  }
}

function drawSmile(c, cx, cy, width, thickness, color) {
  const points = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = cx - width / 2 + t * width;
    const y = cy + Math.sin(t * Math.PI) * (width * 0.34);
    points.push([x, y]);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const x = cx - width / 2 + t * width;
    const y = cy + Math.sin(t * Math.PI) * (width * 0.34) + thickness;
    points.push([x, y]);
  }
  c.fillPolygon(points, color);
}

function drawNose(c, cx, cy, size, color) {
  c.fillPolygon(
    [
      [cx - size * 0.3, cy - size],
      [cx + size * 0.15, cy - size * 0.2],
      [cx + size * 0.05, cy + size * 0.35],
      [cx - size * 0.45, cy + size * 0.35],
    ],
    color
  );
}

const faces = [
  {
    file: 'face_1.png',
    name: 'Sol',
    draw(c, cx, cy, r) {
      const skin = rgba('#c98455');
      drawBaseHead(c, cx, cy, r, skin);
      // curly hair: cluster of circles around the top of the head
      const hairColor = rgba('#2b1a12');
      const curlR = r * 0.26;
      for (let i = 0; i < 10; i++) {
        const angle = Math.PI + (i / 9) * Math.PI;
        const hx = cx + Math.cos(angle) * r * 0.92;
        const hy = cy + Math.sin(angle) * r * 0.92 * 0.95;
        c.fillCircle(hx, hy, curlR, hairColor);
      }
      c.fillCircle(cx, cy - r * 0.98, r * 0.42, hairColor);
      drawEyebrows(c, cx, cy, r * 0.4, cy - r * 0.02, r * 0.16, hairColor, 0.2);
      drawEyes(c, cx, cy, r * 0.4, cy - r * 0.02, r * 0.16, rgba('#4a2c17'));
      drawNose(c, cx, cy + r * 0.28, r * 0.22, rgba('#a5643a'));
      drawSmile(c, cx, cy + r * 0.52, r * 0.62, r * 0.14, rgba('#5a2a1e'));
      // rosy cheeks
      c.fillCircle(cx - r * 0.55, cy + r * 0.32, r * 0.16, rgba('#e0654f', 0.35));
      c.fillCircle(cx + r * 0.55, cy + r * 0.32, r * 0.16, rgba('#e0654f', 0.35));
    },
  },
  {
    file: 'face_2.png',
    name: 'Mango',
    draw(c, cx, cy, r) {
      const skin = rgba('#f2c9a0');
      drawBaseHead(c, cx, cy, r, skin);
      // short spiky orange hair (mohawk-ish triangles)
      const hairColor = rgba('#e8632c');
      const spikeCount = 7;
      for (let i = 0; i < spikeCount; i++) {
        const t = i / (spikeCount - 1);
        const bx = cx - r * 0.75 + t * r * 1.5;
        const baseY = cy - r * 0.72;
        const tipY = baseY - r * (0.28 + 0.18 * Math.sin(t * Math.PI));
        c.fillPolygon(
          [
            [bx - r * 0.14, baseY],
            [bx + r * 0.14, baseY],
            [bx, tipY],
          ],
          hairColor
        );
      }
      drawEyebrows(c, cx, cy, r * 0.4, cy - r * 0.02, r * 0.16, rgba('#a8431a'), 0.12);
      drawEyes(c, cx, cy, r * 0.4, cy - r * 0.02, r * 0.17, rgba('#2f7d3c'), { lookOffset: 2 });
      // freckles
      const freckle = rgba('#c98552', 0.7);
      const freckleOffsets = [
        [-0.5, 0.2],
        [-0.36, 0.28],
        [-0.22, 0.22],
        [0.5, 0.2],
        [0.36, 0.28],
        [0.22, 0.22],
      ];
      for (const [fx, fy] of freckleOffsets) {
        c.fillCircle(cx + fx * r, cy + fy * r, r * 0.025, freckle);
      }
      drawNose(c, cx, cy + r * 0.28, r * 0.2, rgba('#d9a276'));
      drawSmile(c, cx, cy + r * 0.5, r * 0.58, r * 0.13, rgba('#8a3f22'));
    },
  },
  {
    file: 'face_3.png',
    name: 'Nube',
    draw(c, cx, cy, r) {
      const skin = rgba('#8a5a3c');
      drawBaseHead(c, cx, cy, r, skin);
      const hairColor = rgba('#171310');
      // hair bun at top-back + coverage
      c.fillEllipse(cx, cy - r * 0.62, r * 0.98, r * 0.55, hairColor);
      c.fillCircle(cx, cy - r * 1.18, r * 0.3, hairColor);
      // purple headband
      c.fillPolygon(
        [
          [cx - r * 0.95, cy - r * 0.42],
          [cx + r * 0.95, cy - r * 0.42],
          [cx + r * 0.95, cy - r * 0.24],
          [cx - r * 0.95, cy - r * 0.24],
        ],
        rgba('#7b3fb0')
      );
      drawEyebrows(c, cx, cy, r * 0.4, cy - r * 0.02, r * 0.16, hairColor, 0.15);
      drawEyes(c, cx, cy, r * 0.4, cy - r * 0.02, r * 0.17, rgba('#2e6fb0'));
      // simple round glasses: a dark ring (outer minus inner circle) per eye
      const glassesColor = rgba('#1a1a1a');
      const glassesR = r * 0.22;
      const glassesRingWidth = r * 0.035;
      for (const side of [-1, 1]) {
        const ex = cx + side * r * 0.4;
        c.fillRing(ex, cy - r * 0.02, glassesR, glassesRingWidth, glassesColor);
      }
      c.strokeLine(
        cx - r * 0.4 + glassesR,
        cy - r * 0.02,
        cx + r * 0.4 - glassesR,
        cy - r * 0.02,
        glassesRingWidth,
        glassesColor
      );
      drawNose(c, cx, cy + r * 0.28, r * 0.2, rgba('#6f4530'));
      drawSmile(c, cx, cy + r * 0.5, r * 0.55, r * 0.13, rgba('#3d2216'));
    },
  },
  {
    file: 'face_4.png',
    name: 'Café',
    draw(c, cx, cy, r) {
      const skin = rgba('#d9a468');
      drawBaseHead(c, cx, cy, r, skin);
      const hairColor = rgba('#241d16');
      // cap: rounded top + brim
      c.fillEllipse(cx, cy - r * 0.7, r * 1.02, r * 0.5, rgba('#2f5fa8'));
      c.fillPolygon(
        [
          [cx - r * 0.15, cy - r * 0.5],
          [cx + r * 0.95, cy - r * 0.42],
          [cx + r * 0.95, cy - r * 0.3],
          [cx - r * 0.15, cy - r * 0.34],
        ],
        rgba('#244a86')
      );
      drawEyebrows(c, cx, cy, r * 0.4, cy - r * 0.02, r * 0.16, hairColor, 0.1);
      drawEyes(c, cx, cy, r * 0.4, cy - r * 0.02, r * 0.16, rgba('#5a3a20'));
      drawNose(c, cx, cy + r * 0.28, r * 0.22, rgba('#b17d47'));
      // mustache
      c.fillPolygon(
        [
          [cx - r * 0.34, cy + r * 0.42],
          [cx - r * 0.06, cy + r * 0.34],
          [cx, cy + r * 0.4],
          [cx + r * 0.06, cy + r * 0.34],
          [cx + r * 0.34, cy + r * 0.42],
          [cx + r * 0.3, cy + r * 0.5],
          [cx, cy + r * 0.46],
          [cx - r * 0.3, cy + r * 0.5],
        ],
        hairColor
      );
      drawSmile(c, cx, cy + r * 0.56, r * 0.5, r * 0.1, rgba('#6b3a20'));
    },
  },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const face of faces) {
  const canvas = new Canvas(CANVAS);
  const cx = CANVAS / 2;
  const cy = CANVAS / 2 + CANVAS * 0.02;
  const r = CANVAS * 0.36;
  face.draw(canvas, cx, cy, r);
  const { data, size } = canvas.downsample(SS);
  const png = encodePng(Buffer.from(data.buffer, data.byteOffset, data.byteLength), size);
  const outPath = join(OUT_DIR, face.file);
  writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${face.name}, ${size}x${size})`);
}

console.log('Done. Replace any of these PNGs with real artwork at any time — see src/assets/faces/README.md.');
