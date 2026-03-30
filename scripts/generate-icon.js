/**
 * Generates Loona icon assets for all platforms:
 *   build/icon.png  – 1024×1024 (macOS source + Linux AppImage)
 *   build/icon.ico  – multi-size ICO (16/32/48/64/128/256) for Windows + NSIS installer
 *
 * No external dependencies – pure Node.js only.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildDir = join(__dirname, '..', 'build')
if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true })

// ─── Draw moon crescent (matches loona.svg) ───────────────────────────────────
// Outer circle fills the icon; inner circle cuts out the crescent shape.
// Gradient: #b78aff (top-left) → #6b1ae6 (bottom-right)
function drawMoon(size) {
  const buf = Buffer.alloc(size * size * 4, 0) // transparent RGBA

  // Add 2px padding so the circle doesn't touch the edge
  const pad   = size * 0.05
  const inner = size - pad * 2

  const cx1 = size * 0.5,  cy1 = size * 0.5,  r1 = inner * 0.5 * 0.9   // main circle (45% of size → scaled)
  const cx2 = size * 0.65, cy2 = size * 0.40, r2 = inner * 0.5 * 0.635 // cutout circle

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx1 = x - cx1, dy1 = y - cy1
      const dx2 = x - cx2, dy2 = y - cy2

      const inMain = dx1*dx1 + dy1*dy1 <= r1*r1
      const inCut  = dx2*dx2 + dy2*dy2 <= r2*r2

      if (inMain && !inCut) {
        const t   = (x / size + y / size) / 2
        const r   = Math.round(183 + (107 - 183) * t)
        const g   = Math.round(138 + (26  - 138) * t)
        const b   = Math.round(255 + (230 - 255) * t)
        const idx = (y * size + x) * 4
        buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b; buf[idx+3] = 255
      }
    }
  }
  return buf
}

// ─── PNG encoder ─────────────────────────────────────────────────────────────
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
  }
  return (crc ^ 0xFFFFFFFF) | 0
}

function encodePNG(rgba, w, h) {
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0                                               // filter: None
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const comp = zlib.deflateSync(raw, { level: 9 })

  function chunk(type, data) {
    const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length)
    const typeBuf = Buffer.from(type)
    const crcBuf  = Buffer.alloc(4)
    crcBuf.writeInt32BE(crc32(Buffer.concat([typeBuf, data])))
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', comp),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── ICO encoder (multiple embedded PNG images) ───────────────────────────────
function encodeICO(sizes) {
  const images = sizes.map(s => ({ size: s, png: encodePNG(drawMoon(s), s, s) }))
  const count  = images.length
  const dirOffset = 6 + count * 16   // ICONDIR header + ICONDIRENTRY array

  const icondir = Buffer.alloc(6)
  icondir.writeUInt16LE(0, 0)        // reserved
  icondir.writeUInt16LE(1, 2)        // type: icon (1)
  icondir.writeUInt16LE(count, 4)

  let dataOffset = dirOffset
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size    // width  (0 = 256)
    e[1] = size >= 256 ? 0 : size    // height (0 = 256)
    e[2] = 0                         // color count (0 = >8bpp)
    e[3] = 0                         // reserved
    e.writeUInt16LE(1, 4)            // color planes
    e.writeUInt16LE(32, 6)           // bits per pixel
    e.writeUInt32LE(png.length, 8)   // size of image data
    e.writeUInt32LE(dataOffset, 12)  // offset to image data
    dataOffset += png.length
    return e
  })

  return Buffer.concat([icondir, ...entries, ...images.map(i => i.png)])
}

// ─── Generate ─────────────────────────────────────────────────────────────────
console.log('Generating Loona icons...')

const rgba1024 = drawMoon(1024)
const png1024  = encodePNG(rgba1024, 1024, 1024)
writeFileSync(join(buildDir, 'icon.png'), png1024)
console.log('✓ build/icon.png  (1024×1024, used by Linux AppImage + macOS source)')

const ico = encodeICO([16, 32, 48, 64, 128, 256])
writeFileSync(join(buildDir, 'icon.ico'), ico)
console.log('✓ build/icon.ico  (16/32/48/64/128/256 px, used by Windows + NSIS installer)')
