import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { parseGalleryState } from "../lib/gallery-html.mjs";
import { assertSameDeployedGallery, PublisherService } from "../lib/publisher-service.mjs";
import { galleryFixture, withImageGallery } from "./fixtures.mjs";

const runFile = promisify(execFile);

const homepage = galleryFixture();

async function copyFixtureAsset(root, relativePath) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `isolated filesystem fixture: ${relativePath}`);
}

test("delete preview physically removes selected assets, preserves order, and rolls back safely", async () => {
  const root = await mkdtemp(join(tmpdir(), "gvy-gallery-delete-"));
  const startingGallery = parseGalleryState(homepage);
  const selectedAssetNumbers = [4, 5];
  const selectedPaths = selectedAssetNumbers.flatMap((number) => {
    const padded = String(number).padStart(2, "0");
    return [
      `assets/gallery/team-${padded}.png`,
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

    const expectedPreviewHtml = await readFile(join(root, "index.html"), "utf8");
    const editedHtml = expectedPreviewHtml.replace("<title>", "<title>Other maintainer: ");
    await writeFile(join(root, "index.html"), editedHtml);
    await assert.rejects(service.rollback(), /文件被其他操作改变/);
    assert.equal(await readFile(join(root, "index.html"), "utf8"), editedHtml);
    assert.ok(service.session);
    await writeFile(join(root, "index.html"), expectedPreviewHtml);
    // A deleted file recreated by another process must not be overwritten.
    await writeFile(join(root, selectedPaths[0]), "another editor's asset");
    await assert.rejects(service.rollback(), /文件被其他操作改变/);
    assert.equal(await readFile(join(root, selectedPaths[0]), "utf8"), "another editor's asset");
    await rm(join(root, selectedPaths[0]));

    await service.rollback();
    assert.equal(await readFile(join(root, "index.html"), "utf8"), homepage);
    await Promise.all(selectedPaths.map((path) => access(join(root, path))));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function withDeleteFixture(numbers, callback, verify = "node -e \"process.exit(0)\"") {
  const root = await mkdtemp(join(tmpdir(), "gvy-preview-guard-"));
  try {
    const service = new PublisherService({ root, officialGalleryLoader: async () => parseGalleryState(homepage) });
    const selected = parseGalleryState(homepage).items.filter((item) => numbers.includes(item.number));
    const paths = selected.flatMap((item) => [
      `assets/gallery/${item.fallbackName}`,
      `assets/gallery/optimized/team-${String(item.number).padStart(2, "0")}-1280.webp`,
      `assets/gallery/thumbs/team-${String(item.number).padStart(2, "0")}.jpg`,
    ]);
    await writeFile(join(root, "index.html"), homepage);
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { verify } }));
    await writeFile(join(root, ".gitignore"), "tools/gallery-publisher/.runtime/\n");
    await Promise.all(paths.map((path) => copyFixtureAsset(root, path)));
    await runFile("git", ["init", "-b", "main", root]);
    await runFile("git", ["-C", root, "add", "."]);
    await runFile("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"]);
    await service.initialize();
    await callback({ root, service, paths });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("deleting shared gallery members retains every outside reference and supports rollback", async () => {
  await withDeleteFixture([14, 15, 18], async ({ root, service, paths }) => {
    await service.createDeletePreview([14, 15, 18]);
    const html = await readFile(join(root, "index.html"), "utf8");
    assert.equal(parseGalleryState(html).count, parseGalleryState(homepage).count - 3);
    for (const path of paths) {
      if (html.includes(path)) {
        await access(join(root, path));
        assert.ok(!service.session.removedPaths.includes(join(root, path)));
      }
    }
    await service.rollback();
    assert.equal(await readFile(join(root, "index.html"), "utf8"), homepage);
    for (const path of paths) await access(join(root, path));
  });
});

test("rollback refuses a moved HEAD without writing files", async () => {
  await withDeleteFixture([4], async ({ root, service }) => {
    await service.createDeletePreview([4]);
    const before = await readFile(join(root, "index.html"), "utf8");
    await runFile("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "other work"]);
    await assert.rejects(service.rollback(), /Git 基线已改变/);
    assert.equal(await readFile(join(root, "index.html"), "utf8"), before);
    await access(service.session.backupPath);
  });
});

test("failed verification preserves an external HTML edit and the recovery backup", async () => {
  const verify = `node -e "const fs=require('fs');fs.appendFileSync('index.html','<!-- external edit -->');process.exit(1)"`;
  await withDeleteFixture([4], async ({ root, service }) => {
    await assert.rejects(service.createDeletePreview([4]), /自动恢复已停止/);
    assert.match(await readFile(join(root, "index.html"), "utf8"), /external edit/);
    assert.equal(service.operation.status, "error");
    assert.match(service.operation.message, /备份位于/);
  }, verify);
});

test("failed verification without a conflict restores the original gallery", async () => {
  await withDeleteFixture([4], async ({ root, service, paths }) => {
    await assert.rejects(service.createDeletePreview([4]), /失败/);
    assert.equal(await readFile(join(root, "index.html"), "utf8"), homepage);
    for (const path of paths) await access(join(root, path));
  }, 'node -e "process.exit(1)"');
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
  await withImageGallery(async (root, html) => {
    const gallery = parseGalleryState(html);
    const service = new PublisherService({ root });
    const inventory = await service.getGalleryInventory(gallery);

    assert.equal(inventory.items.length, gallery.count);
    inventory.items.forEach((item) => {
      assert.match(item.publicUrl, /^\/site-assets\/gallery\/thumbs\/team-\d+\.jpg$/);
  });
  });
});

test("local duplicate review reports exact and visual matches and only continues after explicit override", async () => {
  await withImageGallery(async (imageRoot, imageHtml) => {
    const gallery = parseGalleryState(imageHtml);
    const lastItem = gallery.items.at(-1);
    const exactPath = join(imageRoot, "assets/gallery", lastItem.fallbackName);
    const recompressedPath = join(
      imageRoot,
      `assets/gallery/optimized/team-${String(lastItem.number).padStart(2, "0")}-1280.webp`,
    );
    const service = new PublisherService({ root: imageRoot });

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
});

test("a photo removed from the current gallery can be uploaded again without a stale duplicate block", async () => {
  await withImageGallery(async (imageRoot, imageHtml) => {
    const gallery = parseGalleryState(imageHtml);
    const removedItem = gallery.items.at(-1);
    const galleryAfterDeletion = {
      ...gallery,
      count: gallery.count - 1,
      items: gallery.items.slice(0, -1),
    };
    const service = new PublisherService({ root: imageRoot });
    const result = await service.validateUploadDuplicates(galleryAfterDeletion, [{
      path: join(imageRoot, "assets/gallery", removedItem.fallbackName),
      originalName: "previously-deleted-photo.png",
      mimeType: "image/png",
    }]);

    assert.deepEqual(result, []);
  });
});

test("add preview snapshots generated assets and refuses to delete a subsequently edited file", async () => {
  await withImageGallery(async (root, html) => {
    await writeFile(join(root, "index.html"), html);
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { verify: 'node -e "process.exit(0)"' } }));
    await writeFile(join(root, ".gitignore"), "tools/gallery-publisher/.runtime/\n");
    await runFile("git", ["init", "-b", "main", root]);
    await runFile("git", ["-C", root, "add", "."]);
    await runFile("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"]);
    const service = new PublisherService({ root, officialGalleryLoader: async () => parseGalleryState(html) });
    await service.initialize();
    await service.createPreview([{ path: join(root, "input-1.png"), originalName: "copy.png", mimeType: "image/png" }], { allowDuplicates: true });
    assert.equal(parseGalleryState(await readFile(join(root, "index.html"), "utf8")).count, 3);
    const path = service.session.createdPaths[0];
    const originalAsset = await readFile(path);
    await writeFile(path, "external change");
    await assert.rejects(service.rollback(), /文件被其他操作改变/);
    assert.equal(await readFile(path, "utf8"), "external change");
    await writeFile(path, originalAsset);
    await service.rollback();
    assert.equal(await readFile(join(root, "index.html"), "utf8"), html);
    await assert.rejects(access(path));
  });
});
