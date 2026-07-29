import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceCarouselPosition,
  getCarouselCardPosition,
  getLatestBatchStartIndex,
  isCarouselDrag,
  normalizeLoopPosition,
  resolveCarouselTargetIndex,
  shouldAdvanceCarousel,
  shouldSuppressCarouselClick,
  wrapCarouselIndex,
} from "../assets/js/archive-carousel.js";

test("carousel distinguishes a click from an intentional drag", () => {
  assert.equal(isCarouselDrag(100, 105, 8), false);
  assert.equal(isCarouselDrag(100, 108, 8), true);
  assert.equal(isCarouselDrag(100, 82, 8), true);
  assert.equal(isCarouselDrag(100, 104, 8, 100, 107), true);
});

test("only a short stationary press may open a gallery photo", () => {
  assert.equal(shouldSuppressCarouselClick({ dragged: false, startedAt: 100, endedAt: 339 }), false);
  assert.equal(shouldSuppressCarouselClick({ dragged: false, startedAt: 100, endedAt: 340 }), true);
  assert.equal(shouldSuppressCarouselClick({ dragged: true, startedAt: 100, endedAt: 120 }), true);
  assert.equal(shouldSuppressCarouselClick({ dragged: true, startedAt: 100, endedAt: 500 }), true);
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

test("latest control follows the first photo in each imported batch", () => {
  const makeCards = (existingCount, newCount) => Array.from(
    { length: existingCount + newCount },
    (_, index) => ({
      hasAttribute(name) {
        return name === "data-archive-latest-start" && index === existingCount;
      },
    }),
  );

  assert.equal(getLatestBatchStartIndex(makeCards(47, 6)), 47);
  assert.equal(getLatestBatchStartIndex(makeCards(53, 20)), 53);
  assert.equal(getLatestBatchStartIndex([{ hasAttribute: () => false }]), 0);
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
