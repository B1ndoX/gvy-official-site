import assert from "node:assert/strict";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(new URL("..", import.meta.url).pathname);
const skipMediaMetadata = process.env.GVY_SKIP_MEDIA_METADATA === "1";
const productionMedia = JSON.parse(readFileSync(resolve(root, "config/production-media.json"), "utf8"));
function activeAsset(assets, prefix) {
  const matches = assets.filter((name) => name.startsWith(prefix) && name.endsWith(".mp4"));
  assert.equal(matches.length, 1, `${prefix} must have exactly one active encode`);
  return matches[0];
}
const heroPath = (id, tier) => `assets/hero-random/v2/${activeAsset(productionMedia.heroAssets, `fleet-hero-${id}-${tier}-v`)}`;
const operationPath = (name, tier) => `assets/operations-motion/v2/${activeAsset(productionMedia.operationAssets, `${name}-${tier}-v`)}`;

const outputs = [
  {
    id: "01-1080p",
    video: heroPath("01", "1080p"),
    duration: "00:00:37.30",
    resolution: "1920x1080",
    maxBytes: 25 * 1024 * 1024,
  },
  {
    id: "01-mobile-720p",
    video: heroPath("01", "mobile-720p"),
    duration: "00:00:37.30",
    resolution: "1280x720",
    maxBytes: 10 * 1024 * 1024,
  },
  {
    id: "02-1080p",
    video: heroPath("02", "1080p"),
    duration: "00:00:28.33",
    resolution: "1920x1080",
    maxBytes: 25 * 1024 * 1024,
  },
  {
    id: "02-mobile-720p",
    video: heroPath("02", "mobile-720p"),
    duration: "00:00:28.33",
    resolution: "1280x720",
    maxBytes: 10 * 1024 * 1024,
  },
  {
    id: "02-1440p",
    video: heroPath("02", "1440p"),
    duration: "00:00:28.33",
    resolution: "2560x1440",
    maxBytes: 25 * 1024 * 1024,
  },
  {
    id: "03-1080p",
    video: heroPath("03", "1080p"),
    duration: "00:00:31.00",
    resolution: "1920x1080",
    maxBytes: 32 * 1024 * 1024,
  },
  {
    id: "03-mobile-720p",
    video: heroPath("03", "mobile-720p"),
    duration: "00:00:31.00",
    resolution: "1280x720",
    maxBytes: 14 * 1024 * 1024,
  },
];

function inspectMedia(path) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-i", path], { encoding: "utf8" });
  if (result.error) {
    throw new Error(
      `ffmpeg is required for full media metadata verification: ${result.error.message}`,
    );
  }
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

for (const output of outputs) {
  test(`hero ${output.id} video meets the production media contract`, () => {
    const path = resolve(root, output.video);
    assert.equal(existsSync(path), true, `${output.video} must exist`);
    assert.ok(statSync(path).size > 1_000_000, "video must not be a placeholder");
    assert.ok(statSync(path).size < output.maxBytes, "video must remain within its delivery budget");
    if (skipMediaMetadata) return;

    const metadata = inspectMedia(path);
    assert.match(metadata, new RegExp(`Duration: ${output.duration.replaceAll(".", "\\.")}`));
    assert.match(metadata, new RegExp(`Video: h264 .*yuv420p.*${output.resolution}`));
    assert.match(metadata, /SAR 1:1 DAR 16:9/);
    assert.match(metadata, /30 fps/);
    assert.doesNotMatch(metadata, /Audio:/);
  });

}

test("hero 02 poster is a lightweight 1440p WebP", () => {
  const path = resolve(root, "assets/hero-random/v2/fleet-hero-02-poster-1440p-v3.webp");
  assert.equal(existsSync(path), true);
  assert.ok(statSync(path).size > 50_000);
  assert.ok(statSync(path).size < 250_000);
  if (skipMediaMetadata) return;
  assert.match(inspectMedia(path), /Video: webp, .*2560x1440/);
});

test("hero 01 poster is a lightweight 1080p WebP", () => {
  const path = resolve(root, "assets/hero-random/v2/fleet-hero-01-poster-v2.webp");
  assert.equal(existsSync(path), true);
  assert.ok(statSync(path).size > 40_000);
  assert.ok(statSync(path).size < 250_000);
  if (skipMediaMetadata) return;
  assert.match(inspectMedia(path), /Video: webp, .*1920x1080/);
});

