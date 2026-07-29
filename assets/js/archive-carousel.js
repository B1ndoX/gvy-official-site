export function wrapCarouselIndex(index, length) {
  if (!Number.isInteger(length) || length < 1) throw new RangeError("Carousel length must be positive");
  return ((index % length) + length) % length;
}

export function normalizeLoopPosition(position, loopWidth) {
  if (!Number.isFinite(loopWidth) || loopWidth <= 0) return Math.max(0, Number(position) || 0);
  return ((Number(position) % loopWidth) + loopWidth) % loopWidth;
}

export function advanceCarouselPosition(position, pixelsPerSecond, elapsed, loopWidth) {
  const distance = (Math.max(0, Number(pixelsPerSecond) || 0) * Math.max(0, Number(elapsed) || 0)) / 1000;
  return normalizeLoopPosition((Number(position) || 0) + distance, loopWidth);
}

export function resolveCarouselTargetIndex(value, length) {
  if (!Number.isInteger(length) || length < 1) return 0;
  const index = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isInteger(index)) return 0;
  return wrapCarouselIndex(index, length);
}

export function getLatestBatchStartIndex(cards) {
  if (!cards?.length) return 0;
  const index = cards.findIndex((card) => card?.hasAttribute?.("data-archive-latest-start"));
  return index >= 0 ? index : 0;
}

export function getCarouselCardPosition(cards, index) {
  if (!cards?.length) return 0;
  const targetIndex = resolveCarouselTargetIndex(index, cards.length);
  const firstOffset = Number(cards[0]?.offsetLeft) || 0;
  const targetOffset = Number(cards[targetIndex]?.offsetLeft) || firstOffset;
  return Math.max(0, targetOffset - firstOffset);
}

export function isCarouselDrag(startX, currentX, threshold = 8, startY = 0, currentY = startY) {
  const deltaX = Number(currentX) - Number(startX);
  const deltaY = Number(currentY) - Number(startY);
  const distance = Math.hypot(deltaX, deltaY);
  const minimum = Math.max(0, Number(threshold) || 0);
  return Number.isFinite(distance) && distance >= minimum;
}

export function shouldSuppressCarouselClick({ dragged = false, startedAt = 0, endedAt = 0, holdThreshold = 240 } = {}) {
  const duration = Math.max(0, Number(endedAt) - Number(startedAt));
  return Boolean(dragged) || duration >= Math.max(0, Number(holdThreshold) || 0);
}

export function shouldAdvanceCarousel({
  loopWidth,
  manuallyPaused,
  touchActive,
  pageScrolling = false,
  inView,
  hidden,
}) {
  return loopWidth > 0
    && !manuallyPaused
    && !touchActive
    && !pageScrolling
    && inView
    && !hidden;
}

