import assert from "node:assert/strict";
import test from "node:test";

import {
  getClosestCardIndex,
  normalizeLoopPosition,
  wrapCarouselIndex,
} from "../assets/js/archive-carousel.js";

test("carousel indexes wrap in both directions", () => {
  assert.equal(wrapCarouselIndex(18, 18), 0);
  assert.equal(wrapCarouselIndex(-1, 18), 17);
  assert.equal(wrapCarouselIndex(6, 18), 6);
});

test("carousel wrapping rejects an empty collection", () => {
  assert.throws(() => wrapCarouselIndex(0, 0), RangeError);
});

test("closest card follows the viewport center", () => {
  const viewport = { scrollLeft: 420, clientWidth: 400 };
  const cards = [
    { offsetLeft: 0, offsetWidth: 300 },
    { offsetLeft: 330, offsetWidth: 300 },
    { offsetLeft: 660, offsetWidth: 300 },
  ];

  assert.equal(getClosestCardIndex(viewport, cards), 1);
  viewport.scrollLeft = 650;
  assert.equal(getClosestCardIndex(viewport, cards), 2);
});

test("continuous carousel wraps forward and backward without changing visual phase", () => {
  assert.equal(normalizeLoopPosition(1010, 1000), 10);
  assert.equal(normalizeLoopPosition(-10, 1000), 990);
  assert.equal(normalizeLoopPosition(450, 1000), 450);
});
