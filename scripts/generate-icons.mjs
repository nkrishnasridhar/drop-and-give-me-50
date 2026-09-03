import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const payload = Buffer.concat([typeBytes, data]);
  const crc = crc32(payload);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  payload.copy(out, 4);
  out.writeUInt32BE(crc, 4 + payload.length);
  return out;
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = paint(x, y);
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function icon(size, insetRatio) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size * (0.5 - insetRatio);
  return png(size, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= radius * radius) return [255, 90, 31];
    return [10, 10, 10];
  });
}

const dir = path.resolve("public/icons");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "icon-192.png"), icon(192, 0.08));
writeFileSync(path.join(dir, "icon-512.png"), icon(512, 0.08));
writeFileSync(path.join(dir, "icon-maskable-512.png"), icon(512, 0.18));
writeFileSync(path.join(dir, "apple-touch-icon.png"), icon(180, 0.08));
console.log("Wrote PWA icons to public/icons");