export function initArchiveCarousel({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  pixelsPerSecond = 48,
  Observer = view?.IntersectionObserver,
} = {}) {
  const archiveIndex = root?.querySelector?.("[data-archive-index]");
  const viewport = archiveIndex?.querySelector?.(".archive-grid-viewport");
  const track = archiveIndex?.querySelector?.("[data-archive-grid]");
  const cards = Array.from(track?.querySelectorAll?.(":scope > [data-archive-open]") || []);
  const controls = archiveIndex?.querySelector?.(".archive-gallery-controls");
  const toggle = archiveIndex?.querySelector?.("[data-archive-carousel-toggle]");
  const latest = archiveIndex?.querySelector?.("[data-archive-carousel-latest]");

  if (!archiveIndex || !viewport || !track || cards.length < 2) {
    return { cleanup() {} };
  }

  const frame = view?.requestAnimationFrame?.bind(view)
    || ((callback) => setTimeout(() => callback(Date.now()), 16));
  const cancelFrame = view?.cancelAnimationFrame?.bind(view) || clearTimeout;
  const schedule = view?.setTimeout?.bind(view) || setTimeout;
  const cancelSchedule = view?.clearTimeout?.bind(view) || clearTimeout;
  const cloneHandlers = [];
  const cloneCards = cards.map((card, index) => {
    const clone = card.cloneNode(true);
    clone.removeAttribute("data-archive-open");
    clone.setAttribute("data-archive-clone", String(index));
    clone.setAttribute("aria-hidden", "true");
    clone.tabIndex = -1;
    const openOriginal = (event) => {
      event.preventDefault();
      cards[index].click();
    };
    clone.addEventListener("click", openOriginal);
    cloneHandlers.push([clone, openOriginal]);
    track.append(clone);
    return clone;
  });

  let animationFrame = 0;
  let resizeFrame = 0;
  let visibilityFrame = 0;
  let lastTimestamp = null;
  let loopWidth = 0;
  let virtualPosition = 0;
  let inView = false;
  let manuallyPaused = false;
  let touchActive = false;
  let pageScrolling = false;
  let pageScrollTimer = 0;
  let latestTransitionTimer = 0;
  let latestSettleTimer = 0;
  let returningToLatest = false;
  let dragPointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartScrollLeft = 0;
  let dragStartedAt = 0;
  let dragging = false;
  let suppressClickUntil = 0;
  let suppressClickTimer = 0;
  let touchStartX = null;
  let touchStartY = null;
  let touchStartedAt = 0;
  let touchDragging = false;

  const DRAG_THRESHOLD_PX = 8;
  const HOLD_SUPPRESSION_MS = 240;
  const CLICK_SUPPRESSION_MS = 900;
  const latestIndex = getLatestBatchStartIndex(cards);
  const now = () => view?.performance?.now?.() ?? Date.now();

  function updateToggle() {
    controls?.classList.toggle("is-paused", manuallyPaused);
    archiveIndex.dataset.carouselState = manuallyPaused ? "paused" : "playing";
    if (!toggle) return;
    toggle.setAttribute("aria-pressed", String(manuallyPaused));
    toggle.setAttribute("aria-label", manuallyPaused ? "继续匀速滚动" : "暂停匀速滚动");
  }

  function setPosition(position) {
    virtualPosition = normalizeLoopPosition(position, loopWidth);
    viewport.scrollLeft = virtualPosition;
  }

  function measureLoop() {
    loopWidth = (cloneCards[0]?.offsetLeft || 0) - (cards[0]?.offsetLeft || 0);
    if (loopWidth <= 0) loopWidth = track.scrollWidth / 2;
    setPosition(viewport.scrollLeft);
  }

  function updateInViewFromGeometry() {
    const rect = viewport.getBoundingClientRect?.();
    const viewHeight = view?.innerHeight || root?.documentElement?.clientHeight || 0;
    if (!rect || viewHeight <= 0) return;
    inView = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewHeight;
  }

  function scheduleVisibilityCheck() {
    pageScrolling = true;
    if (pageScrollTimer) cancelSchedule(pageScrollTimer);
    pageScrollTimer = schedule(() => {
      pageScrollTimer = 0;
      pageScrolling = false;
      updateInViewFromGeometry();
      lastTimestamp = null;
    }, 160);
    if (visibilityFrame) return;
    visibilityFrame = frame(() => {
      visibilityFrame = 0;
      updateInViewFromGeometry();
      lastTimestamp = null;
    });
  }

  function canMove() {
    return !returningToLatest && shouldAdvanceCarousel({
      loopWidth,
      manuallyPaused,
      touchActive,
      pageScrolling,
      inView,
      hidden: root.hidden,
    });
  }

  function tick(timestamp) {
    animationFrame = frame(tick);
    if (!canMove()) {
      lastTimestamp = timestamp;
      return;
    }

    if (lastTimestamp == null) {
      lastTimestamp = timestamp;
      return;
    }

    const elapsed = Math.min(64, Math.max(0, timestamp - lastTimestamp));
    lastTimestamp = timestamp;
    setPosition(advanceCarouselPosition(
      virtualPosition,
      pixelsPerSecond,
      elapsed,
      loopWidth,
    ));
  }

  function nudge(direction) {
    const distance = cards[1]?.offsetLeft - cards[0]?.offsetLeft || cards[0].offsetWidth;
    setPosition(virtualPosition + direction * distance);
    lastTimestamp = null;
  }

  function handleKeydown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    nudge(event.key === "ArrowRight" ? 1 : -1);
  }

  function clearDragSuppression() {
    suppressClickUntil = 0;
    archiveIndex.dataset.dragSuppressClick = "false";
    if (suppressClickTimer) cancelSchedule(suppressClickTimer);
    suppressClickTimer = 0;
  }

  function armDragSuppression() {
    suppressClickUntil = now() + CLICK_SUPPRESSION_MS;
    archiveIndex.dataset.dragSuppressClick = "true";
    if (suppressClickTimer) cancelSchedule(suppressClickTimer);
    suppressClickTimer = schedule(clearDragSuppression, CLICK_SUPPRESSION_MS);
  }

  function handleTouchStart(event) {
    clearDragSuppression();
    touchActive = true;
    touchDragging = false;
    touchStartX = event.touches?.[0]?.clientX ?? null;
    touchStartY = event.touches?.[0]?.clientY ?? null;
    touchStartedAt = now();
  }

  function handleTouchMove(event) {
    if (touchStartX == null || touchStartY == null) return;
    const touch = event.touches?.[0];
    if (!touchDragging && touch && isCarouselDrag(touchStartX, touch.clientX, DRAG_THRESHOLD_PX, touchStartY, touch.clientY)) {
      touchDragging = true;
    }
  }

  function handleTouchEnd() {
    if (shouldSuppressCarouselClick({
      dragged: touchDragging,
      startedAt: touchStartedAt,
      endedAt: now(),
      holdThreshold: HOLD_SUPPRESSION_MS,
    })) armDragSuppression();
    touchActive = false;
    touchDragging = false;
    touchStartX = null;
    touchStartY = null;
    touchStartedAt = 0;
    setPosition(viewport.scrollLeft);
    lastTimestamp = null;
  }

  function finishPointerDrag(event, { cancelled = false } = {}) {
    if (event?.pointerId !== dragPointerId) return;
    if (cancelled) clearDragSuppression();
    else if (shouldSuppressCarouselClick({
      dragged: dragging,
      startedAt: dragStartedAt,
      endedAt: now(),
      holdThreshold: HOLD_SUPPRESSION_MS,
    })) armDragSuppression();
    dragging = false;
    dragPointerId = null;
    dragStartedAt = 0;
    touchActive = false;
    viewport.classList.remove("is-dragging");
    if (event?.pointerId != null && viewport.hasPointerCapture?.(event.pointerId)) {
      viewport.releasePointerCapture?.(event.pointerId);
    }
    setPosition(viewport.scrollLeft);
    lastTimestamp = null;
  }

  function handlePointerDown(event) {
    if (event.pointerType !== "mouse" || event.button !== 0 || dragPointerId != null) return;
    clearDragSuppression();
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartScrollLeft = virtualPosition;
    dragStartedAt = now();
    dragging = false;
    touchActive = true;
    lastTimestamp = null;
  }

  function handlePointerMove(event) {
    if (event.pointerId !== dragPointerId) return;
    const deltaX = event.clientX - dragStartX;
    if (!dragging && isCarouselDrag(dragStartX, event.clientX, DRAG_THRESHOLD_PX, dragStartY, event.clientY)) {
      dragging = true;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture?.(event.pointerId);
    }
    if (!dragging) return;
    event.preventDefault();
    setPosition(dragStartScrollLeft - deltaX);
  }

  function handlePointerUp(event) {
    finishPointerDrag(event);
  }

  function handlePointerCancel(event) {
    finishPointerDrag(event, { cancelled: true });
  }

  function handleViewportClick(event) {
    if (!dragging && now() > suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearDragSuppression();
  }

  function preventNativeDrag(event) {
    event.preventDefault();
  }

  function handleResize() {
    if (resizeFrame) cancelFrame(resizeFrame);
    resizeFrame = frame(() => {
      resizeFrame = 0;
      measureLoop();
      updateInViewFromGeometry();
      lastTimestamp = null;
    });
  }

  function handleVisibility() {
    if (!root.hidden) {
      touchActive = false;
      dragging = false;
      dragPointerId = null;
      dragStartedAt = 0;
      touchStartedAt = 0;
      viewport.classList.remove("is-dragging");
      updateInViewFromGeometry();
    }
    lastTimestamp = null;
  }

  function recoverTransientPause() {
    touchActive = false;
    dragging = false;
    dragPointerId = null;
    dragStartedAt = 0;
    touchStartedAt = 0;
    viewport.classList.remove("is-dragging");
    updateInViewFromGeometry();
    lastTimestamp = null;
  }

  function toggleAutoPlay(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    manuallyPaused = !manuallyPaused;
    updateToggle();
    if (!manuallyPaused) toggle?.blur?.();
    lastTimestamp = null;
  }

  function clearLatestTransition() {
    if (latestTransitionTimer) cancelSchedule(latestTransitionTimer);
    if (latestSettleTimer) cancelSchedule(latestSettleTimer);
    latestTransitionTimer = 0;
    latestSettleTimer = 0;
    returningToLatest = false;
    viewport.classList.remove("is-returning-latest");
  }

  function jumpToLatest(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    clearLatestTransition();
    recoverTransientPause();
    returningToLatest = true;
    viewport.classList.add("is-returning-latest");
    const targetPosition = getCarouselCardPosition(cards, latestIndex);
    const reducedMotion = view?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const move = () => {
      latestTransitionTimer = 0;
      setPosition(targetPosition);
      lastTimestamp = null;
      latestSettleTimer = schedule(() => {
        latestSettleTimer = 0;
        returningToLatest = false;
        viewport.classList.remove("is-returning-latest");
      }, reducedMotion ? 0 : 190);
    };

    if (reducedMotion) move();
    else latestTransitionTimer = schedule(move, 150);
  }

  const observer = Observer
    ? new Observer((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        lastTimestamp = null;
      }, { threshold: [0, 0.01] })
    : null;

  measureLoop();
  updateInViewFromGeometry();
  updateToggle();
  observer?.observe(viewport);
  animationFrame = frame(tick);

  viewport.addEventListener("keydown", handleKeydown);
  viewport.addEventListener("pointerdown", handlePointerDown);
  viewport.addEventListener("pointermove", handlePointerMove, { passive: false });
  viewport.addEventListener("pointerup", handlePointerUp);
  viewport.addEventListener("pointercancel", handlePointerCancel);
  viewport.addEventListener("lostpointercapture", recoverTransientPause);
  viewport.addEventListener("click", handleViewportClick, true);
  viewport.addEventListener("dragstart", preventNativeDrag);
  viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
  viewport.addEventListener("touchmove", handleTouchMove, { passive: true });
  viewport.addEventListener("touchend", handleTouchEnd, { passive: true });
  viewport.addEventListener("touchcancel", handleTouchEnd, { passive: true });
  toggle?.addEventListener("click", toggleAutoPlay);
  latest?.addEventListener("click", jumpToLatest);
  view?.addEventListener?.("resize", handleResize, { passive: true });
  view?.addEventListener?.("scroll", scheduleVisibilityCheck, { passive: true });
  view?.addEventListener?.("pointerup", handlePointerUp, { passive: true });
  view?.addEventListener?.("pointercancel", handlePointerCancel, { passive: true });
  view?.addEventListener?.("blur", recoverTransientPause);
  view?.addEventListener?.("focus", recoverTransientPause);
  root.addEventListener?.("visibilitychange", handleVisibility);

  return {
    get isPaused() { return manuallyPaused; },
    cleanup() {
      if (animationFrame) cancelFrame(animationFrame);
      if (resizeFrame) cancelFrame(resizeFrame);
      if (visibilityFrame) cancelFrame(visibilityFrame);
      if (pageScrollTimer) cancelSchedule(pageScrollTimer);
      if (suppressClickTimer) cancelSchedule(suppressClickTimer);
      clearLatestTransition();
      observer?.disconnect();
      viewport.removeEventListener("keydown", handleKeydown);
      viewport.removeEventListener("pointerdown", handlePointerDown);
      viewport.removeEventListener("pointermove", handlePointerMove);
      viewport.removeEventListener("pointerup", handlePointerUp);
      viewport.removeEventListener("pointercancel", handlePointerCancel);
      viewport.removeEventListener("lostpointercapture", recoverTransientPause);
      viewport.removeEventListener("click", handleViewportClick, true);
      viewport.removeEventListener("dragstart", preventNativeDrag);
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("touchcancel", handleTouchEnd);
      toggle?.removeEventListener("click", toggleAutoPlay);
      latest?.removeEventListener("click", jumpToLatest);
      view?.removeEventListener?.("resize", handleResize);
      view?.removeEventListener?.("scroll", scheduleVisibilityCheck);
      view?.removeEventListener?.("pointerup", handlePointerUp);
      view?.removeEventListener?.("pointercancel", handlePointerCancel);
      view?.removeEventListener?.("blur", recoverTransientPause);
      view?.removeEventListener?.("focus", recoverTransientPause);
      root.removeEventListener?.("visibilitychange", handleVisibility);
      delete archiveIndex.dataset.carouselState;
      delete archiveIndex.dataset.dragSuppressClick;
      cloneHandlers.forEach(([clone, handler]) => {
        clone.removeEventListener("click", handler);
        clone.remove();
      });
    },
  };
}
