import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPreviewServer } from "../scripts/preview-server.mjs";

test("local playback preview supports real ranges, validators and current media cache rules", async () => {
  const root = await mkdtemp(join(tmpdir(), "gvy-preview-test-"));
  await mkdir(join(root, "assets/operations-motion/v2"), { recursive: true });
  const path = join(root, "assets/operations-motion/v2/clip.mp4");
  await writeFile(path, "0123456789");
  await writeFile(join(root, "index.html"), "home");
  await writeFile(join(root, "404.html"), "missing");
  const server = createPreviewServer({ root });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const url = `${base}/assets/operations-motion/v2/clip.mp4?v=example`;
  try {
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.match(head.headers.get("cache-control"), /max-age=31536000, immutable/);
    assert.match(head.headers.get("content-security-policy"), /script-src 'self' 'sha256-/,
      "preview must enforce the deployed bootstrap CSP when media URLs change");
    assert.equal(head.headers.get("content-length"), "10");
    const etag = head.headers.get("etag");
    const range = await fetch(url, { headers: { Range: "bytes=2-5" } });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), "bytes 2-5/10");
    assert.equal(await range.text(), "2345");
    const tail = await fetch(url, { headers: { Range: "bytes=-3" } });
    assert.equal(await tail.text(), "789");
    const cached = await fetch(url, { headers: { "If-None-Match": etag } });
    assert.equal(cached.status, 304);
    assert.equal(await cached.text(), "");
    assert.equal((await fetch(url, { headers: { Range: "bytes=10-" } })).status, 416);
    const staleRange = await fetch(url, { headers: { Range: "bytes=2-5", "If-Range": '"old"' } });
    assert.equal(staleRange.status, 200);
    assert.equal(await staleRange.text(), "0123456789");
    await writeFile(path, "new content with different bytes");
    const updated = await fetch(url, { headers: { "If-None-Match": etag } });
    assert.equal(updated.status, 200);
    assert.notEqual(updated.headers.get("etag"), etag);
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.match((await fetch(base)).headers.get("cache-control"), /must-revalidate/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
