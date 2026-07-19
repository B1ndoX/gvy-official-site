import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(new URL("..", import.meta.url).pathname);

const outputs = [
  {
    id: "02-1080p",
    video: "assets/hero-random/v2/fleet-hero-02-1080p-v4.mp4",
    duration: "00:00:28.33",
    resolution: "1920x1080",
  },
  {
    id: "02-1440p",
    video: "assets/hero-random/v2/fleet-hero-02-1440p-v4.mp4",
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
    assert.ok(statSync(path).size < 25 * 1024 * 1024, "video must remain below 25 MiB");

    const metadata = inspectMedia(path);
    assert.match(metadata, new RegExp(`Duration: ${output.duration.replaceAll(".", "\\.")}`));
    assert.match(metadata, new RegExp(`Video: h264 .*yuv420p.*${output.resolution}`));
    assert.match(metadata, /SAR 1:1 DAR 16:9/);
    assert.match(metadata, /30 fps/);
    assert.doesNotMatch(metadata, /Audio:/);
  });

}

test("hero poster is a lightweight 1440p WebP", () => {
  const path = resolve(root, "assets/hero-random/v2/fleet-hero-02-poster-1440p-v3.webp");
  assert.equal(existsSync(path), true);
  assert.ok(statSync(path).size > 50_000);
  assert.ok(statSync(path).size < 250_000);
  assert.match(inspectMedia(path), /Video: webp, .*2560x1440/);
});
