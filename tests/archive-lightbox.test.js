import assert from "node:assert/strict";
import test from "node:test";

import {
  createArchiveSession,
  getArchiveItem,
  getSwipeDirection,
  shouldOpenArchiveFromClick,
  wrapArchiveIndex,
} from "../assets/js/archive-lightbox.js";

test("lightbox uses optimized WebP candidates with the original as fallback", () => {
  const attributes = {
    img: {
      src: "./assets/gallery/team-48.png",
      alt: "GVY 团建回忆",
    },
    source: {
      srcset: "./assets/gallery/optimized/team-48-1280.webp 1280w, ./assets/gallery/optimized/team-48-1920.webp 1920w",
    },
  };
  const button = {
    querySelector(selector) {
      const values = selector === "img" ? attributes.img : attributes.source;
      return { getAttribute: (name) => values[name] || null };
    },
  };

  assert.deepEqual(getArchiveItem(button, 37), {
    index: 37,
    src: "./assets/gallery/team-48.png",
    srcset: "./assets/gallery/optimized/team-48-1280.webp 1280w, ./assets/gallery/optimized/team-48-1920.webp 1920w",
    alt: "GVY 团建回忆",
  });
});

test("archive indexes wrap in both directions", () => {
  assert.equal(wrapArchiveIndex(18, 18), 0);
  assert.equal(wrapArchiveIndex(-1, 18), 17);
  assert.equal(wrapArchiveIndex(7, 18), 7);
});

test("archive wrapping rejects an empty collection", () => {
  assert.throws(() => wrapArchiveIndex(0, 0), RangeError);
});

test("swipe direction respects distance and threshold", () => {
  assert.equal(getSwipeDirection(240, 100, 48), "next");
  assert.equal(getSwipeDirection(100, 240, 48), "previous");
  assert.equal(getSwipeDirection(100, 140, 48), null);
  assert.equal(getSwipeDirection(100, 148, 48), "previous");
});

test("archive session retains the element that should receive restored focus", () => {
  const target = { focus() {} };
  const session = createArchiveSession(13, target);
  assert.equal(session.index, 13);
  assert.equal(session.restoreFocus, target);
});

test("lightbox opens only for a real click, never for a suppressed drag release", () => {
  assert.equal(shouldOpenArchiveFromClick({ defaultPrevented: false }), true);
  assert.equal(shouldOpenArchiveFromClick({ defaultPrevented: true }), false);
});
