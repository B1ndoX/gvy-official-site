import assert from "node:assert/strict";
import test from "node:test";

import { assignDeferredSource, initDeferredMedia } from "../assets/js/deferred-media.js";

function createMedia(src = "./assets/operations-planet-video.mp4") {
  return {
    dataset: { src },
    src: "",
    preload: "none",
    loadCalls: 0,
    load() { this.loadCalls += 1; },
  };
}

test("assigns a deferred media source exactly once", () => {
  const media = createMedia();

  assert.equal(assignDeferredSource(media), true);
  assert.equal(media.src, media.dataset.src);
  assert.equal(media.preload, "metadata");
  assert.equal(media.dataset.mediaInitialized, "true");
  assert.equal(media.loadCalls, 1);

  assert.equal(assignDeferredSource(media), false);
  assert.equal(media.loadCalls, 1);
});

test("does not initialize media without a data source", () => {
  const media = createMedia("");
  assert.equal(assignDeferredSource(media), false);
  assert.equal(media.src, "");
  assert.equal(media.loadCalls, 0);
});

test("observer initializes intersecting targets and disconnects cleanly", () => {
  const first = createMedia("one.mp4");
  const second = createMedia("two.mp4");
  let callback = null;
  const observed = [];
  const unobserved = [];
  let disconnected = false;

  class FakeObserver {
    constructor(handler, options) {
      callback = handler;
      assert.equal(options.rootMargin, "100% 0px");
    }
    observe(target) { observed.push(target); }
    unobserve(target) { unobserved.push(target); }
    disconnect() { disconnected = true; }
  }

  const cleanup = initDeferredMedia({
    root: { querySelectorAll: () => [first, second] },
    Observer: FakeObserver,
  });

  assert.deepEqual(observed, [first, second]);
  callback([
    { isIntersecting: false, target: first },
    { isIntersecting: true, target: second },
  ]);
  assert.equal(first.src, "");
  assert.equal(second.src, "two.mp4");
  assert.deepEqual(unobserved, [second]);

  cleanup();
  assert.equal(disconnected, true);
});
