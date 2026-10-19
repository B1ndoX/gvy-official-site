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
    paused: true,
    currentTime: 0,
    loadCalls: 0,
    playCalls: 0,
    pauseCalls: 0,
    addEventListener(name, handler) {
      const handlers = listeners.get(name) || new Set();
      handlers.add(handler);
      listeners.set(name, handlers);
    },
    removeEventListener(name, handler) {
      listeners.get(name)?.delete(handler);
    },
    load() { this.loadCalls += 1; },
    play() { this.playCalls += 1; this.paused = false; return Promise.resolve(); },
    pause() { this.pauseCalls += 1; this.paused = true; },
    dispatch(name) { listeners.get(name)?.forEach((handler) => handler()); },
  };
  const poster = { src: "" };
  const shell = { dataset: {} };
  const root = {
    visibilityState: "visible",
    addEventListener(name, handler) { listeners.set(`document:${name}`, new Set([handler])); },
    removeEventListener(name, handler) { listeners.get(`document:${name}`)?.delete(handler); },
    dispatch(name) { listeners.get(`document:${name}`)?.forEach((handler) => handler()); },
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

function createVisibilityHarness({ bounds = { top: 0, bottom: 844 } } = {}) {
  const harness = createHeroHarness();
  harness.shell.getBoundingClientRect = () => bounds;
  const observers = [];
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
    intersect(isIntersecting) { this.callback([{ target: this.target, isIntersecting }]); }
  }
  const controller = initHeroVideo({
    root: harness.root,
    view: { innerHeight: 844 },
    Observer,
    random: () => 0,
    reducedMotion: false,
  });
  return { ...harness, controller, observers };
}

test("hero starts before its first intersection callback and pauses offscreen without reloading", () => {
  const { video, shell, controller, observers } = createVisibilityHarness();
  video.dispatch("canplay");
  video.dispatch("playing");
  video.readyState = 4;
  video.currentTime = 6.25;
  const source = video.src;
  assert.equal(video.playCalls, 1, "first-screen autoplay must not wait for an observer");
  assert.equal(observers.length, 1);
  assert.deepEqual(observers[0].options, { threshold: 0, rootMargin: "844px 0px" });
  observers[0].intersect(false);
  assert.equal(video.paused, true);
  video.dispatch("canplay");
  assert.equal(video.playCalls, 1, "a delayed readiness event must not restart an offscreen video");
  assert.equal(video.currentTime, 6.25);
  assert.equal(shell.dataset.heroState, "playing", "retain the current frame instead of flashing the poster");
  observers[0].intersect(true);
  assert.equal(video.paused, false);
  assert.equal(video.playCalls, 2);
  assert.equal(video.currentTime, 6.25);
  assert.equal(video.src, source);
  assert.equal(video.loadCalls, 1);
  controller.cleanup();
  assert.equal(observers[0].disconnected, true);
  assert.equal(video.paused, true);
  observers[0].intersect(true);
  assert.equal(video.playCalls, 2, "disposed callbacks cannot restart playback");
});

test("hero starts while approaching the viewport so its first visible frame is already playing", () => {
  const { video, controller } = createVisibilityHarness({ bounds: { top: -1244, bottom: -400 } });
  video.dispatch("canplay");
  assert.equal(video.paused, false, "resume while the entire hero is still above the screen");
  assert.equal(video.playCalls, 1);
  controller.cleanup();
});

test("hero stays paused beyond its offscreen runway even if media is ready", () => {
  const { video, controller } = createVisibilityHarness({ bounds: { top: -1844, bottom: -1000 } });
  video.readyState = 4;
  video.dispatch("canplay");
  assert.equal(video.paused, true);
  assert.equal(video.playCalls, 0);
  controller.cleanup();
});

test("document visibility resumes only a nearby hero and cleanup removes the listener", () => {
  const { root, video, controller, observers } = createVisibilityHarness();
  video.readyState = 4;
  video.dispatch("canplay");
  root.visibilityState = "hidden";
  root.dispatch("visibilitychange");
  assert.equal(video.paused, true);
  observers[0].intersect(true);
  assert.equal(video.playCalls, 1);
  root.visibilityState = "visible";
  root.dispatch("visibilitychange");
  assert.equal(video.playCalls, 2);
  observers[0].intersect(false);
  root.visibilityState = "hidden";
  root.dispatch("visibilitychange");
  root.visibilityState = "visible";
  root.dispatch("visibilitychange");
  assert.equal(video.playCalls, 2, "returning to a background tab must not resume an offscreen hero");
  controller.cleanup();
  root.dispatch("visibilitychange");
  assert.equal(video.playCalls, 2);
});

