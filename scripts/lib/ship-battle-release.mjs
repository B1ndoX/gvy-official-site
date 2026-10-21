import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import {shipGameCacheWorker} from './ship-game-cache.mjs';

export const acceptedCommit = "5700a86751c3552f1c25b933067fd2daf5e51bda";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), `Unexpected game symlink: ${entry.name}`);
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesIn(path));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}
export async function digests(directory) {
  return Object.fromEntries(await Promise.all((await filesIn(directory)).map(async (file) => [
    relative(directory, file).split(sep).join("/"), sha256(await readFile(file)),
  ])));
}
export async function gameSources(game) {
  const paths = ["src", "public", "package.json", "package-lock.json", "index.html", "vite.config.ts", "tsconfig.json"];
  const result = {};
  for (const path of paths) {
    const source = resolve(game, path);
    if ((await stat(source)).isDirectory()) {
      for (const [file, hash] of Object.entries(await digests(source))) result[`${path}/${file}`] = hash;
    } else result[path] = sha256(await readFile(source));
  }
  return result;
}
export async function validateShipRelease(root) {
  const game = resolve(root, "games/ship-battle");
  const manifest = JSON.parse(await readFile(resolve(game, "runtime-manifest.json"), "utf8"));
  assert.equal(manifest.version, 1);
  assert.equal(manifest.acceptedCommit, acceptedCommit);
  assert.deepEqual(await gameSources(game), manifest.sources, "Ship game source changed: rebuild with npm run game:ship:build on Node 24 before publishing");
  assert.deepEqual(await digests(resolve(game, "runtime")), manifest.runtime, "Ship game runtime differs from its verified build");
  return manifest;
}

export async function validatePublishedShipGame(root, output) {
  const manifest = await validateShipRelease(root);
  const published = resolve(output, "games/ship-battle");
  const source = resolve(root, "games/ship-battle/public");
  const publicFiles = await digests(source);
  // The standalone embedding demos contain development-only parent scripts.
  delete publicFiles["embed-example.html"];
  delete publicFiles["popup-preview.html"];
  const expected={...publicFiles,...manifest.runtime};
  expected['cache-worker.js']=sha256(await shipGameCacheWorker(expected));
  assert.deepEqual(await digests(published), expected, "Published ship game must be the complete verified runtime, without source or demos");
  const library = JSON.parse(await readFile(resolve(published, "assets/ships/manifest.json"), "utf8"));
  assert.equal(library.assets.length, 224);
  for (const asset of library.assets) {
    assert.match(asset.url, /^assets\/ships\/[a-z0-9-]+\.png$/);
    assert.ok(publicFiles[asset.url], `Missing ship: ${asset.shipId}`);
  }
}
