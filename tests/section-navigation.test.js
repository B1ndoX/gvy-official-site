import assert from "node:assert/strict";
import test from "node:test";

import { resolveActiveSectionId } from "../assets/js/section-navigation.js";

const positions = [
  { id: "fleet-signal", top: 300 },
  { id: "operations", top: 900 },
  { id: "archive", top: 1_800 },
  { id: "recruit", top: 2_600 },
];

test("section navigation stays inactive while the hero owns the viewport", () => {
  assert.equal(resolveActiveSectionId(positions, 299), "");
});

test("section navigation selects the latest section that crossed the viewport probe", () => {
  assert.equal(resolveActiveSectionId(positions, 300), "fleet-signal");
  assert.equal(resolveActiveSectionId(positions, 1_200), "operations");
  assert.equal(resolveActiveSectionId(positions, 2_100), "archive");
  assert.equal(resolveActiveSectionId(positions, 4_000), "recruit");
});

test("section navigation ignores invalid bounds without inventing an active item", () => {
  assert.equal(resolveActiveSectionId([{ id: "fleet-signal", top: Number.NaN }], 500), "");
});