test("an interrupted old play request cannot replace a resumed video with its poster", async () => {
  const { video, shell, controller, observers } = createVisibilityHarness();
  let rejectOldPlay;
  video.play = function () {
    this.playCalls += 1;
    this.paused = false;
    return this.playCalls === 1
      ? new Promise((_resolve, reject) => { rejectOldPlay = reject; })
      : Promise.resolve();
  };
  video.readyState = 4;
  video.dispatch("canplay");
  observers[0].intersect(false);
  observers[0].intersect(true);
  video.dispatch("playing");
  rejectOldPlay(Object.assign(new Error("paused"), { name: "AbortError" }));
  await Promise.resolve();
  assert.equal(shell.dataset.heroState, "playing");
  assert.equal(video.playCalls, 2);
  assert.equal(video.paused, false);
  controller.cleanup();
});

test("keeps the same hero during a short refresh window", () => {
  const selection = resolveHeroSelection({
    record: { index: 0, selectedAt: 1_000 },
    optionCount: 2,
    random: () => 0.99,
    now: 2_000,
  });

  assert.deepEqual(selection, { index: 0, shouldPersist: false });
});

test("keeps the selected hero stable for ten minutes", () => {
  assert.equal(HERO_STICKY_TTL_MS, 10 * 60 * 1_000);
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

test("maps all three enabled selections to their production videos and posters", () => {
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
  assert.deepEqual(getHeroMedia(2), {
    id: "03",
    video: "./assets/hero-random/v2/fleet-hero-03-1080p-v1.mp4?v=20260720-edgeone-v1",
    videoMobile: "./assets/hero-random/v2/fleet-hero-03-mobile-720p-v1.mp4?v=20260720-edgeone-v1",
    poster: "./assets/hero-random/v2/fleet-hero-03-poster-v1.webp?v=20260720-edgeone-v1",
  });
  assert.throws(() => getHeroMedia(3), RangeError);
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
    "1080p",
  );
  assert.equal(
    resolveHeroVideo(media02, { viewportWidth: 2_560, pixelRatio: 1, effectiveType: "4g" }).quality,
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

  assert.equal(controller.index, 2);
  assert.equal(harness.poster.src, getHeroMedia(2).poster);
  assert.equal(harness.video.poster, getHeroMedia(2).poster);
  assert.equal(harness.video.src, getHeroMedia(2).videoMobile);
  assert.equal(harness.video.dataset.heroVideoQuality, "720p");
  assert.equal(harness.video.loadCalls, 1);
  assert.equal(harness.shell.dataset.heroState, "loading");
  assert.equal(saved.index, 2);
  assert.equal(saved.selectedAt, 12_345);

  harness.video.dispatch("canplay");
  assert.equal(harness.video.playCalls, 1);
  harness.video.dispatch("playing");
  assert.equal(harness.shell.dataset.heroState, "playing");
  harness.video.dispatch("stalled");
  harness.video.dispatch("waiting");
  assert.equal(harness.shell.dataset.heroState, "playing");
  assert.equal(harness.video.playCalls, 1);
  assert.equal(harness.video.loadCalls, 1);
  harness.video.dispatch("error");
  assert.equal(harness.shell.dataset.heroState, "poster");
  controller.cleanup();
});

test("browser controller reuses the synchronously bootstrapped source", () => {
  const harness = createHeroHarness();
  const media = resolveHeroVideo(getHeroMedia(1), { viewportWidth: 390, pixelRatio: 3 });
  harness.video.src = media.video;
  harness.video.poster = media.poster;
  harness.video.dataset.heroVideoSelected = media.id;
  harness.video.dataset.heroVideoQuality = media.quality;
  harness.video.readyState = 4;
  harness.video.paused = false;

  const controller = initHeroVideo({
    root: harness.root,
    bootstrap: {
      index: 1,
      id: media.id,
      video: media.video,
      poster: media.poster,
      quality: media.quality,
    },
    reducedMotion: false,
    viewportWidth: 2_560,
    pixelRatio: 1,
  });

  assert.equal(controller.index, 1);
  assert.equal(controller.media.quality, "720p");
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
