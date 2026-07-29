import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { parseGalleryState } from "../lib/gallery-html.mjs";
import { PublisherService } from "../lib/publisher-service.mjs";

const runFile = promisify(execFile);
const projectRoot = new URL("../../../", import.meta.url).pathname;

async function readDeploymentBaseline() {
  try {
    const { stdout } = await runFile("git", ["show", "HEAD:index.html"], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    return stdout;
  } catch {
    return readFile(join(projectRoot, "index.html"), "utf8");
  }
}

const homepage = await readDeploymentBaseline();

async function copyFixtureAsset(root, relativePath) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(projectRoot, relativePath), target);
}

test("delete preview physically removes selected assets, closes visible gaps, and rolls back safely", async () => {
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
    await Promise.all(selectedPaths.map((path) => copyFixtureAsset(root, path)));
    await runFile("git", ["init", "-b", "main", root]);

    const service = new PublisherService({ root });
    await service.initialize();
    const status = await service.createDeletePreview(selectedAssetNumbers);
    const preview = parseGalleryState(await readFile(join(root, "index.html"), "utf8"));

    assert.equal(preview.count, startingGallery.count - selectedAssetNumbers.length);
    assert.equal(preview.items[3].number, 6);
    assert.equal(preview.items[3].displayNumber, 4);
    assert.deepEqual(status.session.items.map((item) => item.displayNumber), [4, 5]);
    await Promise.all(selectedPaths.map((path) => assert.rejects(access(join(root, path)))));

    await service.rollback();
    assert.equal(await readFile(join(root, "index.html"), "utf8"), homepage);
    await Promise.all(selectedPaths.map((path) => access(join(root, path))));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
      assert.equal(error.duplicates[0].matchDisplayNumber, gallery.count);
      assert.match(error.duplicates[0].matchUrl, /^\/preview\/assets\/gallery\//);
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
      assert.equal(error.duplicates[0].matchDisplayNumber, gallery.count);
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
