import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const buildScript = await readFile(new URL("scripts/build-site.mjs", root), "utf8");

test("project exposes repeatable verification commands", () => {
  assert.equal(packageJson.scripts.test, "node --test");
  assert.equal(packageJson.scripts["check:js"], "node scripts/check-js.mjs");
  assert.match(packageJson.scripts.verify, /npm run test/);
  assert.match(packageJson.scripts.verify, /npm run check:js/);
  assert.match(packageJson.scripts.verify, /npm run build/);
});

test("production build copies local GSAP browser bundles", () => {
  assert.match(buildScript, /node_modules\/gsap\/dist\/gsap\.min\.js/);
  assert.match(buildScript, /node_modules\/gsap\/dist\/ScrollTrigger\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/gsap\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/ScrollTrigger\.min\.js/);
});
