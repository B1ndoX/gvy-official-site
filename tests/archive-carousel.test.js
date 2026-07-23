import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceCarouselPosition,
  getClosestCardIndex,
  isCarouselDrag,
  normalizeLoopPosition,
  shouldAdvanceCarousel,
  wrapCarouselIndex,
} from "../assets/js/archive-carousel.js";

test("carousel distinguishes a click from an intentional drag", () => {
  assert.equal(isCarouselDrag(100, 105, 8), false);
  assert.equal(isCarouselDrag(100, 108, 8), true);
  assert.equal(isCarouselDrag(100, 82, 8), true);
});

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

test("continuous carousel keeps a floating position across subpixel animation frames", () => {
  const firstFrame = advanceCarouselPosition(0, 34, 16, 1000);
  const secondFrame = advanceCarouselPosition(firstFrame, 34, 16, 1000);

  assert.ok(Math.abs(firstFrame - 0.544) < 1e-9);
  assert.ok(Math.abs(secondFrame - 1.088) < 1e-9);
  assert.ok(Math.abs(advanceCarouselPosition(999.8, 34, 16, 1000) - 0.344) < 1e-9);
});

test("continuous carousel pauses only for direct interaction, visibility, or its pause control", () => {
  const baseState = {
    loopWidth: 1000,
    manuallyPaused: false,
    touchActive: false,
    pageScrolling: false,
    inView: true,
    hidden: false,
  };

  assert.equal(shouldAdvanceCarousel(baseState), true);
  assert.equal(shouldAdvanceCarousel({ ...baseState, touchActive: true }), false);
  assert.equal(shouldAdvanceCarousel({ ...baseState, pageScrolling: true }), false);
  assert.equal(shouldAdvanceCarousel({ ...baseState, manuallyPaused: true }), false);
  assert.equal(shouldAdvanceCarousel({ ...baseState, inView: false }), false);
  assert.equal(shouldAdvanceCarousel({ ...baseState, hidden: true }), false);
});
