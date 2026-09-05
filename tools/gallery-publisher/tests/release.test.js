import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  assertGalleryOnlyPaths,
  buildReleaseSummary,
  DEPLOYMENT_VERIFY_TIMEOUT_MINUTES,
  isExpectedGalleryAssetResponse,
  listGitChanges,
  matchesExpectedGallery,
} from "../lib/git-release.mjs";
import { parseGalleryState, removeGalleryItems, appendGalleryBatch } from "../lib/gallery-html.mjs";
import { galleryFixture } from "./fixtures.mjs";

const runFile = promisify(execFile);

test("deployment verification matches exact gallery content, not obsolete labels or outside references", async () => {
  const original = galleryFixture();
  const removed = removeGalleryItems(original, [14, 15]);
  assert.ok(removed.includes("team-15-1280.webp"));
  const expected = parseGalleryState(removed);
  assert.equal(matchesExpectedGallery(removed, expected), true);
  assert.equal(matchesExpectedGallery(original, expected), false);
  assert.equal(matchesExpectedGallery("<html>gateway error</html>", expected), false);
  const wrongPhoto = removeGalleryItems(original, [4, 5]);
  assert.equal(matchesExpectedGallery(wrongPhoto, expected), false);
  const added = appendGalleryBatch(original, [{ number: parseGalleryState(original).maxPhotoNumber + 1, fallbackName: "team-50.png", width: 2560, height: 1440 }]);
  assert.equal(matchesExpectedGallery(added, parseGalleryState(added)), true);
  assert.equal(matchesExpectedGallery(original, parseGalleryState(added)), false);
});

test("publisher waits long enough for the current EdgeOne deployment window", () => {
  assert.equal(DEPLOYMENT_VERIFY_TIMEOUT_MINUTES, 12);
});

test("deployment verification rejects EdgeOne homepage fallbacks disguised as successful assets", () => {
  const response = (ok, contentType) => ({ ok, headers: new Headers({ "content-type": contentType }) });
  assert.equal(isExpectedGalleryAssetResponse(response(true, "image/webp")), true);
  assert.equal(isExpectedGalleryAssetResponse(response(true, "image/webp; charset=binary")), true);
  assert.equal(isExpectedGalleryAssetResponse(response(true, "text/html")), false);
  assert.equal(isExpectedGalleryAssetResponse(response(false, "image/webp")), false);
});

test("release summary is stable, scoped to main, and includes a pre-release rollback tag", () => {
  const summary = buildReleaseSummary(
    { batchStart: 48, batchEnd: 53 },
    new Date("2026-07-29T04:05:06.000Z"),
  );

  assert.deepEqual(summary, {
    tag: "backup-production-before-gallery-20260729-120506-CST",
    commitMessage: "feat: publish 6 gallery photos",
    branch: "main",
    remoteBranch: "origin/main",
    project: "gvy-official-site",
    domains: ["https://www.gvyvoyagers.vip", "https://gvyvoyagers.vip"],
  });
});

test("release summaries describe deletion counts without exposing internal asset numbers", () => {
  const summary = buildReleaseSummary(
    { type: "delete", batchStart: 38, batchEnd: 47, itemCount: 3, deletedNumbers: [38, 39, 47] },
    new Date("2026-07-29T04:05:06.000Z"),
  );

  assert.equal(summary.commitMessage, "fix: remove 3 gallery photos");
});

test("release staging rejects every path outside the team gallery allowlist", () => {
  assert.doesNotThrow(() => assertGalleryOnlyPaths([
    "index.html",
    "assets/gallery/team-48.png",
    "assets/gallery/optimized/team-48-1280.webp",
    "assets/gallery/thumbs/team-48.jpg",
  ]));
  assert.throws(
    () => assertGalleryOnlyPaths(["index.html", "assets/cinematic-homepage.css"]),
    /白名单之外/,
  );
  assert.throws(
    () => assertGalleryOnlyPaths(["assets/js/cinematic-homepage.js"]),
    /白名单之外/,
  );
});

test("git safety checks preserve the first character of the first changed path", async () => {
  const root = await mkdtemp(join(tmpdir(), "gvy-gallery-git-status-"));
  try {
    await runFile("git", ["init", "-b", "main", root]);
    await writeFile(join(root, "assets.css"), "before\n", "utf8");
    await runFile("git", ["-C", root, "add", "assets.css"]);
    await runFile("git", [
      "-C", root,
      "-c", "user.name=GVY Test",
      "-c", "user.email=gvy-test@example.invalid",
      "commit", "-m", "fixture",
    ]);
    await writeFile(join(root, "assets.css"), "after\n", "utf8");
    await writeFile(join(root, "new-file.txt"), "new\n", "utf8");

    assert.deepEqual(await listGitChanges(root), ["assets.css", "new-file.txt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