test("hero 03 poster is a lightweight 1080p WebP", () => {
  const path = resolve(root, "assets/hero-random/v2/fleet-hero-03-poster-v1.webp");
  assert.equal(existsSync(path), true);
  assert.ok(statSync(path).size > 40_000);
  assert.ok(statSync(path).size < 250_000);
  if (skipMediaMetadata) return;
  assert.match(inspectMedia(path), /Video: webp, .*1920x1080/);
});

const operationClips = [
  { name: "combat", duration: "00:00:08.00" },
  { name: "industry", duration: "00:00:07.00" },
  { name: "logistics", duration: "00:00:08.00" },
  { name: "exploration", duration: "00:00:08.00" },
];

for (const clip of operationClips) {
  test(`operation ${clip.name} mobile video is a sharp lazy-load encode`, () => {
    const path = resolve(root, operationPath(clip.name, "mobile-1280"));
    assert.equal(existsSync(path), true);
    assert.ok(statSync(path).size > 1 * 1024 * 1024, "mobile clip must not be a placeholder");
    assert.ok(statSync(path).size < 7 * 1024 * 1024, "mobile clip must remain within its per-scene budget");
    if (skipMediaMetadata) return;

    const metadata = inspectMedia(path);
    assert.match(metadata, new RegExp(`Duration: ${clip.duration.replaceAll(".", "\\.")}`));
    assert.match(metadata, /Video: h264 .*yuv420p.*1280x550/);
    assert.match(metadata, /SAR 1:1 DAR 128:55/);
    assert.match(metadata, /30 fps/);
    assert.doesNotMatch(metadata, /Audio:/);
  });
}

for (const clip of operationClips) {
  for (const tier of [
    { width: 1920, resolution: "1920x824" },
    { width: 2560, resolution: "2560x1098" },
  ]) {
    test(`operation ${clip.name} ${tier.width} video preserves the approved short clip at high quality`, () => {
      const path = resolve(root, operationPath(clip.name, tier.width));
      assert.equal(existsSync(path), true);
      // Size is a delivery budget, not a visual-quality measurement. Re-encoding
      // requires full-frame quality comparison and visual review before adoption.
      assert.ok(statSync(path).size > 3 * 1024 * 1024, "clip must retain its existing delivery bounds");
      assert.ok(statSync(path).size < 21 * 1024 * 1024, "clip must remain within its lazy-load budget");
      if (skipMediaMetadata) return;

      const metadata = inspectMedia(path);
      assert.match(metadata, new RegExp(`Duration: ${clip.duration.replaceAll(".", "\\.")}`));
      assert.match(metadata, new RegExp(`Video: h264 .*yuv420p.*${tier.resolution}`));
      assert.match(metadata, /30 fps/);
      assert.doesNotMatch(metadata, /Audio:/);
    });
  }
}

test("every active MP4 places its playback metadata before video data for progressive startup", () => {
  const paths = [...outputs.map(({ video }) => video),
    ...productionMedia.operationAssets.map((name) => `assets/operations-motion/v2/${name}`)];
  for (const relative of paths) {
    const path = resolve(root, relative);
    const size = statSync(path).size;
    const fd = openSync(path, "r");
    const positions = new Map();
    try {
      const header = Buffer.alloc(16);
      for (let offset = 0; offset + 8 <= size;) {
        assert.ok(readSync(fd, header, 0, 16, offset) >= 8);
        const type = header.toString("ascii", 4, 8);
        let length = header.readUInt32BE(0);
        if (length === 1) length = Number(header.readBigUInt64BE(8));
        if (length === 0) length = size - offset;
        assert.ok(length >= 8 && offset + length <= size, `${relative}: invalid ${type} box`);
        positions.set(type, offset);
        offset += length;
      }
    } finally { closeSync(fd); }
    assert.ok(positions.has("moov") && positions.has("mdat"), `${relative}: missing MP4 structure`);
    assert.ok(positions.get("moov") < positions.get("mdat"), `${relative}: faststart metadata must come first`);
  }
});
