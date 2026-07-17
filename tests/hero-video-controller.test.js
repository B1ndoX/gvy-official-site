import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_CACHE_TTL_MS,
  getHeroMedia,
  initHeroVideo,
  readHeroRecord,
  resolveHeroSelection,
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

test("uses the cached index while the seven-day record is valid", () => {
  const selection = resolveHeroSelection({
    record: { index: 1, expiresAt: 2_000 },
    now: 1_000,
    optionCount: 2,
    random: () => 0,
  });

  assert.deepEqual(selection, { index: 1, shouldPersist: false });
});

test("selects deterministically when the record is expired", () => {
  const selection = resolveHeroSelection({
    record: { index: 0, expiresAt: 999 },
    now: 1_000,
    optionCount: 2,
    random: () => 0.99,
  });

  assert.deepEqual(selection, { index: 1, shouldPersist: true });
});

test("rejects invalid cached indexes", () => {
  const selection = resolveHeroSelection({
    record: { index: 3, expiresAt: 2_000 },
    now: 1_000,
    optionCount: 2,
    random: () => 0.1,
  });

  assert.deepEqual(selection, { index: 0, shouldPersist: true });
});

test("reads a valid record and tolerates unavailable storage", () => {
  const storage = {
    getItem: () => JSON.stringify({ index: 1, expiresAt: 2_000 }),
  };
  assert.deepEqual(readHeroRecord(storage, "hero"), { index: 1, expiresAt: 2_000 });

  assert.equal(
    readHeroRecord({ getItem: () => { throw new Error("blocked"); } }, "hero"),
    null,
  );
});

test("writes an explicit seven-day expiration and tolerates storage failures", () => {
  let saved = null;
  const storage = { setItem: (_key, value) => { saved = JSON.parse(value); } };

  assert.equal(writeHeroRecord(storage, "hero", 1, 1_000), true);
  assert.deepEqual(saved, { index: 1, expiresAt: 1_000 + HERO_CACHE_TTL_MS });
  assert.equal(
    writeHeroRecord({ setItem: () => { throw new Error("blocked"); } }, "hero", 0, 1_000),
    false,
  );
});

test("maps each selection to one matching v2 video and poster", () => {
  assert.deepEqual(getHeroMedia(0), {
    id: "01",
    video: "./assets/hero-random/v2/fleet-hero-01-1080p-v2.mp4",
    poster: "./assets/hero-random/v2/fleet-hero-01-poster-v2.webp",
  });
  assert.deepEqual(getHeroMedia(1), {
    id: "02",
    video: "./assets/hero-random/v2/fleet-hero-02-1080p-v2.mp4",
    poster: "./assets/hero-random/v2/fleet-hero-02-poster-v2.webp",
  });
  assert.throws(() => getHeroMedia(2), RangeError);
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
    now: 1_000,
    random: () => 0.99,
    reducedMotion: false,
  });

  assert.equal(controller.index, 1);
  assert.equal(harness.poster.src, getHeroMedia(1).poster);
  assert.equal(harness.video.poster, getHeroMedia(1).poster);
  assert.equal(harness.video.src, getHeroMedia(1).video);
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
  const storage = {
    getItem: () => JSON.stringify({ index: 0, expiresAt: 2_000 }),
    setItem: () => { throw new Error("should not persist valid cache"); },
  };

  const controller = initHeroVideo({
    root: harness.root,
    storage,
    now: 1_000,
    reducedMotion: true,
  });

  assert.equal(controller.index, 0);
  assert.equal(harness.poster.src, getHeroMedia(0).poster);
  assert.equal(harness.video.src, "");
  assert.equal(harness.video.loadCalls, 0);
  assert.equal(harness.shell.dataset.heroState, "poster");
  controller.cleanup();
});
