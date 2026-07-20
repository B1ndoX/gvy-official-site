import { initArchiveLightbox } from "./archive-lightbox.js";
import { initArchiveCarousel } from "./archive-carousel.js?v=20260720-hero-intro-v21";
import { initCinematicTimelines } from "./cinematic-timelines.js?v=20260720-hero-intro-v21";
import { initDeferredMedia } from "./deferred-media.js";
import { initHeroVideo } from "./hero-video-controller.js?v=20260720-hero-intro-v21";
import { initMemberBrawlDialog } from "./member-brawl-dialog.js?v=20260720-brawl-frame-v16";

const LIFECYCLE_KEY = "__gvyCinematicHomepage";

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

  const hero = initHeroVideo({ root });
  const deferred = initDeferredMedia({ root, rootMargin: "100% 0px" });
  const carousel = initArchiveCarousel({ root, view });
  const archive = initArchiveLightbox({ root });
  const brawl = initMemberBrawlDialog({ root });
  const timelines = initCinematicTimelines({ root, gsap: view.gsap, ScrollTrigger: view.ScrollTrigger });
  root.documentElement?.removeAttribute("data-motion-pending");
  const cleanups = [hero, deferred, carousel, archive, brawl, timelines].map(asCleanup);
  let cleaned = false;

  const refresh = () => view.requestAnimationFrame?.(() => timelines.refresh?.());
  const fontsReady = root.fonts?.ready || Promise.resolve();
  Promise.resolve(fontsReady).then(refresh).catch(() => {});
  view.addEventListener?.("load", refresh, { once: true });

  const controller = {
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      view.removeEventListener?.("load", refresh);
      view.removeEventListener?.("pagehide", controller.cleanup);
      cleanups.reverse().forEach((cleanup) => cleanup());
      root.documentElement?.removeAttribute("data-motion-ready");
      if (view[LIFECYCLE_KEY] === controller) delete view[LIFECYCLE_KEY];
    },
  };

  view.addEventListener?.("pagehide", controller.cleanup, { once: true });
  view[LIFECYCLE_KEY] = controller;
  return controller;
}

if (globalThis.document) initCinematicHomepage();
