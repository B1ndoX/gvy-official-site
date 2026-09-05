import { deflateSync } from "node:zlib";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderGalleryButton } from "../lib/gallery-html.mjs";
import { processGalleryPhoto } from "../lib/process.mjs";

export function galleryFixture(count = 18) {
  const items = Array.from({ length: count }, (_, i) => renderGalleryButton({
    number: i + 1, fallbackName: `team-${String(i + 1).padStart(2, "0")}.png`, width: 1280, height: 720,
  }, i, { latestStart: i === 0 })).join("\n");
  return `<html><title>GVY fixture</title><img src="./assets/gallery/optimized/team-15-1280.webp"><div class="archive-grid" data-archive-grid data-archive-high-watermark="${count}">${items}</div></html>`;
}

// Synthetic, reproducible PNGs: tests must never depend on a member retaining a
// particular production photo. Native image processing is still exercised.
export function testPng(variant = 0) {
  function chunk(type, bytes) {
    const body = Buffer.concat([Buffer.from(type), bytes]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4); length.writeUInt32BE(bytes.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, checksum]);
  }
  const width = 1280, height = 720;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 3 + 1) + 1 + x * 3;
    const checker = (Math.floor(x / 160) + Math.floor(y / 120)) % 2 ? 230 : 15;
    pixels[offset] = variant ? checker : Math.floor(x * 255 / width);
    pixels[offset + 1] = variant ? checker : Math.floor(y * 255 / height);
    pixels[offset + 2] = variant ? checker : 100;
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

export async function withImageGallery(callback) {
  const root = await mkdtemp(join(tmpdir(), "gvy-image-fixture-"));
  try {
    for (let i = 1; i <= 2; i++) {
      const path = join(root, `input-${i}.png`);
      await writeFile(path, testPng(i - 1));
      await processGalleryPhoto({ root, number: i, upload: { path, originalName: "fixture.png", mimeType: "image/png" } });
    }
    await callback(root, galleryFixture(2));
  } finally { await rm(root, { recursive: true, force: true }); }
}
