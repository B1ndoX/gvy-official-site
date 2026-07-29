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
const homepage = await readFile(join(projectRoot, "index.html"), "utf8");

async function copyFixtureAsset(root, relativePath) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(projectRoot, relativePath), target);
}

test("delete preview physically removes selected assets, closes visible gaps, and rolls back safely", async () => {
  const root = await mkdtemp(join(tmpdir(), "gvy-gallery-delete-"));
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

    assert.equal(preview.count, 35);
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
