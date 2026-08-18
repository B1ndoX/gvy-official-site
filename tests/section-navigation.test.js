import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveActiveSectionId,
  resolveHorizontalFollowTarget,
} from "../assets/js/section-navigation.js";

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

test("navigation rail follows an active item that moves beyond the right edge", () => {
  assert.equal(resolveHorizontalFollowTarget({
    scrollLeft: 0,
    scrollWidth: 900,
    clientWidth: 320,
    railLeft: 100,
    railRight: 420,
    itemLeft: 390,
    itemRight: 510,
    edgePadding: 12,
  }), 102);
});

test("navigation rail follows an active item that moves beyond the left edge", () => {
  assert.equal(resolveHorizontalFollowTarget({
    scrollLeft: 260,
    scrollWidth: 900,
    clientWidth: 320,
    railLeft: 100,
    railRight: 420,
    itemLeft: 60,
    itemRight: 180,
    edgePadding: 12,
  }), 208);
});

test("navigation rail does not move when the active item is already visible", () => {
  assert.equal(resolveHorizontalFollowTarget({
    scrollLeft: 180,
    scrollWidth: 900,
    clientWidth: 320,
    railLeft: 100,
    railRight: 420,
    itemLeft: 160,
    itemRight: 300,
    edgePadding: 12,
  }), 180);
});
