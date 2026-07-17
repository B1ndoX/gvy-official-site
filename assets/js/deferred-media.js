export function assignDeferredSource(media) {
  if (!media?.dataset?.src || media.dataset.mediaInitialized === "true") return false;

  media.dataset.mediaInitialized = "true";
  media.preload = media.dataset.preload || "metadata";
  media.src = media.dataset.src;
  media.load?.();
  return true;
}

export function initDeferredMedia({
  root = globalThis.document,
  Observer = globalThis.IntersectionObserver,
  rootMargin = "100% 0px",
} = {}) {
  const targets = [...(root?.querySelectorAll?.("[data-deferred-media]") || [])];
  if (!targets.length) return () => {};

  if (typeof Observer !== "function") {
    targets.forEach(assignDeferredSource);
    return () => {};
  }

  const observer = new Observer(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        assignDeferredSource(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin, threshold: 0.01 },
  );

  targets.forEach((target) => observer.observe(target));
  return () => observer.disconnect();
}
