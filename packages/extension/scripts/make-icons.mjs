// Generates the extension icons (a page with one line blacked out: the idea of redaction).
// Run once with `node scripts/make-icons.mjs`; the PNGs in icons/ are committed.
import { mkdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../icons/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const BLUE = [26, 86, 219];
const WHITE = [255, 255, 255];
const GREY = [190, 198, 212];
const BLACK = [24, 28, 36];

/** Is (x, y), in 0..1 icon space, inside a rounded rectangle? */
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Colour at a point, or null for transparent. */
function sample(x, y) {
  if (!inRoundRect(x, y, 0.04, 0.04, 0.96, 0.96, 0.2)) return null;
  // The white page.
  if (inRoundRect(x, y, 0.2, 0.16, 0.8, 0.84, 0.07)) {
    if (inRoundRect(x, y, 0.3, 0.28, 0.7, 0.36, 0.03)) return GREY;
    if (inRoundRect(x, y, 0.3, 0.46, 0.7, 0.58, 0.03)) return BLACK; // the redacted line
    if (inRoundRect(x, y, 0.3, 0.68, 0.58, 0.76, 0.03)) return GREY;
    return WHITE;
  }
  return BLUE;
}

function render(size) {
  const ss = 4; // supersampling for smooth edges
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 1;
          }
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      const n = ss * ss;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  return raw;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body) >>> 0, body.length + 4);
  return out;
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(render(size), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(`${OUT}icon-${size}.png`, png(size));
  console.log(`icons/icon-${size}.png`);
}
