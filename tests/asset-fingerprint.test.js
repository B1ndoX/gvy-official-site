import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fingerprintAssets } from "../scripts/fingerprint-assets.mjs";

test("content URLs invalidate transitive modules without changing inline bootstrap or media", async () => {
  const root = await mkdtemp(join(tmpdir(), "gvy-fingerprint-"));
  try {
    await mkdir(join(root, "assets"));
    const inline = '<script>const video="./assets/movie.mp4?v=keep";</script>';
    await writeFile(join(root, "index.html"), `${inline}<script src="./assets/main.js?v=old"></script>`);
    await writeFile(join(root, "404.html"), "not found");
    await writeFile(join(root, "member-brawl.html"), "arena");
    await writeFile(join(root, "assets/main.js"), 'import "./child.js?v=old";');
    await writeFile(join(root, "assets/child.js"), "export const count=1;");
    await fingerprintAssets(root);
    const first = await readFile(join(root, "index.html"), "utf8");
    assert.ok(first.startsWith(inline));
    assert.match(first, /main\.js\?v=[a-f0-9]{16}/);
    await fingerprintAssets(root);
    assert.equal(await readFile(join(root, "index.html"), "utf8"), first);
    await writeFile(join(root, "assets/child.js"), "export const count=2;");
    await fingerprintAssets(root);
    const second = await readFile(join(root, "index.html"), "utf8");
    assert.notEqual(second, first);
    assert.ok(second.startsWith(inline));
  } finally { await rm(root, { recursive: true, force: true }); }
});
