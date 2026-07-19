import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(new URL("..", import.meta.url).pathname);

const outputs = [
  {
    id: "02",
    video: "assets/hero-random/v2/fleet-hero-02-1440p-v3.mp4",
    poster: "assets/hero-random/v2/fleet-hero-02-poster-1440p-v3.webp",
    duration: "00:00:28.33",
    resolution: "2560x1440",
  },
];

function inspectMedia(path) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-i", path], { encoding: "utf8" });
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

for (const output of outputs) {
  test(`hero ${output.id} video meets the production media contract`, () => {
    const path = resolve(root, output.video);
    assert.equal(existsSync(path), true, `${output.video} must exist`);
    assert.ok(statSync(path).size > 1_000_000, "video must not be a placeholder");

    const metadata = inspectMedia(path);
    assert.match(metadata, new RegExp(`Duration: ${output.duration.replaceAll(".", "\\.")}`));
    assert.match(metadata, new RegExp(`Video: h264 .*yuv420p.*${output.resolution}`));
    assert.match(metadata, /SAR 1:1 DAR 16:9/);
    assert.match(metadata, /30 fps/);
    assert.doesNotMatch(metadata, /Audio:/);
  });

  test(`hero ${output.id} poster matches the high-detail video frame`, () => {
    const path = resolve(root, output.poster);
    assert.equal(existsSync(path), true, `${output.poster} must exist`);
    assert.ok(statSync(path).size > 50_000, "poster must contain a detailed master frame");

    const metadata = inspectMedia(path);
    assert.match(metadata, new RegExp(`Video: webp, .*${output.resolution}`));
  });
}
