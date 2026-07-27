const MOBILE_BREAKPOINT = 760;
const COMPACT_BREAKPOINT = 1440;
const MAX_SCROLL_MOTION_WIDTH = 2560;

function mediaMatches(view, query) {
  return Boolean(view?.matchMedia?.(query)?.matches);
}

export function canPlayOperationMotion(view = globalThis) {
  if (Number(view?.innerWidth || 0) > MAX_SCROLL_MOTION_WIDTH) return false;
  if (mediaMatches(view, "(prefers-reduced-motion: reduce)")) return false;
  if (view?.navigator?.connection?.saveData) return false;
  return true;
}

export function selectOperationSource(video, view = globalThis) {
  if (!video?.dataset) return "";
  const useMobile = mediaMatches(view, `(max-width: ${MOBILE_BREAKPOINT}px)`);
  const useCompact = mediaMatches(view, `(max-width: ${COMPACT_BREAKPOINT}px)`);
  return (useMobile && video.dataset.srcMobile)
    || (useCompact && video.dataset.srcCompact)
    || video.dataset.srcWide
    || "";
}

export function assignOperationSource(video, view = globalThis) {
  if (!video || video.dataset?.motionInitialized === "true") return false;
  const source = selectOperationSource(video, view);
  if (!source) return false;

  video.dataset.motionInitialized = "true";
  video.preload = "metadata";
  video.src = source;
  video.load?.();
  return true;
}

export function selectMobileOperationIndex(visuals, view = globalThis, fallbackIndex = 0) {
  const activationLine = Math.max(0, Number(view?.innerHeight || 0));
  return visuals.reduce((selectedIndex, visual, index) => {
    const top = Number(visual?.getBoundingClientRect?.().top);
    return Number.isFinite(top) && top <= activationLine ? index : selectedIndex;
  }, fallbackIndex);
}

export function initOperationMotion({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  Observer = view?.IntersectionObserver,
  Mutation = view?.MutationObserver,
  rootMargin = "55% 0px",
} = {}) {
  const section = root?.querySelector?.("[data-operations-section]");
  const videos = [...(section?.querySelectorAll?.("[data-operation-video]") || [])];
  if (!section || !videos.length || !canPlayOperationMotion(view)) return () => {};

  let sectionNearby = false;
  let activeIndex = Number.parseInt(section.dataset.operationActive || "0", 10) || 0;
  const mobileLayout = mediaMatches(view, `(max-width: ${MOBILE_BREAKPOINT}px)`);
  const readyHandlers = new Map();

  const pauseAll = (exceptIndex = -1) => {
    videos.forEach((video, index) => {
      if (index !== exceptIndex) video.pause?.();
    });
  };

  const playActive = () => {
    if (!sectionNearby || root.visibilityState === "hidden") {
      pauseAll();
      return;
    }

    const nextVideo = videos[Math.max(0, Math.min(activeIndex, videos.length - 1))];
    if (!nextVideo) return;
    pauseAll(activeIndex);
    assignOperationSource(nextVideo, view);
    const playback = nextVideo.play?.();
    playback?.catch?.(() => {});
  };

  videos.forEach((video) => {
    const markReady = () => video.classList?.add("is-ready");
    readyHandlers.set(video, markReady);
    video.addEventListener?.("playing", markReady);
  });

  let observer;
  if (typeof Observer === "function") {
    observer = new Observer(
      (entries) => {
        const entry = entries.find(({ target }) => target === section);
        if (!entry) return;
        sectionNearby = entry.isIntersecting;
        playActive();
      },
      { rootMargin, threshold: 0.01 },
    );
    observer.observe(section);
  } else {
    sectionNearby = true;
    playActive();
  }

  let cardObserver;
  let warmObserver;
  if (mobileLayout && typeof Observer === "function") {
    const visuals = [...(section.querySelectorAll?.("[data-operation-visual]") || [])];
    const syncMobileActive = () => {
      const next = selectMobileOperationIndex(visuals, view, activeIndex);
      if (next === activeIndex) return;
      activeIndex = next;
      section.dataset.operationActive = String(next);
      playActive();
    };

    warmObserver = new Observer(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number.parseInt(entry.target?.dataset?.operationVisual || "-1", 10);
          if (index >= 0) assignOperationSource(videos[index], view);
        });
      },
      { rootMargin: "0px 0px 35% 0px", threshold: 0.01 },
    );

    cardObserver = new Observer(
      syncMobileActive,
      { rootMargin: "0px", threshold: [0, 0.01] },
    );
    visuals.forEach((visual) => {
      warmObserver.observe(visual);
      cardObserver.observe(visual);
    });
  }

  const mutation = typeof Mutation === "function"
    ? new Mutation(() => {
        const nextIndex = Number.parseInt(section.dataset.operationActive || "0", 10) || 0;
        if (nextIndex === activeIndex) return;
        activeIndex = nextIndex;
        playActive();
      })
    : null;
  mutation?.observe(section, { attributes: true, attributeFilter: ["data-operation-active"] });

  const handleVisibility = () => playActive();
  root.addEventListener?.("visibilitychange", handleVisibility);

  return () => {
    observer?.disconnect?.();
    cardObserver?.disconnect?.();
    warmObserver?.disconnect?.();
    mutation?.disconnect?.();
    root.removeEventListener?.("visibilitychange", handleVisibility);
    pauseAll();
    readyHandlers.forEach((handler, video) => {
      video.removeEventListener?.("playing", handler);
    });
  };
}
