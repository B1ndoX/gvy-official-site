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

export function getCarouselNavigationTargetIndexes(length) {
  const itemCount = Math.max(0, Math.floor(Number(length) || 0));
  return Array.from({ length: itemCount }, (_, index) => index);
}

export function getCarouselNavigationIndex(position, loopWidth, navigationCount) {
  const nodeCount = Math.max(0, Math.floor(Number(navigationCount) || 0));
  if (nodeCount < 2 || !Number.isFinite(loopWidth) || loopWidth <= 0) return 0;
  const progress = normalizeLoopPosition(position, loopWidth) / loopWidth;
  return wrapCarouselIndex(Math.round(progress * nodeCount), nodeCount);
}

export function getCarouselNavigationRevealPosition({
  scrollLeft = 0,
  viewportWidth = 0,
  contentWidth = 0,
  nodeLeft = 0,
  nodeWidth = 0,
  padding = 12,
} = {}) {
  const viewport = Math.max(0, Number(viewportWidth) || 0);
  const maximum = Math.max(0, (Number(contentWidth) || 0) - viewport);
  const current = Math.min(maximum, Math.max(0, Number(scrollLeft) || 0));
  const inset = Math.min(viewport / 2, Math.max(0, Number(padding) || 0));
  const start = Math.max(0, Number(nodeLeft) || 0);
  const end = start + Math.max(0, Number(nodeWidth) || 0);
  let target = current;

  if (start < current + inset) target = start - inset;
  else if (end > current + viewport - inset) target = end - viewport + inset;

  return Math.min(maximum, Math.max(0, target));
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

export function shouldAllowCarouselClick({ dragged = false, startedAt = 0, endedAt = 0, holdThreshold = 240 } = {}) {
  const duration = Math.max(0, Number(endedAt) - Number(startedAt));
  return !dragged && duration < Math.max(0, Number(holdThreshold) || 0);
}

export function shouldAdvanceCarousel({
  loopWidth,
  manuallyPaused,
  touchActive,
  controlHovered = false,
  pageScrolling = false,
  inView,
  hidden,
}) {
  return loopWidth > 0
    && !manuallyPaused
    && !touchActive
    && !controlHovered
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
  const pagination = archiveIndex?.querySelector?.("[data-archive-carousel-pagination]");
  const toggle = archiveIndex?.querySelector?.("[data-archive-carousel-toggle]");

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
  let navigationTransitionTimer = 0;
  let navigationSettleTimer = 0;
  let navigationClickResetTimer = 0;
  let returningToTarget = false;
  let navigationButtons = [];
  let navigationTargets = [];
  let activeNavigationIndex = -1;
  let paginationPointerId = null;
  let paginationStartX = 0;
  let paginationStartY = 0;
  let paginationStartScrollLeft = 0;
  let paginationDragging = false;
  let paginationHovered = false;
  let suppressNavigationClick = false;
  let dragPointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartScrollLeft = 0;
  let dragStartedAt = 0;
  let dragging = false;
  let allowPointerClickUntil = 0;
  let touchStartX = null;
  let touchStartY = null;
  let touchStartedAt = 0;
  let touchDragging = false;

  const DRAG_THRESHOLD_PX = 8;
  const HOLD_SUPPRESSION_MS = 240;
  const POINTER_CLICK_WINDOW_MS = 700;
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
    updatePagination();
  }

  function updatePagination() {
    const nextIndex = getCarouselNavigationIndex(
      virtualPosition,
      loopWidth,
      navigationButtons.length,
    );
    if (nextIndex === activeNavigationIndex) return;
    const isInitialUpdate = activeNavigationIndex < 0;
    activeNavigationIndex = nextIndex;
    navigationButtons.forEach((button, index) => {
      const isActive = index === nextIndex;
      button.classList.toggle("is-active", isActive);
      if (isActive) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    const activeButton = navigationButtons[nextIndex];
    if (!activeButton || paginationDragging) return;
    const targetLeft = getCarouselNavigationRevealPosition({
      scrollLeft: pagination.scrollLeft,
      viewportWidth: pagination.clientWidth,
      contentWidth: pagination.scrollWidth,
      nodeLeft: activeButton.offsetLeft,
      nodeWidth: activeButton.offsetWidth,
    });
    if (Math.abs(targetLeft - pagination.scrollLeft) < 0.5) return;
    if (pagination.scrollTo) {
      pagination.scrollTo({ left: targetLeft, behavior: isInitialUpdate ? "auto" : "smooth" });
    } else {
      pagination.scrollLeft = targetLeft;
    }
  }

  function rebuildPagination() {
    if (!pagination || !root?.createElement) return;
    if (cards.length === navigationButtons.length) {
      updatePagination();
      return;
    }

    pagination.replaceChildren();
    navigationTargets = getCarouselNavigationTargetIndexes(cards.length);
    navigationButtons = navigationTargets.map((targetIndex) => {
      const button = root.createElement("button");
      const marker = root.createElement("span");
      button.type = "button";
      button.className = "archive-pagination-node";
      button.dataset.archiveCarouselNode = String(targetIndex);
      button.setAttribute("aria-label", `查看团建照片 ${targetIndex + 1}，共 ${cards.length} 张`);
      marker.className = "archive-pagination-node-mark";
      marker.setAttribute("aria-hidden", "true");
      button.append(marker);
      pagination.append(button);
      return button;
    });
    activeNavigationIndex = -1;
    updatePagination();
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
    return !returningToTarget && shouldAdvanceCarousel({
      loopWidth,
      manuallyPaused,
      touchActive,
      controlHovered: paginationHovered,
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

  function clearPointerClickPermission() {
    allowPointerClickUntil = 0;
  }

  function allowNextPointerClick() {
    allowPointerClickUntil = now() + POINTER_CLICK_WINDOW_MS;
  }

  function handleTouchStart(event) {
    clearPointerClickPermission();
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

  function finishTouch(event, { cancelled = false } = {}) {
    const touch = event?.changedTouches?.[0];
    const endedAsDrag = touchDragging || (touchStartX != null && touchStartY != null && touch
      ? isCarouselDrag(touchStartX, touch.clientX, DRAG_THRESHOLD_PX, touchStartY, touch.clientY)
      : false);
    if (!cancelled && shouldAllowCarouselClick({
      dragged: endedAsDrag,
      startedAt: touchStartedAt,
      endedAt: now(),
      holdThreshold: HOLD_SUPPRESSION_MS,
    })) allowNextPointerClick();
    else clearPointerClickPermission();
    touchActive = false;
    touchDragging = false;
    touchStartX = null;
    touchStartY = null;
    touchStartedAt = 0;
    setPosition(viewport.scrollLeft);
    lastTimestamp = null;
  }

  function handleTouchEnd(event) {
    finishTouch(event);
  }

  function handleTouchCancel(event) {
    finishTouch(event, { cancelled: true });
  }

  function finishPointerDrag(event, { cancelled = false } = {}) {
    if (event?.pointerId !== dragPointerId) return;
    const endedAsDrag = dragging || isCarouselDrag(
      dragStartX,
      event.clientX,
      DRAG_THRESHOLD_PX,
      dragStartY,
      event.clientY,
    );
    if (!cancelled && shouldAllowCarouselClick({
      dragged: endedAsDrag,
      startedAt: dragStartedAt,
      endedAt: now(),
      holdThreshold: HOLD_SUPPRESSION_MS,
    })) allowNextPointerClick();
    else clearPointerClickPermission();
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
    clearPointerClickPermission();
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
    if (event.detail === 0) return;
    const clickIsAllowed = now() <= allowPointerClickUntil;
    clearPointerClickPermission();
    if (clickIsAllowed) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function preventNativeDrag(event) {
    event.preventDefault();
  }

  function handleResize() {
    if (resizeFrame) cancelFrame(resizeFrame);
    resizeFrame = frame(() => {
      resizeFrame = 0;
      measureLoop();
      rebuildPagination();
      updateInViewFromGeometry();
      lastTimestamp = null;
    });
  }

  function handleVisibility() {
    clearPointerClickPermission();
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
    clearPointerClickPermission();
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

  function clearNavigationTransition() {
    if (navigationTransitionTimer) cancelSchedule(navigationTransitionTimer);
    if (navigationSettleTimer) cancelSchedule(navigationSettleTimer);
    navigationTransitionTimer = 0;
    navigationSettleTimer = 0;
    returningToTarget = false;
    viewport.classList.remove("is-returning-target");
  }

  function handlePaginationMouseEnter() {
    paginationHovered = true;
    lastTimestamp = null;
  }

  function handlePaginationMouseLeave() {
    paginationHovered = false;
    lastTimestamp = null;
  }

  function handlePaginationPointerDown(event) {
    if (event.pointerType !== "mouse" || event.button !== 0 || paginationPointerId != null) return;
    paginationPointerId = event.pointerId;
    paginationStartX = event.clientX;
    paginationStartY = event.clientY;
    paginationStartScrollLeft = pagination.scrollLeft;
    paginationDragging = false;
    suppressNavigationClick = false;
    touchActive = true;
    pagination.setPointerCapture?.(event.pointerId);
  }

  function handlePaginationPointerMove(event) {
    if (event.pointerId !== paginationPointerId) return;
    if (!paginationDragging && isCarouselDrag(
      paginationStartX,
      event.clientX,
      DRAG_THRESHOLD_PX,
      paginationStartY,
      event.clientY,
    )) {
      paginationDragging = true;
      pagination.classList.add("is-dragging");
    }
    if (!paginationDragging) return;
    event.preventDefault();
    pagination.scrollLeft = paginationStartScrollLeft - (event.clientX - paginationStartX);
  }

  function finishPaginationPointer(event, { cancelled = false } = {}) {
    if (event?.pointerId !== paginationPointerId) return;
    const endedAsDrag = paginationDragging || isCarouselDrag(
      paginationStartX,
      event.clientX,
      DRAG_THRESHOLD_PX,
      paginationStartY,
      event.clientY,
    );
    if (endedAsDrag || cancelled) {
      suppressNavigationClick = true;
      if (navigationClickResetTimer) cancelSchedule(navigationClickResetTimer);
      navigationClickResetTimer = schedule(() => {
        navigationClickResetTimer = 0;
        suppressNavigationClick = false;
      }, 0);
    }
    if (pagination.hasPointerCapture?.(event.pointerId)) pagination.releasePointerCapture?.(event.pointerId);
    paginationPointerId = null;
    paginationDragging = false;
    touchActive = false;
    pagination.classList.remove("is-dragging");
    lastTimestamp = null;
  }

  function handlePaginationPointerUp(event) {
    finishPaginationPointer(event);
  }

  function handlePaginationPointerCancel(event) {
    finishPaginationPointer(event, { cancelled: true });
  }

  function jumpToNavigationTarget(event) {
    if (suppressNavigationClick) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }
    const button = event?.target?.closest?.("[data-archive-carousel-node]");
    if (!button || !pagination?.contains?.(button)) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const nodeIndex = Number.parseInt(button.dataset.archiveCarouselNode, 10);
    const targetIndex = navigationTargets[nodeIndex];
    if (!Number.isInteger(targetIndex)) return;
    clearNavigationTransition();
    recoverTransientPause();
    returningToTarget = true;
    viewport.classList.add("is-returning-target");
    const targetPosition = getCarouselCardPosition(cards, targetIndex);
    const reducedMotion = view?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const move = () => {
      navigationTransitionTimer = 0;
      setPosition(targetPosition);
      lastTimestamp = null;
      navigationSettleTimer = schedule(() => {
        navigationSettleTimer = 0;
        returningToTarget = false;
        viewport.classList.remove("is-returning-target");
      }, reducedMotion ? 0 : 190);
    };

    if (reducedMotion) move();
    else navigationTransitionTimer = schedule(move, 150);
  }

  const observer = Observer
    ? new Observer((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        lastTimestamp = null;
      }, { threshold: [0, 0.01] })
    : null;

  measureLoop();
  rebuildPagination();
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
  viewport.addEventListener("touchcancel", handleTouchCancel, { passive: true });
  toggle?.addEventListener("click", toggleAutoPlay);
  pagination?.addEventListener("mouseenter", handlePaginationMouseEnter);
  pagination?.addEventListener("mouseleave", handlePaginationMouseLeave);
  pagination?.addEventListener("pointerdown", handlePaginationPointerDown);
  pagination?.addEventListener("pointermove", handlePaginationPointerMove, { passive: false });
  pagination?.addEventListener("pointerup", handlePaginationPointerUp);
  pagination?.addEventListener("pointercancel", handlePaginationPointerCancel);
  pagination?.addEventListener("click", jumpToNavigationTarget);
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
      if (navigationClickResetTimer) cancelSchedule(navigationClickResetTimer);
      clearNavigationTransition();
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
      viewport.removeEventListener("touchcancel", handleTouchCancel);
      toggle?.removeEventListener("click", toggleAutoPlay);
      pagination?.removeEventListener("mouseenter", handlePaginationMouseEnter);
      pagination?.removeEventListener("mouseleave", handlePaginationMouseLeave);
      pagination?.removeEventListener("pointerdown", handlePaginationPointerDown);
      pagination?.removeEventListener("pointermove", handlePaginationPointerMove);
      pagination?.removeEventListener("pointerup", handlePaginationPointerUp);
      pagination?.removeEventListener("pointercancel", handlePaginationPointerCancel);
      pagination?.removeEventListener("click", jumpToNavigationTarget);
      view?.removeEventListener?.("resize", handleResize);
      view?.removeEventListener?.("scroll", scheduleVisibilityCheck);
      view?.removeEventListener?.("pointerup", handlePointerUp);
      view?.removeEventListener?.("pointercancel", handlePointerCancel);
      view?.removeEventListener?.("blur", recoverTransientPause);
      view?.removeEventListener?.("focus", recoverTransientPause);
      root.removeEventListener?.("visibilitychange", handleVisibility);
      delete archiveIndex.dataset.carouselState;
      cloneHandlers.forEach(([clone, handler]) => {
        clone.removeEventListener("click", handler);
        clone.remove();
      });
    },
  };
}
