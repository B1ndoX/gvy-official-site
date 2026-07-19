export function wrapCarouselIndex(index, length) {
  if (!Number.isInteger(length) || length < 1) throw new RangeError("Carousel length must be positive");
  return ((index % length) + length) % length;
}

export function getClosestCardIndex(viewport, cards) {
  if (!viewport || !cards?.length) return 0;
  const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(cardCenter - viewportCenter);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function initArchiveCarousel({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  gsap = globalThis.gsap,
  intervalMs = 4800,
  Observer = view?.IntersectionObserver,
} = {}) {
  const archiveIndex = root?.querySelector?.("[data-archive-index]");
  const viewport = archiveIndex?.querySelector?.(".archive-grid-viewport");
  const track = archiveIndex?.querySelector?.("[data-archive-grid]");
  const cards = Array.from(track?.querySelectorAll?.("button") || []);
  const currentLabel = archiveIndex?.querySelector?.("[data-archive-current]");
  const controls = archiveIndex?.querySelector?.(".archive-gallery-controls");
  const previous = archiveIndex?.querySelector?.("[data-archive-carousel-prev]");
  const next = archiveIndex?.querySelector?.("[data-archive-carousel-next]");
  const toggle = archiveIndex?.querySelector?.("[data-archive-carousel-toggle]");

  if (!archiveIndex || !viewport || !track || cards.length < 2) {
    return { cleanup() {} };
  }

  const reducedMotion = Boolean(view?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const frame = view?.requestAnimationFrame?.bind(view) || ((callback) => setTimeout(callback, 16));
  const cancelFrame = view?.cancelAnimationFrame?.bind(view) || clearTimeout;
  const setTimer = view?.setTimeout?.bind(view) || setTimeout;
  const clearTimer = view?.clearTimeout?.bind(view) || clearTimeout;
  let activeIndex = 0;
  let autoTimer = 0;
  let scrollFrame = 0;
  let resizeFrame = 0;
  let inView = !Observer;
  let hovering = false;
  let focusWithin = false;
  let manuallyPaused = reducedMotion;
  let dragging = false;
  let moved = false;
  let suppressClick = false;
  let pointerId = null;
  let startX = 0;
  let startScrollLeft = 0;
  let lastX = 0;
  let lastTime = 0;

  function updateToggle() {
    controls?.classList.toggle("is-paused", manuallyPaused);
    if (!toggle) return;
    toggle.setAttribute("aria-pressed", String(manuallyPaused));
    toggle.setAttribute("aria-label", manuallyPaused ? "继续自动切换" : "暂停自动切换");
    if (reducedMotion) {
      toggle.disabled = true;
      toggle.setAttribute("aria-label", "已按系统设置关闭自动切换");
    }
  }

  function updateActive(nextIndex) {
    const normalized = wrapCarouselIndex(nextIndex, cards.length);
    if (normalized !== activeIndex) {
      cards[activeIndex]?.classList.remove("is-current");
      cards[activeIndex]?.removeAttribute("aria-current");
    }
    activeIndex = normalized;
    cards[activeIndex].classList.add("is-current");
    cards[activeIndex].setAttribute("aria-current", "true");
    if (currentLabel) currentLabel.textContent = String(activeIndex + 1).padStart(3, "0");
    archiveIndex.style.setProperty(
      "--archive-index-progress",
      String(activeIndex / Math.max(1, cards.length - 1)),
    );
  }

  function targetScrollLeft(index) {
    const card = cards[wrapCarouselIndex(index, cards.length)];
    return card.offsetLeft - (viewport.clientWidth - card.offsetWidth) / 2;
  }

  function stopAuto() {
    if (!autoTimer) return;
    clearTimer(autoTimer);
    autoTimer = 0;
  }

  function canAutoPlay() {
    return !reducedMotion
      && !manuallyPaused
      && !hovering
      && !focusWithin
      && !dragging
      && inView
      && !root.hidden;
  }

  function scheduleAuto() {
    stopAuto();
    if (!canAutoPlay()) return;
    autoTimer = setTimer(() => {
      autoTimer = 0;
      goTo(activeIndex + 1, { source: "auto" });
    }, intervalMs);
  }

  function goTo(index, { behavior = reducedMotion ? "auto" : "smooth", source = "manual" } = {}) {
    const normalized = wrapCarouselIndex(index, cards.length);
    updateActive(normalized);
    viewport.scrollTo?.({ left: targetScrollLeft(normalized), behavior });
    if (source !== "scroll") scheduleAuto();
  }

  function syncFromScroll() {
    scrollFrame = 0;
    if (dragging) return;
    updateActive(getClosestCardIndex(viewport, cards));
  }

  function handleScroll() {
    if (scrollFrame) return;
    scrollFrame = frame(syncFromScroll);
  }

  function handleWheel(event) {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 4) return;
    event.preventDefault();
    viewport.scrollLeft += event.deltaX;
    handleScroll();
    scheduleAuto();
  }

  function handleKeydown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    goTo(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
  }

  function handlePointerDown(event) {
    if (event.pointerType === "touch") {
      stopAuto();
      return;
    }
    if (event.button !== 0 || event.isPrimary === false) return;
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = viewport.scrollLeft;
    lastX = startX;
    lastTime = event.timeStamp;
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture?.(pointerId);
    stopAuto();
  }

  function handlePointerMove(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    const distance = event.clientX - startX;
    const elapsed = Math.max(8, event.timeStamp - lastTime);
    const velocity = (event.clientX - lastX) / elapsed;
    if (Math.abs(distance) > 7) moved = true;
    viewport.scrollLeft = startScrollLeft - distance;

    if (gsap) {
      gsap.set(track, {
        x: clamp(distance * 0.045, -18, 18),
        skewX: clamp(velocity * 16, -2.4, 2.4),
        scaleX: 1 + Math.min(Math.abs(distance) / 7000, 0.018),
        transformOrigin: "50% 50%",
      });
    }

    lastX = event.clientX;
    lastTime = event.timeStamp;
  }

  function finishDrag(event) {
    if (!dragging) {
      if (event?.pointerType === "touch") scheduleAuto();
      return;
    }
    if (event?.pointerId != null && event.pointerId !== pointerId) return;
    dragging = false;
    suppressClick = moved;
    viewport.classList.remove("is-dragging");
    viewport.releasePointerCapture?.(pointerId);
    pointerId = null;
    goTo(getClosestCardIndex(viewport, cards));

    if (gsap) {
      gsap.to(track, {
        x: 0,
        skewX: 0,
        scaleX: 1,
        duration: reducedMotion ? 0 : 0.78,
        ease: "elastic.out(1, 0.46)",
        overwrite: true,
      });
    }
  }

  function preventDraggedClick(event) {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleResize() {
    if (resizeFrame) cancelFrame(resizeFrame);
    resizeFrame = frame(() => {
      resizeFrame = 0;
      goTo(activeIndex, { behavior: "auto", source: "resize" });
    });
  }

  function handleVisibility() {
    if (root.hidden) stopAuto();
    else scheduleAuto();
  }

  function handlePointerEnter() {
    hovering = true;
    stopAuto();
  }

  function handlePointerLeave() {
    hovering = false;
    scheduleAuto();
  }

  function handleFocusIn() {
    focusWithin = true;
    stopAuto();
  }

  function handleFocusOut() {
    frame(() => {
      focusWithin = archiveIndex.contains(root.activeElement);
      scheduleAuto();
    });
  }

  function showPrevious() {
    goTo(activeIndex - 1);
  }

  function showNext() {
    goTo(activeIndex + 1);
  }

  function toggleAutoPlay() {
    if (reducedMotion) return;
    manuallyPaused = !manuallyPaused;
    updateToggle();
    if (!manuallyPaused) toggle?.blur?.();
    scheduleAuto();
  }

  const observer = Observer
    ? new Observer((entries) => {
        inView = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.2);
        if (inView) scheduleAuto();
        else stopAuto();
      }, { threshold: [0, 0.2, 0.6] })
    : null;

  updateActive(0);
  updateToggle();
  observer?.observe(archiveIndex);

  viewport.addEventListener("scroll", handleScroll, { passive: true });
  viewport.addEventListener("wheel", handleWheel, { passive: false });
  viewport.addEventListener("keydown", handleKeydown);
  viewport.addEventListener("pointerdown", handlePointerDown);
  viewport.addEventListener("pointermove", handlePointerMove);
  viewport.addEventListener("pointerup", finishDrag);
  viewport.addEventListener("pointercancel", finishDrag);
  viewport.addEventListener("click", preventDraggedClick, true);
  archiveIndex.addEventListener("pointerenter", handlePointerEnter);
  archiveIndex.addEventListener("pointerleave", handlePointerLeave);
  archiveIndex.addEventListener("focusin", handleFocusIn);
  archiveIndex.addEventListener("focusout", handleFocusOut);
  previous?.addEventListener("click", showPrevious);
  next?.addEventListener("click", showNext);
  toggle?.addEventListener("click", toggleAutoPlay);
  view?.addEventListener?.("resize", handleResize, { passive: true });
  root.addEventListener?.("visibilitychange", handleVisibility);
  scheduleAuto();

  return {
    get index() { return activeIndex; },
    goTo,
    cleanup() {
      stopAuto();
      if (scrollFrame) cancelFrame(scrollFrame);
      if (resizeFrame) cancelFrame(resizeFrame);
      observer?.disconnect();
      viewport.removeEventListener("scroll", handleScroll);
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("keydown", handleKeydown);
      viewport.removeEventListener("pointerdown", handlePointerDown);
      viewport.removeEventListener("pointermove", handlePointerMove);
      viewport.removeEventListener("pointerup", finishDrag);
      viewport.removeEventListener("pointercancel", finishDrag);
      viewport.removeEventListener("click", preventDraggedClick, true);
      archiveIndex.removeEventListener("pointerenter", handlePointerEnter);
      archiveIndex.removeEventListener("pointerleave", handlePointerLeave);
      archiveIndex.removeEventListener("focusin", handleFocusIn);
      archiveIndex.removeEventListener("focusout", handleFocusOut);
      previous?.removeEventListener("click", showPrevious);
      next?.removeEventListener("click", showNext);
      toggle?.removeEventListener("click", toggleAutoPlay);
      view?.removeEventListener?.("resize", handleResize);
      root.removeEventListener?.("visibilitychange", handleVisibility);
      gsap?.killTweensOf?.(track);
      gsap?.set?.(track, { clearProps: "transform" });
    },
  };
}
