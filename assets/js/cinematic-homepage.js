import { initArchiveLightbox } from "./archive-lightbox.js?v=20260729-gallery-lightbox-webp-v61";
import { initArchiveCarousel } from "./archive-carousel.js?v=20260730-gallery-speed-v68";
import { initCinematicTimelines } from "./cinematic-timelines.js?v=20260730-2k-hero-copy-v70";
import { initHeroVideo } from "./hero-video-controller.js?v=20260729-hero-source-lock-v60";
import { initMemberBrawlDialog } from "./member-brawl-dialog.js?v=20260729-production-trim-v62";
import { initOperationMotion } from "./operation-motion.js?v=20260727-operation-preplay-v37";
import { initSectionNavigation } from "./section-navigation.js?v=20260726-nav-video-quality-v32";

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
  const carousel = initArchiveCarousel({ root, view });
  const archive = initArchiveLightbox({ root });
  const brawl = initMemberBrawlDialog({ root });
  const operationMotion = initOperationMotion({ root, view });
  const sectionNavigation = initSectionNavigation({ root, view });
  const timelines = initCinematicTimelines({ root, gsap: view.gsap, ScrollTrigger: view.ScrollTrigger });
  root.documentElement?.setAttribute("data-motion-initialized", "true");
  root.documentElement?.removeAttribute("data-motion-pending");
  const cleanups = [hero, carousel, archive, brawl, operationMotion, sectionNavigation, timelines].map(asCleanup);
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
      root.documentElement?.removeAttribute("data-motion-initialized");
      if (view[LIFECYCLE_KEY] === controller) delete view[LIFECYCLE_KEY];
    },
  };

  view.addEventListener?.("pagehide", controller.cleanup, { once: true });
  view[LIFECYCLE_KEY] = controller;
  return controller;
}

if (globalThis.document) initCinematicHomepage();
