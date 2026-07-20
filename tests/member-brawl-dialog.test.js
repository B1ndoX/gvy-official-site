import assert from "node:assert/strict";
import test from "node:test";

import { getBrawlFit } from "../assets/js/member-brawl-dialog.js";

test("brawl canvas fills an aspect-ratio constrained floating dialog", () => {
  const fit = getBrawlFit(1075.2, 672);
  assert.ok(Math.abs(fit.scale - 0.7466666667) < 0.000001);
  assert.ok(Math.abs(fit.width - 1075.2) < 0.001);
  assert.equal(fit.height, 672);
});

test("brawl canvas never scales above its published design size", () => {
  assert.deepEqual(getBrawlFit(2000, 1200), {
    scale: 1,
    width: 1440,
    height: 900,
  });
});
