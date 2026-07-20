import assert from "node:assert/strict";
import test from "node:test";

import {
  getHeroMedia,
  initHeroVideo,
  readHeroRecord,
  resolveHeroSelection,
  resolveHeroVideo,
  writeHeroRecord,
} from "../assets/js/hero-video-controller.js";

function createHeroHarness() {
  const listeners = new Map();
  const video = {
    dataset: {},
    src: "",
    poster: "",
    loadCalls: 0,
    playCalls: 0,
    addEventListener(name, handler) {
      const handlers = listeners.get(name) || new Set();
      handlers.add(handler);
      listeners.set(name, handlers);
    },
    removeEventListener(name, handler) {
      listeners.get(name)?.delete(handler);
    },
    load() { this.loadCalls += 1; },
    play() { this.playCalls += 1; return Promise.resolve(); },
    dispatch(name) { listeners.get(name)?.forEach((handler) => handler()); },
  };
  const poster = { src: "" };
  const shell = { dataset: {} };
  const root = {
    querySelector(selector) {
      return {
        "[data-hero-video]": video,
        "[data-hero-poster]": poster,
        "[data-hero-shell]": shell,
      }[selector] || null;
    },
  };
  return { root, shell, poster, video };
}

test("avoids immediately repeating the previous hero", () => {
  const selection = resolveHeroSelection({
    record: { index: 0 },
    optionCount: 2,
    random: () => 0.99,
  });

  assert.deepEqual(selection, { index: 1, shouldPersist: true });
});

test("selects randomly on the first visit", () => {
  const selection = resolveHeroSelection({
    record: null,
    optionCount: 2,
    random: () => 0.99,
  });

  assert.deepEqual(selection, { index: 1, shouldPersist: true });
});

test("rejects invalid previous indexes", () => {
  const selection = resolveHeroSelection({
    record: { index: 3 },
    optionCount: 2,
    random: () => 0.1,
  });

  assert.deepEqual(selection, { index: 0, shouldPersist: true });
});

test("reads a valid record and tolerates unavailable storage", () => {
  const storage = {
    getItem: () => JSON.stringify({ index: 1 }),
  };
  assert.deepEqual(readHeroRecord(storage, "hero"), { index: 1 });

  assert.equal(
    readHeroRecord({ getItem: () => { throw new Error("blocked"); } }, "hero"),
    null,
  );
});

test("stores only the previous hero and tolerates storage failures", () => {
  let saved = null;
  const storage = { setItem: (_key, value) => { saved = JSON.parse(value); } };

  assert.equal(writeHeroRecord(storage, "hero", 1), true);
  assert.deepEqual(saved, { index: 1 });
  assert.equal(
    writeHeroRecord({ setItem: () => { throw new Error("blocked"); } }, "hero", 0),
    false,
  );
});

test("maps both enabled selections to their production videos and posters", () => {
  assert.deepEqual(getHeroMedia(0), {
    id: "01",
    video: "./assets/hero-random/v2/fleet-hero-01-1080p-v4.mp4?v=20260720-edgeone-v1",
    poster: "./assets/hero-random/v2/fleet-hero-01-poster-v2.webp?v=20260720-edgeone-v1",
  });
  assert.deepEqual(getHeroMedia(1), {
    id: "02",
    video: "./assets/hero-random/v2/fleet-hero-02-1080p-v4.mp4?v=20260720-edgeone-v1",
    videoLarge: "./assets/hero-random/v2/fleet-hero-02-1440p-v4.mp4?v=20260720-edgeone-v1",
    poster: "./assets/hero-random/v2/fleet-hero-02-poster-1440p-v3.webp?v=20260720-edgeone-v1",
  });
  assert.throws(() => getHeroMedia(2), RangeError);
});

test("selects one quality tier before assigning the hero source", () => {
  const media01 = getHeroMedia(0);
  const media02 = getHeroMedia(1);

  assert.equal(
    resolveHeroVideo(media01, { viewportWidth: 1_440, pixelRatio: 2, effectiveType: "4g" }).quality,
    "1080p",
  );
  assert.equal(
    resolveHeroVideo(media02, { viewportWidth: 1_440, pixelRatio: 2, effectiveType: "4g" }).quality,
    "1440p",
  );
  assert.equal(
    resolveHeroVideo(media02, { viewportWidth: 390, pixelRatio: 3, effectiveType: "4g" }).quality,
    "1080p",
  );
  assert.equal(
    resolveHeroVideo(media02, { viewportWidth: 2_560, pixelRatio: 1, effectiveType: "3g" }).quality,
    "1080p",
  );
  assert.equal(
    resolveHeroVideo(media02, { viewportWidth: 2_560, pixelRatio: 1, saveData: true }).quality,
    "1080p",
  );
});

test("browser controller assigns only the selected video after choosing", () => {
  const harness = createHeroHarness();
  let saved = null;
  const storage = {
    getItem: () => null,
    setItem: (_key, value) => { saved = JSON.parse(value); },
  };

  const controller = initHeroVideo({
    root: harness.root,
    storage,
    random: () => 0.99,
    reducedMotion: false,
  });

  assert.equal(controller.index, 1);
  assert.equal(harness.poster.src, getHeroMedia(1).poster);
  assert.equal(harness.video.poster, getHeroMedia(1).poster);
  assert.equal(harness.video.src, getHeroMedia(1).video);
  assert.equal(harness.video.dataset.heroVideoQuality, "1080p");
  assert.equal(harness.video.loadCalls, 1);
  assert.equal(harness.shell.dataset.heroState, "loading");
  assert.equal(saved.index, 1);

  harness.video.dispatch("canplay");
  assert.equal(harness.video.playCalls, 1);
  harness.video.dispatch("playing");
  assert.equal(harness.shell.dataset.heroState, "playing");
  harness.video.dispatch("error");
  assert.equal(harness.shell.dataset.heroState, "poster");
  controller.cleanup();
});

test("reduced motion keeps the matching poster without assigning video src", () => {
  const harness = createHeroHarness();
  let saved = null;
  const storage = {
    getItem: () => JSON.stringify({ index: 1 }),
    setItem: (_key, value) => { saved = JSON.parse(value); },
  };

  const controller = initHeroVideo({
    root: harness.root,
    storage,
    reducedMotion: true,
  });

  assert.equal(controller.index, 0);
  assert.equal(harness.poster.src, getHeroMedia(0).poster);
  assert.equal(harness.video.src, "");
  assert.equal(harness.video.loadCalls, 0);
  assert.equal(harness.shell.dataset.heroState, "poster");
  assert.deepEqual(saved, { index: 0 });
  controller.cleanup();
});
