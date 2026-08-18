import assert from "node:assert/strict";
import test from "node:test";

import {
  initMobileViewportStability,
  shouldIgnoreMobileHeightResize,
} from "../assets/js/cinematic-homepage.js";

test("mobile browser chrome height changes are not treated as layout resizes", () => {
  assert.equal(shouldIgnoreMobileHeightResize(390, 390), true);
  assert.equal(shouldIgnoreMobileHeightResize(390, 844), false);
  assert.equal(shouldIgnoreMobileHeightResize(1440, 1440), false);
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
