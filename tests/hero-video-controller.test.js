import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_STICKY_TTL_MS,
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

test("keeps the same hero during a short refresh window", () => {
  const selection = resolveHeroSelection({
    record: { index: 0, selectedAt: 1_000 },
    optionCount: 2,
    random: () => 0.99,
    now: 2_000,
  });

  assert.deepEqual(selection, { index: 0, shouldPersist: false });
});

test("keeps the selected hero stable for the legacy seven-day window", () => {
  assert.equal(HERO_STICKY_TTL_MS, 7 * 24 * 60 * 60 * 1_000);
});

test("selects again after the sticky refresh window expires", () => {
  const selection = resolveHeroSelection({
    record: { index: 0, selectedAt: 1_000 },
    optionCount: 2,
    random: () => 0.99,
    now: 1_000 + HERO_STICKY_TTL_MS,
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
    getItem: () => JSON.stringify({ index: 1, selectedAt: 12_345 }),
  };
  assert.deepEqual(readHeroRecord(storage, "hero"), { index: 1, selectedAt: 12_345 });

  assert.equal(
    readHeroRecord({ getItem: () => { throw new Error("blocked"); } }, "hero"),
    null,
  );
});

test("stores the selected hero with its sticky timestamp and tolerates storage failures", () => {
  let saved = null;
  const storage = { setItem: (_key, value) => { saved = JSON.parse(value); } };

  assert.equal(writeHeroRecord(storage, "hero", 1, 12_345), true);
  assert.deepEqual(saved, { index: 1, selectedAt: 12_345 });
  assert.equal(
    writeHeroRecord({ setItem: () => { throw new Error("blocked"); } }, "hero", 0),
    false,
  );
});

test("maps both enabled selections to their production videos and posters", () => {
  assert.deepEqual(getHeroMedia(0), {
    id: "01",
    video: "./assets/hero-random/v2/fleet-hero-01-1080p-v4.mp4?v=20260720-edgeone-v1",
    videoMobile: "./assets/hero-random/v2/fleet-hero-01-mobile-720p-v1.mp4?v=20260720-edgeone-v1",
    poster: "./assets/hero-random/v2/fleet-hero-01-poster-v2.webp?v=20260720-edgeone-v1",
  });
  assert.deepEqual(getHeroMedia(1), {
    id: "02",
    video: "./assets/hero-random/v2/fleet-hero-02-1080p-v4.mp4?v=20260720-edgeone-v1",
    videoMobile: "./assets/hero-random/v2/fleet-hero-02-mobile-720p-v1.mp4?v=20260720-edgeone-v1",
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
    "720p",
  );
  assert.equal(
    resolveHeroVideo(media02, { viewportWidth: 2_560, pixelRatio: 1, effectiveType: "3g" }).quality,
    "720p",
  );
  assert.equal(
    resolveHeroVideo(media02, { viewportWidth: 2_560, pixelRatio: 1, saveData: true }).quality,
    "720p",
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
    viewportWidth: 390,
    now: 12_345,
  });

  assert.equal(controller.index, 1);
  assert.equal(harness.poster.src, getHeroMedia(1).poster);
  assert.equal(harness.video.poster, getHeroMedia(1).poster);
  assert.equal(harness.video.src, getHeroMedia(1).videoMobile);
  assert.equal(harness.video.dataset.heroVideoQuality, "720p");
  assert.equal(harness.video.loadCalls, 1);
  assert.equal(harness.shell.dataset.heroState, "loading");
  assert.equal(saved.index, 1);
  assert.equal(saved.selectedAt, 12_345);

  harness.video.dispatch("canplay");
  assert.equal(harness.video.playCalls, 1);
  harness.video.dispatch("playing");
  assert.equal(harness.shell.dataset.heroState, "playing");
  harness.video.dispatch("error");
  assert.equal(harness.shell.dataset.heroState, "poster");
  controller.cleanup();
});

test("browser controller reuses the synchronously bootstrapped source", () => {
  const harness = createHeroHarness();
  const media = resolveHeroVideo(getHeroMedia(1), { viewportWidth: 390, pixelRatio: 3 });
  harness.video.src = media.video;
  harness.video.dataset.heroVideoSelected = media.id;
  harness.video.dataset.heroVideoQuality = media.quality;
  harness.video.readyState = 4;
  harness.video.paused = false;

  const controller = initHeroVideo({
    root: harness.root,
    bootstrap: { index: 1 },
    reducedMotion: false,
    viewportWidth: 390,
    pixelRatio: 3,
  });

  assert.equal(controller.index, 1);
  assert.equal(harness.video.src, media.video);
  assert.equal(harness.video.loadCalls, 0);
  assert.equal(harness.video.playCalls, 0);
  assert.equal(harness.shell.dataset.heroState, "playing");
  controller.cleanup();
});

test("reduced motion keeps the matching poster without assigning video src", () => {
  const harness = createHeroHarness();
  let saved = null;
  const storage = {
    getItem: () => JSON.stringify({ index: 1, selectedAt: 12_000 }),
    setItem: (_key, value) => { saved = JSON.parse(value); },
  };

  const controller = initHeroVideo({
    root: harness.root,
    storage,
    reducedMotion: true,
    now: 12_345,
  });

  assert.equal(controller.index, 1);
  assert.equal(harness.poster.src, getHeroMedia(1).poster);
  assert.equal(harness.video.src, "");
  assert.equal(harness.video.loadCalls, 0);
  assert.equal(harness.shell.dataset.heroState, "poster");
  assert.equal(saved, null);
  controller.cleanup();
});
