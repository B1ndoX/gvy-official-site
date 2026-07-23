const MOBILE_BREAKPOINT = 760;
const COMPACT_BREAKPOINT = 1440;
const MAX_SCROLL_MOTION_WIDTH = 2560;

function mediaMatches(view, query) {
  return Boolean(view?.matchMedia?.(query)?.matches);
}

export function canPlayOperationMotion(view = globalThis) {
  if (mediaMatches(view, `(max-width: ${MOBILE_BREAKPOINT}px)`)) return false;
  if (Number(view?.innerWidth || 0) > MAX_SCROLL_MOTION_WIDTH) return false;
  if (mediaMatches(view, "(prefers-reduced-motion: reduce)")) return false;
  if (view?.navigator?.connection?.saveData) return false;
  return true;
}

export function selectOperationSource(video, view = globalThis) {
  if (!video?.dataset) return "";
  const useCompact = mediaMatches(view, `(max-width: ${COMPACT_BREAKPOINT}px)`);
  return (useCompact && video.dataset.srcCompact) || video.dataset.srcWide || "";
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
    mutation?.disconnect?.();
    root.removeEventListener?.("visibilitychange", handleVisibility);
    pauseAll();
    readyHandlers.forEach((handler, video) => {
      video.removeEventListener?.("playing", handler);
    });
  };
}
