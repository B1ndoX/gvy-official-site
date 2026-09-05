import { initArchiveLightbox } from "./archive-lightbox.js";
import { initArchiveCarousel } from "./archive-carousel.js";
import { initCinematicTimelines } from "./cinematic-timelines.js";
import { initHeroVideo } from "./hero-video-controller.js";
import { initMemberBrawlDialog } from "./member-brawl-dialog.js";
import { initOperationMotion } from "./operation-motion.js";
import { initSectionNavigation } from "./section-navigation.js";

const LIFECYCLE_KEY = "__gvyCinematicHomepage";
const MOBILE_BREAKPOINT = 760;

function viewportWidth(view) {
  return Math.max(0, Number(view?.innerWidth || 0));
}

function viewportHeight(view) {
  const heights = [view?.innerHeight, view?.visualViewport?.height]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  return heights.length ? Math.min(...heights) : 1;
}

export function shouldIgnoreMobileHeightResize(previousWidth, nextWidth) {
  return previousWidth > 0
    && nextWidth > 0
    && Math.min(previousWidth, nextWidth) <= MOBILE_BREAKPOINT
    && Math.abs(nextWidth - previousWidth) < 1;
}

export function shouldSkipStartupRefresh({ width, coarsePointer = false } = {}) {
  return (Number.isFinite(Number(width)) && Number(width) <= MOBILE_BREAKPOINT)
    || Boolean(coarsePointer);
}

export function initStartupTimelineRefresh({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  timelines,
} = {}) {
  const coarsePointer = view.matchMedia?.("(pointer: coarse)")?.matches || false;
  if (shouldSkipStartupRefresh({ width: viewportWidth(view), coarsePointer })) return () => {};

  let cleaned = false;
  let refreshed = false;
  let frame = 0;
  const refreshOnce = () => {
    if (cleaned || refreshed) return;
    refreshed = true;
    if (typeof view.requestAnimationFrame === "function") {
      frame = view.requestAnimationFrame(() => {
        frame = 0;
        if (!cleaned) timelines?.refresh?.();
      });
    } else {
      timelines?.refresh?.();
    }
  };

  if (root?.readyState === "complete") refreshOnce();
  else view.addEventListener?.("load", refreshOnce, { once: true });

  return () => {
    cleaned = true;
    view.removeEventListener?.("load", refreshOnce);
    if (frame) view.cancelAnimationFrame?.(frame);
  };
}

export function initMobileViewportStability({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
} = {}) {
  const style = root?.documentElement?.style;
  let stableWidth = viewportWidth(view);

  const apply = () => {
    if (!style) return;
    if (stableWidth <= MOBILE_BREAKPOINT) {
      const height = viewportHeight(view);
      style.setProperty("--gvy-mobile-full-height", `${height}px`);
      style.setProperty("--gvy-mobile-hero-height", `${Number((height * 2.2).toFixed(3))}px`);
    } else {
      style.removeProperty("--gvy-mobile-full-height");
      style.removeProperty("--gvy-mobile-hero-height");
    }
  };

  const handleResize = () => {
    const nextWidth = viewportWidth(view);
    if (shouldIgnoreMobileHeightResize(stableWidth, nextWidth)) return;
    stableWidth = nextWidth;
    apply();
  };

  apply();
  view.addEventListener?.("resize", handleResize, { passive: true });
  return () => {
    view.removeEventListener?.("resize", handleResize);
    style?.removeProperty("--gvy-mobile-full-height");
    style?.removeProperty("--gvy-mobile-hero-height");
  };
}

function asCleanup(controller) {
  if (typeof controller === "function") return controller;
  if (typeof controller?.cleanup === "function") return () => controller.cleanup();
  return () => {};
}

export function initCinematicHomepage({ root = globalThis.document, view = globalThis } = {}) {
  if (!root) return { cleanup() {} };
  if (view[LIFECYCLE_KEY]) return view[LIFECYCLE_KEY];

  const motionAvailable = Boolean(view.gsap && view.ScrollTrigger);
  if (motionAvailable) root.documentElement?.setAttribute("data-motion-ready", "true");

  const viewportStability = initMobileViewportStability({ root, view });
  const hero = initHeroVideo({ root });
  const carousel = initArchiveCarousel({ root, view });
  const archive = initArchiveLightbox({ root });
  const brawl = initMemberBrawlDialog({ root });
  const operationMotion = initOperationMotion({ root, view });
  const sectionNavigation = initSectionNavigation({ root, view });
  const timelines = initCinematicTimelines({ root, gsap: view.gsap, ScrollTrigger: view.ScrollTrigger });
  const startupRefresh = initStartupTimelineRefresh({ root, view, timelines });
  root.documentElement?.setAttribute("data-motion-initialized", "true");
  root.documentElement?.removeAttribute("data-motion-pending");
  const cleanups = [
    viewportStability,
    hero,
    carousel,
    archive,
    brawl,
    operationMotion,
    sectionNavigation,
    timelines,
    startupRefresh,
  ]
    .map(asCleanup);
  let cleaned = false;

  const controller = {
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      view.removeEventListener?.("pagehide", onPageHide);
      cleanups.reverse().forEach((cleanup) => cleanup());
      root.documentElement?.removeAttribute("data-motion-ready");
      root.documentElement?.removeAttribute("data-motion-initialized");
      if (view[LIFECYCLE_KEY] === controller) delete view[LIFECYCLE_KEY];
    },
  };

  // BFCache freezes this document; its modules will not execute again on return.
  const onPageHide = (event) => {
    if (!event.persisted) controller.cleanup();
  };
  view.addEventListener?.("pagehide", onPageHide);
  view[LIFECYCLE_KEY] = controller;
  return controller;
}

if (globalThis.document) initCinematicHomepage();
