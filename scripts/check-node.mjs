import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const expected = (await readFile(new URL(".node-version", root), "utf8")).trim();
const cloud = (await readFile(new URL(".nvmrc", root), "utf8")).trim();
assert.match(expected, /^24\.\d+\.\d+$/);
assert.equal(cloud, expected, ".nvmrc must match the canonical .node-version");
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
assert.equal(manifest.engines?.node, expected, "package.json must require the canonical Node version");
assert.equal(process.versions.node, expected, `Use Node ${expected}; actual Node is ${process.versions.node}`);
console.log(`Verified Node ${process.versions.node} on ${process.platform}/${process.arch}`);
