import assert from "node:assert/strict";
import test from "node:test";

import {
  initStartupTimelineRefresh,
  initMobileViewportStability,
  shouldIgnoreMobileHeightResize,
  shouldSkipStartupRefresh,
} from "../assets/js/cinematic-homepage.js";

test("mobile browser chrome height changes are not treated as layout resizes", () => {
  assert.equal(shouldIgnoreMobileHeightResize(390, 390), true);
  assert.equal(shouldIgnoreMobileHeightResize(390, 844), false);
  assert.equal(shouldIgnoreMobileHeightResize(1440, 1440), false);
});

test("startup refresh is allowed on desktop and skipped on phones", () => {
  assert.equal(shouldSkipStartupRefresh({ width: 390 }), true);
  assert.equal(shouldSkipStartupRefresh({ width: 844, coarsePointer: true }), true);
  assert.equal(shouldSkipStartupRefresh({ width: 1512 }), false);
});

test("desktop startup performs one timeline refresh after page load", () => {
  const listeners = new Map();
  let refreshCount = 0;
  let frameCallback;
  const root = { readyState: "loading" };
  const view = {
    innerWidth: 1512,
    matchMedia: () => ({ matches: false }),
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
    requestAnimationFrame(callback) { frameCallback = callback; return 7; },
    cancelAnimationFrame() {},
  };

  const cleanup = initStartupTimelineRefresh({
    root,
    view,
    timelines: { refresh() { refreshCount += 1; } },
  });
  const onLoad = listeners.get("load");
  assert.equal(typeof onLoad, "function");
  onLoad();
  onLoad();
  assert.equal(refreshCount, 0);
  frameCallback();
  assert.equal(refreshCount, 1);

  cleanup();
  assert.equal(listeners.has("load"), false);
});

test("phone startup never registers or performs a global timeline refresh", () => {
  const listeners = new Map();
  let refreshCount = 0;
  const cleanup = initStartupTimelineRefresh({
    root: { readyState: "loading" },
    view: {
      innerWidth: 390,
      matchMedia: () => ({ matches: true }),
      addEventListener(type, callback) { listeners.set(type, callback); },
    },
    timelines: { refresh() { refreshCount += 1; } },
  });

  assert.equal(listeners.has("load"), false);
  assert.equal(refreshCount, 0);
  cleanup();
});

test("mobile stability keeps one height until width or orientation really changes", () => {
  const properties = new Map();
  const listeners = new Map();
  const style = {
    setProperty(name, value) { properties.set(name, value); },
    removeProperty(name) { properties.delete(name); },
  };
  const root = { documentElement: { style } };
  const view = {
    innerWidth: 390,
    innerHeight: 844,
    visualViewport: { width: 390, height: 844 },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
  };
  root.defaultView = view;

  const cleanup = initMobileViewportStability({ root, view });
  assert.equal(properties.get("--gvy-mobile-full-height"), "844px");
  assert.equal(properties.get("--gvy-mobile-hero-height"), "1856.8px");

  view.innerHeight = 760;
  view.visualViewport.height = 760;
  listeners.get("resize")();
  assert.equal(properties.get("--gvy-mobile-full-height"), "844px");

  view.innerWidth = 430;
  view.visualViewport.width = 430;
  listeners.get("resize")();
  assert.equal(properties.get("--gvy-mobile-full-height"), "760px");

  cleanup();
  assert.equal(properties.has("--gvy-mobile-full-height"), false);
  assert.equal(properties.has("--gvy-mobile-hero-height"), false);
});
