// Generates the app icons as PNGs with no dependencies: a soft sage tile with
// a pale capsule. Run with `npm run icons`; output goes to public/.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [124, 148, 128] // muted sage
const FG = [244, 241, 234] // warm off-white
const ACCENT = [214, 200, 178] // sand

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const SS = 4 // supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa
        }
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = a ? Math.round(r / a) : 0
      raw[o + 1] = a ? Math.round(g / a) : 0
      raw[o + 2] = a ? Math.round(b / a) : 0
      raw[o + 3] = Math.round((a / (SS * SS)) * 255)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Signed distance to a capsule from (ax,ay) to (bx,by) with radius r.
function capsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)))
  return Math.hypot(pax - bax * h, pay - bay * h) - r
}

// scale < 1 shrinks the motif to keep it inside the maskable safe zone.
function art(scale, rounded) {
  return (u, v) => {
    if (rounded) {
      const rad = 0.22, cx = Math.min(Math.max(u, rad), 1 - rad), cy = Math.min(Math.max(v, rad), 1 - rad)
      if (Math.hypot(u - cx, v - cy) > rad) return [0, 0, 0, 0]
    }
    const x = 0.5 + (u - 0.5) / scale, y = 0.5 + (v - 0.5) / scale
    const d = capsule(x, y, 0.3, 0.7, 0.7, 0.3, 0.16)
    if (d < 0) {
      // Two halves of the capsule: off-white and sand.
      return (x - y < 0 ? [...FG, 1] : [...ACCENT, 1])
    }
    return [...BG, 1]
  }
}

writeFileSync('public/pwa-192x192.png', png(192, art(1, false)))
writeFileSync('public/pwa-512x512.png', png(512, art(1, false)))
writeFileSync('public/maskable-512x512.png', png(512, art(0.72, false)))
writeFileSync('public/apple-touch-icon.png', png(180, art(1, false)))
writeFileSync('public/favicon.png', png(64, art(1, true)))
console.log('icons written to public/')
