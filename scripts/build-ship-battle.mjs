import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { acceptedCommit, digests, gameSources } from "./lib/ship-battle-release.mjs";
import "./check-node.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const game = resolve(root, "games/ship-battle");
assert.ok(Number(process.versions.node.split(".")[0]) >= 24, "Rebuild the ship runtime with Node 24 LTS; the EdgeOne build only copies and verifies this runtime.");
const build = spawnSync("npm", ["run", "build"], { cwd: game, stdio: "inherit" });
assert.equal(build.status, 0, "Ship game TypeScript/Vite build failed");
const publicFiles = await digests(resolve(game, "public"));
const builtFiles = await digests(resolve(game, "dist"));
const runtime = Object.fromEntries(Object.entries(builtFiles).filter(([file]) => !(file in publicFiles)));
const manifest = { version: 1, acceptedCommit, sources: await gameSources(game), runtime };
const manifestPath = resolve(game, "runtime-manifest.json");
if (process.argv.includes("--check")) {
  assert.deepEqual(manifest, JSON.parse(await readFile(manifestPath, "utf8")), "Checked-in ship runtime is stale; run npm run game:ship:build and include its generated changes");
  console.log("Ship runtime reproduces the accepted source build.");
} else {
  await rm(resolve(game, "runtime"), { recursive: true, force: true });
  for (const file of Object.keys(runtime)) {
    const target = resolve(game, "runtime", file);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(game, "dist", file), target);
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Prepared ${Object.keys(runtime).length} ship runtime files; public assets remain single-copy.`);
}
