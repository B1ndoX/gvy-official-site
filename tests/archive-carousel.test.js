import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceCarouselPosition,
  getCarouselCardPosition,
  getCarouselNavigationIndex,
  getCarouselNavigationTargetIndexes,
  isCarouselDrag,
  normalizeLoopPosition,
  resolveCarouselTargetIndex,
  shouldAdvanceCarousel,
  shouldAllowCarouselClick,
  wrapCarouselIndex,
} from "../assets/js/archive-carousel.js";

test("carousel distinguishes a click from an intentional drag", () => {
  assert.equal(isCarouselDrag(100, 105, 8), false);
  assert.equal(isCarouselDrag(100, 108, 8), true);
  assert.equal(isCarouselDrag(100, 82, 8), true);
  assert.equal(isCarouselDrag(100, 104, 8, 100, 107), true);
});

test("only a short stationary press may open a gallery photo", () => {
  assert.equal(shouldAllowCarouselClick({ dragged: false, startedAt: 100, endedAt: 339 }), true);
  assert.equal(shouldAllowCarouselClick({ dragged: false, startedAt: 100, endedAt: 340 }), false);
  assert.equal(shouldAllowCarouselClick({ dragged: true, startedAt: 100, endedAt: 120 }), false);
  assert.equal(shouldAllowCarouselClick({ dragged: true, startedAt: 100, endedAt: 500 }), false);
});

test("carousel indexes wrap in both directions", () => {
  assert.equal(wrapCarouselIndex(18, 18), 0);
  assert.equal(wrapCarouselIndex(-1, 18), 17);
  assert.equal(wrapCarouselIndex(6, 18), 6);
});

test("carousel wrapping rejects an empty collection", () => {
  assert.throws(() => wrapCarouselIndex(0, 0), RangeError);
});

test("carousel resolves explicit targets without changing the default start", () => {
  assert.equal(resolveCarouselTargetIndex("37", 47), 37);
  assert.equal(resolveCarouselTargetIndex(46, 47), 46);
  assert.equal(resolveCarouselTargetIndex("invalid", 47), 0);
  assert.equal(resolveCarouselTargetIndex(52, 47), 5);
});

test("gallery navigation keeps one exact target for every photo", () => {
  assert.deepEqual(getCarouselNavigationTargetIndexes(5), [0, 1, 2, 3, 4]);
  assert.deepEqual(getCarouselNavigationTargetIndexes(1), [0]);
  assert.deepEqual(getCarouselNavigationTargetIndexes(0), []);
});

test("gallery navigation follows the exact photo across continuous loop progress", () => {
  assert.equal(getCarouselNavigationIndex(0, 1000, 10), 0);
  assert.equal(getCarouselNavigationIndex(100, 1000, 10), 1);
  assert.equal(getCarouselNavigationIndex(900, 1000, 10), 9);
  assert.equal(getCarouselNavigationIndex(960, 1000, 10), 0);
  assert.equal(getCarouselNavigationIndex(1000, 1000, 10), 0);
});

test("carousel converts a target card to the loop-relative scroll position", () => {
  const cards = [
    { offsetLeft: 24 },
    { offsetLeft: 401 },
    { offsetLeft: 778 },
  ];

  assert.equal(getCarouselCardPosition(cards, 0), 0);
  assert.equal(getCarouselCardPosition(cards, 2), 754);
  assert.equal(getCarouselCardPosition(cards, 5), 754);
});

test("continuous carousel wraps forward and backward without changing visual phase", () => {
  assert.equal(normalizeLoopPosition(1010, 1000), 10);
  assert.equal(normalizeLoopPosition(-10, 1000), 990);
  assert.equal(normalizeLoopPosition(450, 1000), 450);
});

test("continuous carousel keeps a floating position across subpixel animation frames", () => {
  const firstFrame = advanceCarouselPosition(0, 48, 16, 1000);
  const secondFrame = advanceCarouselPosition(firstFrame, 48, 16, 1000);

  assert.ok(Math.abs(firstFrame - 0.768) < 1e-9);
  assert.ok(Math.abs(secondFrame - 1.536) < 1e-9);
  assert.ok(Math.abs(advanceCarouselPosition(999.8, 48, 16, 1000) - 0.568) < 1e-9);
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
