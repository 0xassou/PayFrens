#!/usr/bin/env node
/**
 * Generates the app icon and splash image referenced by the manifest.
 *
 * These are placeholders — a wordmark "P" on the Base blue — so that
 * farcaster.json resolves to real images from the first deploy instead of
 * 404ing. Replace `web/public/icon.png` and `web/public/splash.png` with real
 * artwork before launch; nothing in the code depends on how they look.
 *
 * Written as a tiny PNG encoder rather than pulling in an image library: it is
 * a build-time script that runs once, and a dependency for two flat images is
 * not worth it.
 */
import {deflateSync} from "node:zlib";
import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "web/public");

const BASE_BLUE = [0x00, 0x52, 0xff];
const INK = [0x0a, 0x0e, 0x1a];
const WHITE = [0xff, 0xff, 0xff];

/** Strokes of a capital "P", as fractions of the glyph box. */
const P_STROKES = [
  [0.0, 0.0, 0.26, 1.0], // stem
  [0.0, 0.0, 1.0, 0.24], // top bar
  [0.74, 0.0, 1.0, 0.58], // bowl right
  [0.0, 0.42, 1.0, 0.58], // middle bar
];

function drawIcon(size, background, glyph, glyphScale, radius) {
  const pixels = Buffer.alloc(size * size * 3);

  const paint = (x, y, colour) => {
    const offset = (y * size + x) * 3;
    pixels[offset] = colour[0];
    pixels[offset + 1] = colour[1];
    pixels[offset + 2] = colour[2];
  };

  // Background, with rounded corners left transparent-ish by painting ink.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      paint(x, y, insideRoundedRect(x, y, size, radius) ? background : INK);
    }
  }

  // Centred glyph box.
  const box = size * glyphScale;
  const originX = (size - box * 0.78) / 2;
  const originY = (size - box) / 2;

  for (const [x0, y0, x1, y1] of P_STROKES) {
    const left = Math.round(originX + x0 * box * 0.78);
    const right = Math.round(originX + x1 * box * 0.78);
    const top = Math.round(originY + y0 * box);
    const bottom = Math.round(originY + y1 * box);

    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) paint(x, y, glyph);
      }
    }
  }

  return encodePng(size, size, pixels);
}

function insideRoundedRect(x, y, size, radius) {
  const corners = [
    [radius, radius],
    [size - radius, radius],
    [radius, size - radius],
    [size - radius, size - radius],
  ];

  const nearCorner =
    (x < radius || x > size - radius) && (y < radius || y > size - radius);
  if (!nearCorner) return true;

  return corners.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2);
}

/** Minimal truecolour PNG: signature, IHDR, IDAT, IEND. */
function encodePng(width, height, rgb) {
  const raw = Buffer.alloc(height * (width * 3 + 1));

  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, {level: 9})),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

mkdirSync(publicDir, {recursive: true});

writeFileSync(join(publicDir, "icon.png"), drawIcon(1024, BASE_BLUE, WHITE, 0.5, 224));
writeFileSync(join(publicDir, "splash.png"), drawIcon(512, INK, BASE_BLUE, 0.42, 0));

console.log("Wrote web/public/icon.png and web/public/splash.png");
