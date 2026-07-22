import assert from "node:assert/strict";
import test from "node:test";

import {
  assignOperationSource,
  canPlayOperationMotion,
  selectOperationSource,
} from "../assets/js/operation-motion.js";

function createView({ width = 1600, reduced = false, saveData = false } = {}) {
  return {
    navigator: { connection: { saveData } },
    matchMedia(query) {
      if (query.includes("prefers-reduced-motion")) return { matches: reduced };
      const maxWidth = Number.parseInt(query.match(/max-width:\s*(\d+)px/)?.[1] || "0", 10);
      return { matches: maxWidth > 0 && width <= maxWidth };
    },
  };
}

function createVideo() {
  return {
    dataset: { srcCompact: "compact.mp4", srcWide: "wide.mp4" },
    preload: "none",
    src: "",
    loadCalls: 0,
    load() { this.loadCalls += 1; },
  };
}

test("operation motion stays disabled for mobile, reduced motion, and data saver", () => {
  assert.equal(canPlayOperationMotion(createView({ width: 760 })), false);
  assert.equal(canPlayOperationMotion(createView({ reduced: true })), false);
  assert.equal(canPlayOperationMotion(createView({ saveData: true })), false);
  assert.equal(canPlayOperationMotion(createView({ width: 1441 })), true);
});

test("operation motion selects the compact or wide encode from viewport width", () => {
  const video = createVideo();
  assert.equal(selectOperationSource(video, createView({ width: 1280 })), "compact.mp4");
  assert.equal(selectOperationSource(video, createView({ width: 1920 })), "wide.mp4");
});

test("operation motion assigns one source exactly once", () => {
  const video = createVideo();
  const view = createView({ width: 1280 });

  assert.equal(assignOperationSource(video, view), true);
  assert.equal(video.src, "compact.mp4");
  assert.equal(video.preload, "metadata");
  assert.equal(video.loadCalls, 1);
  assert.equal(assignOperationSource(video, view), false);
  assert.equal(video.loadCalls, 1);
});
