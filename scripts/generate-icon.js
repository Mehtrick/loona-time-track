// Generates luna icon as PNG and ICO for Electron
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const buildDir = join(__dirname, '..', 'build');

if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });

const SIZE = 256;

// Draw moon crescent into RGBA buffer
function drawMoon(size) {
  const buf = Buffer.alloc(size * size * 4, 0); // RGBA, transparent

  const cx1 = size * 0.5, cy1 = size * 0.5, r1 = size * 0.45; // main circle
  const cx2 = size * 0.65, cy2 = size * 0.40, r2 = size * 0.32; // cutout circle

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx1 = x - cx1, dy1 = y - cy1;
      const dx2 = x - cx2, dy2 = y - cy2;
      const inMain = (dx1 * dx1 + dy1 * dy1) <= r1 * r1;
      const inCut = (dx2 * dx2 + dy2 * dy2) <= r2 * r2;

      if (inMain && !inCut) {
        // Gradient from #b78aff to #6b1ae6 (top-left to bottom-right)
        const t = ((x / size) + (y / size)) / 2;
        const r = Math.round(183 + (107 - 183) * t); // b7 -> 6b
        const g = Math.round(138 + (26 - 138) * t);  // 8a -> 1a
        const b = Math.round(255 + (230 - 255) * t);  // ff -> e6
        const idx = (y * size + x) * 4;
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = 255;
      }
    }
  }
  return buf;
}

// Encode RGBA buffer as PNG
function encodePNG(rgba, width, height) {
  // Build raw scanlines (filter type 0 = None for each row)
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    raw[rowOffset] = 0; // filter: None
    rgba.copy(raw, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw);

  // PNG chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcData = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(crcData));
    return Buffer.concat([len, typeB, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = compressed;
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', iend),
  ]);
}

// CRC32 for PNG
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) | 0;
}

// Encode ICO (using embedded PNG)
function encodeICO(pngData, width, height) {
  // ICONDIR (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count: 1 image

  // ICONDIRENTRY (16 bytes)
  const entry = Buffer.alloc(16);
  entry[0] = width >= 256 ? 0 : width; // 0 means 256
  entry[1] = height >= 256 ? 0 : height;
  entry[2] = 0; // color palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngData.length, 8); // size of PNG data
  entry.writeUInt32LE(22, 12); // offset to PNG data (6 + 16 = 22)

  return Buffer.concat([header, entry, pngData]);
}

// Generate
console.log('Generating Luna icon...');
const rgba = drawMoon(SIZE);
const png = encodePNG(rgba, SIZE, SIZE);
const ico = encodeICO(png, SIZE, SIZE);

const pngPath = join(buildDir, 'icon.png');
const icoPath = join(buildDir, 'icon.ico');

createWriteStream(pngPath).end(png);
createWriteStream(icoPath).end(ico);

console.log(`Created: ${pngPath}`);
console.log(`Created: ${icoPath}`);
