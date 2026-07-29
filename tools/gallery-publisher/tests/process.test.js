import assert from "node:assert/strict";
import { access, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createVisualFingerprint,
  isVisualDuplicate,
  normalizeUploadExtension,
  processGalleryPhoto,
  visualFingerprintDistance,
  visualFingerprintMetrics,
} from "../lib/process.mjs";

test("publisher accepts the supported camera formats and rejects unsupported files", () => {
  assert.deepEqual(normalizeUploadExtension("fleet.JPG", "image/jpeg"), {
    extension: ".jpg",
    expectedMime: "image/jpeg",
  });
  assert.equal(normalizeUploadExtension("fleet.HEIC", "image/heic").extension, ".heic");
  assert.throws(() => normalizeUploadExtension("fleet.gif", "image/gif"), /不支持/);
  assert.throws(() => normalizeUploadExtension("fleet.jpg", "text/plain"), /不是可识别的图片/);
});

test("visual duplicate distance is exact, tolerant, and rejects incompatible buffers", () => {
  const original = Buffer.from([10, 20, 30, 40]);
  const closeCopy = Buffer.from([11, 19, 31, 39]);
  const different = Buffer.from([100, 120, 130, 140]);

  assert.equal(visualFingerprintDistance(original, original), 0);
  assert.equal(visualFingerprintDistance(original, closeCopy), 1);
  assert.ok(visualFingerprintDistance(original, different) > 2.5);
  assert.equal(visualFingerprintDistance(original, Buffer.from([1])), Number.POSITIVE_INFINITY);
});

test("local visual fingerprints detect resized or recompressed copies while separating another photo", async () => {
  const gallery = new URL("../../../assets/gallery/", import.meta.url);
  const [original, recompressed, different] = await Promise.all([
    createVisualFingerprint(new URL("team-37.png", gallery).pathname),
    createVisualFingerprint(new URL("optimized/team-37-1280.webp", gallery).pathname),
    createVisualFingerprint(new URL("team-01.jpg", gallery).pathname),
  ]);

  const duplicateMetrics = visualFingerprintMetrics(original, recompressed);
  assert.equal(isVisualDuplicate(original, recompressed), true);
  assert.ok(duplicateMetrics.normalizedLuminanceDistance < 0.12);
  assert.equal(isVisualDuplicate(original, different), false);
});

test("publisher creates the fallback, responsive WebP, and thumbnail without overwriting", async () => {
  const root = await mkdtemp(join(tmpdir(), "gvy-gallery-process-"));
  const source = new URL("../../../assets/gallery/team-01.jpg", import.meta.url).pathname;
  try {
    const item = await processGalleryPhoto({
      upload: { path: source, originalName: "fleet.jpg", mimeType: "image/jpeg" },
      number: 48,
      root,
    });

    assert.equal(item.number, 48);
    assert.equal(item.fallbackName, "team-48.jpg");
    assert.equal(item.has1920, false);
    assert.equal(item.createdPaths.length, 3);
    await Promise.all(item.createdPaths.map((path) => access(path)));
    assert.ok((await stat(join(root, "assets/gallery/optimized/team-48-1280.webp"))).size > 0);
    assert.ok((await stat(join(root, "assets/gallery/thumbs/team-48.jpg"))).size > 0);
    await assert.rejects(
      processGalleryPhoto({
        upload: { path: source, originalName: "fleet.jpg", mimeType: "image/jpeg" },
        number: 48,
        root,
      }),
      /目标文件已存在/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
