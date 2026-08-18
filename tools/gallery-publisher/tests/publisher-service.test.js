import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { parseGalleryState } from "../lib/gallery-html.mjs";
import { assertSameDeployedGallery, PublisherService } from "../lib/publisher-service.mjs";

const runFile = promisify(execFile);
const projectRoot = new URL("../../../", import.meta.url).pathname;

async function readDeploymentBaseline() {
  try {
    const { stdout } = await runFile("git", ["show", "HEAD:index.html"], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    parseGalleryState(stdout);
    return stdout;
  } catch {
    const current = await readFile(join(projectRoot, "index.html"), "utf8");
    parseGalleryState(current);
    return current;
  }
}

const homepage = await readDeploymentBaseline();

async function copyFixtureAsset(root, relativePath) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(projectRoot, relativePath), target);
}

test("delete preview physically removes selected assets, preserves order, and rolls back safely", async () => {
  const root = await mkdtemp(join(tmpdir(), "gvy-gallery-delete-"));
  const startingGallery = parseGalleryState(homepage);
  const selectedAssetNumbers = [4, 5];
  const selectedPaths = selectedAssetNumbers.flatMap((number) => {
    const padded = String(number).padStart(2, "0");
    return [
      `assets/gallery/team-${padded}.jpg`,
      `assets/gallery/optimized/team-${padded}-1280.webp`,
      `assets/gallery/thumbs/team-${padded}.jpg`,
    ];
  });

  try {
    await writeFile(join(root, "index.html"), homepage, "utf8");
    await writeFile(join(root, "package.json"), `${JSON.stringify({ scripts: { verify: "node -e \"process.exit(0)\"" } }, null, 2)}\n`, "utf8");
    await writeFile(join(root, ".gitignore"), "tools/gallery-publisher/.runtime/\n", "utf8");
    await Promise.all(selectedPaths.map((path) => copyFixtureAsset(root, path)));
    await runFile("git", ["init", "-b", "main", root]);
    await runFile("git", ["-C", root, "add", "."]);
    await runFile("git", [
      "-C", root,
      "-c", "user.name=GVY Test",
      "-c", "user.email=gvy-test@example.invalid",
      "commit", "-m", "fixture",
    ]);

    const service = new PublisherService({ root, officialGalleryLoader: async () => startingGallery });
    await service.initialize();
    const status = await service.createDeletePreview(selectedAssetNumbers);
    const preview = parseGalleryState(await readFile(join(root, "index.html"), "utf8"));

    assert.equal(preview.count, startingGallery.count - selectedAssetNumbers.length);
    assert.equal(preview.items[3].number, 6);
    assert.deepEqual(status.session.items.map((item) => item.number), selectedAssetNumbers);
    status.session.items.forEach((item) => {
      assert.match(item.publicUrl, /^\/deleted-preview\/[a-f0-9-]{36}\/assets\/gallery\/thumbs\/team-\d+\.jpg$/i);
    });
    await Promise.all(selectedPaths.map((path) => assert.rejects(access(join(root, path)))));

    await service.rollback();
    assert.equal(await readFile(join(root, "index.html"), "utf8"), homepage);
    await Promise.all(selectedPaths.map((path) => access(join(root, path))));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("official deployed gallery is the calibration authority", () => {
  const official = parseGalleryState(homepage);
  const staleLocal = {
    ...official,
    count: official.count - 1,
    items: official.items.slice(0, -1),
  };

  assert.doesNotThrow(() => assertSameDeployedGallery(official, official));
  assert.throws(() => assertSameDeployedGallery(staleLocal, official), /正式官网当前相册不一致/);
});

test("current gallery thumbnails use the publisher's read-only source asset route", async () => {
  const gallery = parseGalleryState(homepage);
  const service = new PublisherService({ root: projectRoot });
  const inventory = await service.getGalleryInventory(gallery);

  assert.equal(inventory.items.length, gallery.count);
  inventory.items.forEach((item) => {
    assert.match(item.publicUrl, /^\/site-assets\/gallery\/thumbs\/team-\d+\.jpg$/);
  });
});

test("local duplicate review reports exact and visual matches and only continues after explicit override", async () => {
  const gallery = parseGalleryState(homepage);
  const lastItem = gallery.items.at(-1);
  const exactPath = join(projectRoot, "assets/gallery", lastItem.fallbackName);
  const recompressedPath = join(
    projectRoot,
    `assets/gallery/optimized/team-${String(lastItem.number).padStart(2, "0")}-1280.webp`,
  );
  const service = new PublisherService({ root: projectRoot });

  await assert.rejects(
    service.validateUploadDuplicates(gallery, [{
      path: exactPath,
      originalName: "renamed-copy.png",
      mimeType: "image/png",
    }]),
    (error) => {
      assert.equal(error.code, "DUPLICATE_REVIEW_REQUIRED");
      assert.equal(error.duplicates[0].matchType, "exact");
      assert.equal(error.duplicates[0].matchSource, "gallery");
      assert.match(error.duplicates[0].matchUrl, /^\/site-assets\/gallery\//);
      return true;
    },
  );

  await assert.rejects(
    service.validateUploadDuplicates(gallery, [{
      path: recompressedPath,
      originalName: "resized-copy.jpg",
      mimeType: "image/jpeg",
    }]),
    (error) => {
      assert.equal(error.code, "DUPLICATE_REVIEW_REQUIRED");
      assert.equal(error.duplicates[0].matchType, "visual");
      assert.match(error.duplicates[0].matchUrl, /^\/site-assets\/gallery\//);
      return true;
    },
  );

  const confirmed = await service.validateUploadDuplicates(gallery, [{
    path: recompressedPath,
    originalName: "resized-copy.jpg",
    mimeType: "image/jpeg",
  }], { allowDuplicates: true });
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].matchType, "visual");
});

test("a photo removed from the current gallery can be uploaded again without a stale duplicate block", async () => {
  const gallery = parseGalleryState(homepage);
  const removedItem = gallery.items.at(-1);
  const galleryAfterDeletion = {
    ...gallery,
    count: gallery.count - 1,
    items: gallery.items.slice(0, -1),
  };
  const service = new PublisherService({ root: projectRoot });
  const result = await service.validateUploadDuplicates(galleryAfterDeletion, [{
    path: join(projectRoot, "assets/gallery", removedItem.fallbackName),
    originalName: "previously-deleted-photo.png",
    mimeType: "image/png",
  }]);

  assert.deepEqual(result, []);
});
