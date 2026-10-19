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

export function getCarouselTargetDelta(position, target, loopWidth) {
  if (!(loopWidth > 0)) return target - position;
  return normalizeLoopPosition(target - position + loopWidth / 2, loopWidth) - loopWidth / 2;
}

export function getCarouselSnapIndex({ position, velocity = 0, step, length }) {
  if (!(step > 0) || !(length > 0)) return 0;
  // A short projection gives a flick intent without allowing unbounded coasting.
  const projected = position + Math.max(-2, Math.min(2, velocity)) * 140;
  return wrapCarouselIndex(Math.round(projected / step), length);
}

export function isCarouselDrag(startX, currentX, threshold = 8, startY = 0, currentY = startY) {
  const deltaX = Number(currentX) - Number(startX);
  const deltaY = Number(currentY) - Number(startY);
  const distance = Math.hypot(deltaX, deltaY);
  const minimum = Math.max(0, Number(threshold) || 0);
  return Number.isFinite(distance) && distance >= minimum;
}

export function getCarouselTouchIntent(startX, startY, currentX, currentY, threshold = 8) {
  const deltaX = Math.abs(Number(currentX) - Number(startX));
  const deltaY = Math.abs(Number(currentY) - Number(startY));
  const minimum = Math.max(0, Number(threshold) || 0);
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || Math.max(deltaX, deltaY) < minimum) {
    return "pending";
  }
  return deltaX > deltaY ? "horizontal" : "vertical";
}

export function shouldAllowCarouselClick({ dragged = false, startedAt = 0, endedAt = 0, holdThreshold = 240 } = {}) {
  const duration = Math.max(0, Number(endedAt) - Number(startedAt));
  return !dragged && duration < Math.max(0, Number(holdThreshold) || 0);
}

export function shouldActivateCarouselNavigationPress({
  startedOnNode = false,
  dragged = false,
  cancelled = false,
} = {}) {
  return Boolean(startedOnNode) && !dragged && !cancelled;
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

export function shouldRunCarouselFrame({ inView, hidden }) {
  return Boolean(inView) && !hidden;
}

export function initArchiveCarousel({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  pixelsPerSecond = 56,
  Observer = view?.IntersectionObserver,
} = {}) {
  const archiveIndex = root?.querySelector?.("[data-archive-index]");
  const viewport = archiveIndex?.querySelector?.(".archive-grid-viewport");
  const track = archiveIndex?.querySelector?.("[data-archive-grid]");
  const cards = Array.from(track?.querySelectorAll?.(":scope > [data-archive-open]") || []);
  const controls = archiveIndex?.querySelector?.(".archive-gallery-controls");
  const pagination = archiveIndex?.querySelector?.("[data-archive-carousel-pagination]");
  const toggle = archiveIndex?.querySelector?.("[data-archive-carousel-toggle]");
  const positionLabel = archiveIndex?.querySelector?.("[data-archive-carousel-position]");

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
    const clone = root.createElement("div");
    clone.className = "archive-loop-clone";
    card.childNodes.forEach((child) => clone.append(child.cloneNode(true)));
    clone.setAttribute("data-archive-clone", String(index));
    clone.setAttribute("aria-hidden", "true");
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
  let resizeWidth = Number(view?.innerWidth || 0);
  let pageScrolling = false;
  let pageScrollTimer = 0;
  let navigationTransition = null;
  let navigationClickResetTimer = 0;
  let navigationButtons = [];
  let navigationTargets = [];
  let activeNavigationIndex = -1;
  let paginationPointerId = null;
  let paginationPointerType = "";
  let paginationTouchActive = false;
  let paginationStartX = 0;
  let paginationStartY = 0;
  let paginationStartScrollLeft = 0;
  let paginationDragging = false;
  let paginationHovered = false;
  let paginationPressedButton = null;
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
  let touchStartScrollLeft = 0;
  let touchIntent = "pending";
  let touchStartedAt = 0;
  let touchDragging = false;
  let touchResumeTimer = 0;
  let gestureLastX = 0;
  let gestureLastTimestamp = 0;
  let gestureVelocity = 0;

  const DRAG_THRESHOLD_PX = 8;
  const HOLD_SUPPRESSION_MS = 240;
  const POINTER_CLICK_WINDOW_MS = 700;
  const TOUCH_RESUME_DELAY_MS = 160;
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

  function updatePagination({ reveal = false } = {}) {
    const nextIndex = navigationTransition?.index ?? getCarouselNavigationIndex(
      virtualPosition,
      loopWidth,
      navigationButtons.length,
    );
    if (nextIndex === activeNavigationIndex && !reveal) return;
    const isInitialUpdate = activeNavigationIndex < 0;
    activeNavigationIndex = nextIndex;
    navigationButtons.forEach((button, index) => {
      const isActive = index === nextIndex;
      button.classList.toggle("is-active", isActive);
      button.tabIndex = isActive ? 0 : -1;
      if (isActive) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    if (positionLabel) positionLabel.textContent = `${String(nextIndex + 1).padStart(2, "0")} / ${cards.length}`;
    const activeButton = navigationButtons[nextIndex];
    if (!activeButton || paginationPointerId != null || paginationTouchActive) return;
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
      ensureAnimationRunning();
      lastTimestamp = null;
    }, 160);
    if (visibilityFrame) return;
    visibilityFrame = frame(() => {
      visibilityFrame = 0;
      updateInViewFromGeometry();
      ensureAnimationRunning();
      lastTimestamp = null;
    });
  }

  function canMove() {
    return shouldAdvanceCarousel({
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
    if (!shouldRunCarouselFrame({ inView, hidden: root.hidden })) {
      animationFrame = 0;
      lastTimestamp = null;
      return;
    }
    animationFrame = frame(tick);
    if (navigationTransition) {
      const transition = navigationTransition;
      const progress = Math.min(1, Math.max(0, (timestamp - transition.startedAt) / transition.duration));
      const eased = transition.interrupted
        ? 1 - (1 - progress) ** 3
        : (progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2);
      setPosition(transition.from + transition.delta * eased);
      if (progress === 1) {
        navigationTransition = null;
        setPosition(transition.target);
      }
      lastTimestamp = timestamp;
      return;
    }
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

  function ensureAnimationRunning() {
    if (animationFrame || !shouldRunCarouselFrame({ inView, hidden: root.hidden })) return;
    lastTimestamp = null;
    animationFrame = frame(tick);
  }

  function pauseForManualInput() {
    manuallyPaused = true;
    updateToggle();
    lastTimestamp = null;
  }

  function animateToPhoto(index, { settle = false } = {}) {
    const targetIndex = resolveCarouselTargetIndex(index, cards.length);
    const target = getCarouselCardPosition(cards, targetIndex);
    const interrupted = Boolean(navigationTransition);
    clearNavigationTransition();
    pauseForManualInput();
    const delta = getCarouselTargetDelta(virtualPosition, target, loopWidth);
    if (view?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || Math.abs(delta) < 0.5) {
      setPosition(target);
      updatePagination({ reveal: true });
      return;
    }
    navigationTransition = { index: targetIndex, from: virtualPosition, target, delta,
      startedAt: now(), duration: settle ? 320 : (interrupted ? 280 : 480), interrupted };
    updatePagination({ reveal: true });
    ensureAnimationRunning();
  }

  function startGestureSample(x) {
    gestureLastX = x;
    gestureLastTimestamp = now();
    gestureVelocity = 0;
  }

  function recordGestureSample(x) {
    const timestamp = now();
    const elapsed = timestamp - gestureLastTimestamp;
    if (elapsed > 0) gestureVelocity = (gestureLastX - x) / elapsed;
    gestureLastX = x;
    gestureLastTimestamp = timestamp;
  }

  function settlePhotoDrag() {
    const step = cards[1]?.offsetLeft - cards[0]?.offsetLeft || cards[0].offsetWidth;
    animateToPhoto(getCarouselSnapIndex({ position: virtualPosition,
      velocity: now() - gestureLastTimestamp < 80 ? gestureVelocity : 0,
      step, length: cards.length }), { settle: true });
  }

  function handleKeydown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    animateToPhoto(activeNavigationIndex + (event.key === "ArrowRight" ? 1 : -1));
  }

  function clearPointerClickPermission() {
    allowPointerClickUntil = 0;
  }

  function allowNextPointerClick() {
    allowPointerClickUntil = now() + POINTER_CLICK_WINDOW_MS;
  }

  function handleTouchStart(event) {
    clearNavigationTransition();
    clearPointerClickPermission();
    cancelTouchResume();
    touchActive = true;
    touchDragging = false;
    touchIntent = "pending";
    touchStartX = event.touches?.[0]?.clientX ?? null;
    touchStartY = event.touches?.[0]?.clientY ?? null;
    touchStartScrollLeft = virtualPosition;
    touchStartedAt = now();
    startGestureSample(touchStartX);
    lastTimestamp = null;
  }

  function handleTouchMove(event) {
    if (touchStartX == null || touchStartY == null) return;
    if (event.touches?.length !== 1) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    if (touchIntent === "pending") {
      touchIntent = getCarouselTouchIntent(
        touchStartX,
        touchStartY,
        touch.clientX,
        touch.clientY,
        DRAG_THRESHOLD_PX,
      );
    }
    if (touchIntent !== "horizontal") return;
    if (!touchDragging) pauseForManualInput();
    touchDragging = true;
    viewport.classList.add("is-dragging");
    if (event.cancelable) event.preventDefault();
    setPosition(touchStartScrollLeft - (touch.clientX - touchStartX));
    recordGestureSample(touch.clientX);
  }

  function cancelTouchResume() {
    if (touchResumeTimer) cancelSchedule(touchResumeTimer);
    touchResumeTimer = 0;
  }

  function finishTouchPause() {
    touchResumeTimer = 0;
    touchActive = false;
    lastTimestamp = null;
  }

  function scheduleTouchResume() {
    if (touchResumeTimer) cancelSchedule(touchResumeTimer);
    touchResumeTimer = schedule(finishTouchPause, TOUCH_RESUME_DELAY_MS);
  }

  function finishTouch(event, { cancelled = false } = {}) {
    const shouldSettle = touchDragging && !cancelled;
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
    touchDragging = false;
    touchIntent = "pending";
    touchStartX = null;
    touchStartY = null;
    touchStartScrollLeft = 0;
    touchStartedAt = 0;
    touchActive = true;
    viewport.classList.remove("is-dragging");
    if (shouldSettle) settlePhotoDrag();
    scheduleTouchResume();
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
    if (endedAsDrag && !cancelled) settlePhotoDrag();
    lastTimestamp = null;
  }

  function handlePointerDown(event) {
    if (event.pointerType !== "mouse" || event.button !== 0 || dragPointerId != null) return;
    clearPointerClickPermission();
    clearNavigationTransition();
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartScrollLeft = virtualPosition;
    dragStartedAt = now();
    startGestureSample(event.clientX);
    dragging = false;
    touchActive = true;
    lastTimestamp = null;
  }

  function handlePointerMove(event) {
    if (event.pointerId !== dragPointerId) return;
    if (event.buttons === 0) { finishPointerDrag(event, { cancelled: true }); return; }
    const deltaX = event.clientX - dragStartX;
    if (!dragging && isCarouselDrag(dragStartX, event.clientX, DRAG_THRESHOLD_PX, dragStartY, event.clientY)) {
      dragging = true;
      pauseForManualInput();
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture?.(event.pointerId);
    }
    if (!dragging) return;
    event.preventDefault();
    setPosition(dragStartScrollLeft - deltaX);
    recordGestureSample(event.clientX);
  }

  function handlePointerUp(event) {
    finishPointerDrag(event);
    finishPaginationPointer(event);
  }

  function handlePointerCancel(event) {
    finishPointerDrag(event, { cancelled: true });
    finishPaginationPointer(event, { cancelled: true });
  }

  function handleViewportLostCapture(event) {
    if (event.pointerId === dragPointerId) finishPointerDrag(event, { cancelled: true });
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

  function refreshMeasurements() {
    if (resizeFrame) cancelFrame(resizeFrame);
    resizeFrame = frame(() => {
      resizeFrame = 0;
      const selectedIndex = navigationTransition?.index ?? (manuallyPaused ? activeNavigationIndex : null);
      navigationTransition = null;
      measureLoop();
      rebuildPagination();
      if (selectedIndex != null) animateToPhoto(selectedIndex, { settle: true });
      updateInViewFromGeometry();
      ensureAnimationRunning();
      lastTimestamp = null;
    });
  }
  const handleResize = () => {
    const nextWidth = Number(view?.innerWidth || 0);
    if (nextWidth <= 760 && Math.abs(nextWidth - resizeWidth) < 1) return;
    resizeWidth = nextWidth;
    refreshMeasurements();
  };

  function handleVisibility() {
    recoverTransientPause();
  }

  function recoverTransientPause() {
    clearPointerClickPermission();
    cancelTouchResume();
    touchActive = false;
    touchDragging = false;
    touchIntent = "pending";
    touchStartX = null;
    touchStartY = null;
    touchStartScrollLeft = 0;
    const pointerId = dragPointerId;
    dragging = false;
    dragPointerId = null;
    dragStartedAt = 0;
    touchStartedAt = 0;
    viewport.classList.remove("is-dragging");
    if (pointerId != null && viewport.hasPointerCapture?.(pointerId)) viewport.releasePointerCapture(pointerId);
    resetPaginationPointer();
    paginationTouchActive = false;
    paginationHovered = false;
    updateInViewFromGeometry();
    ensureAnimationRunning();
    lastTimestamp = null;
  }

  function toggleAutoPlay(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    manuallyPaused = !manuallyPaused;
    updateToggle();
    if (!manuallyPaused) {
      updatePagination({ reveal: true });
      toggle?.blur?.();
    }
    lastTimestamp = null;
  }

  function clearNavigationTransition() {
    const interrupted = Boolean(navigationTransition);
    navigationTransition = null;
    if (interrupted) updatePagination();
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
    if (event.button !== 0 || paginationPointerId != null) return;
    cancelTouchResume();
    const button = event.target?.closest?.("[data-archive-carousel-node]");
    paginationPointerId = event.pointerId;
    paginationPointerType = event.pointerType;
    clearNavigationTransition();
    paginationStartX = event.clientX;
    paginationStartY = event.clientY;
    paginationStartScrollLeft = pagination.scrollLeft;
    paginationDragging = false;
    paginationPressedButton = button && pagination.contains(button) ? button : null;
    suppressNavigationClick = false;
    touchActive = true;
    // Stop an earlier programmatic reveal before taking over the rail. Mouse
    // capture begins at press time so an outside release cannot leave a gesture.
    pagination.scrollTo?.({ left: pagination.scrollLeft, behavior: "instant" });
    if (event.pointerType !== "touch") pagination.setPointerCapture?.(event.pointerId);
    lastTimestamp = null;
  }

  function handlePaginationPointerMove(event) {
    if (event.pointerId !== paginationPointerId) return;
    if (paginationPointerType !== "touch" && event.buttons === 0) {
      finishPaginationPointer(event, { cancelled: true });
      return;
    }
    if (!paginationDragging && paginationPointerType !== "touch"
      && getCarouselTouchIntent(paginationStartX, paginationStartY, event.clientX, event.clientY,
        DRAG_THRESHOLD_PX) === "vertical") {
      finishPaginationPointer(event, { cancelled: true });
      return;
    }
    if (!paginationDragging && isCarouselDrag(
      paginationStartX,
      event.clientX,
      DRAG_THRESHOLD_PX,
      paginationStartY,
      event.clientY,
    )) {
      paginationDragging = true;
      if (paginationPointerType !== "touch") pagination.classList.add("is-dragging");
    }
    if (!paginationDragging) return;
    if (paginationPointerType === "touch") return; // Native pan-x owns touch movement.
    pauseForManualInput();
    event.preventDefault();
    pagination.scrollLeft = paginationStartScrollLeft - (event.clientX - paginationStartX);
  }

  function blockNextNavigationClick() {
    suppressNavigationClick = true;
    if (navigationClickResetTimer) cancelSchedule(navigationClickResetTimer);
    navigationClickResetTimer = schedule(() => {
      navigationClickResetTimer = 0;
      suppressNavigationClick = false;
    }, 0);
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
    const pressedButton = paginationPressedButton;
    const bounds = pressedButton?.getBoundingClientRect();
    const releasedInside = bounds && event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    const shouldActivate = shouldActivateCarouselNavigationPress({
      startedOnNode: paginationPointerType !== "touch" && Boolean(pressedButton) && releasedInside,
      dragged: endedAsDrag,
      cancelled,
    });
    if (endedAsDrag || cancelled || shouldActivate) blockNextNavigationClick();
    resetPaginationPointer();
    touchActive = paginationTouchActive || dragPointerId != null || touchStartX != null;
    lastTimestamp = null;
    if (shouldActivate) navigateToNavigationButton(pressedButton, event);
  }

  function resetPaginationPointer() {
    const pointerId = paginationPointerId;
    paginationPointerId = null;
    paginationPointerType = "";
    paginationDragging = false;
    paginationPressedButton = null;
    pagination?.classList.remove("is-dragging");
    if (pointerId != null && pagination?.hasPointerCapture?.(pointerId)) pagination.releasePointerCapture(pointerId);
  }

  function handlePaginationPointerUp(event) {
    finishPaginationPointer(event);
  }

  function handlePaginationPointerCancel(event) {
    finishPaginationPointer(event, { cancelled: true });
  }

  function handlePaginationLostCapture(event) {
    if (event.pointerId === paginationPointerId) finishPaginationPointer(event, { cancelled: true });
  }

  function handlePaginationTouchStart(event) {
    cancelTouchResume();
    paginationTouchActive = true;
    touchActive = true;
    paginationStartX = event.touches?.[0]?.clientX ?? 0;
    paginationStartY = event.touches?.[0]?.clientY ?? 0;
    lastTimestamp = null;
  }

  function handlePaginationTouchMove(event) {
    const touch = event.touches?.[0];
    if (!paginationTouchActive || !touch) return;
    if (getCarouselTouchIntent(paginationStartX, paginationStartY, touch.clientX, touch.clientY,
      DRAG_THRESHOLD_PX) === "horizontal") pauseForManualInput();
  }

  function handlePaginationTouchEnd() {
    paginationTouchActive = false;
    resetPaginationPointer();
    scheduleTouchResume();
  }

  function handlePaginationScroll() {
    if (paginationTouchActive || paginationPointerId != null) pauseForManualInput();
  }

  function handlePaginationKeydown(event) {
    let index;
    if (event.key === "ArrowRight") index = activeNavigationIndex + 1;
    else if (event.key === "ArrowLeft") index = activeNavigationIndex - 1;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = cards.length - 1;
    else return;
    event.preventDefault();
    animateToPhoto(index);
    navigationButtons[activeNavigationIndex]?.focus({ preventScroll: true });
  }

  function navigateToNavigationButton(button, event) {
    if (!button || !pagination?.contains?.(button)) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const nodeIndex = Number.parseInt(button.dataset.archiveCarouselNode, 10);
    const targetIndex = navigationTargets[nodeIndex];
    if (!Number.isInteger(targetIndex)) return;
    recoverTransientPause();
    animateToPhoto(targetIndex);
  }

  function jumpToNavigationTarget(event) {
    if (suppressNavigationClick) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }
    const button = event?.target?.closest?.("[data-archive-carousel-node]");
    navigateToNavigationButton(button, event);
  }

  const observer = Observer
    ? new Observer((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        lastTimestamp = null;
        ensureAnimationRunning();
      }, { threshold: [0, 0.01] })
    : null;

  measureLoop();
  rebuildPagination();
  updateInViewFromGeometry();
  updateToggle();
  observer?.observe(viewport);
  ensureAnimationRunning();

  viewport.addEventListener("keydown", handleKeydown);
  viewport.addEventListener("pointerdown", handlePointerDown);
  viewport.addEventListener("pointermove", handlePointerMove, { passive: false });
  viewport.addEventListener("pointerup", handlePointerUp);
  viewport.addEventListener("pointercancel", handlePointerCancel);
  viewport.addEventListener("lostpointercapture", handleViewportLostCapture);
  viewport.addEventListener("click", handleViewportClick, true);
  viewport.addEventListener("dragstart", preventNativeDrag);
  viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
  viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
  viewport.addEventListener("touchend", handleTouchEnd, { passive: true });
  viewport.addEventListener("touchcancel", handleTouchCancel, { passive: true });
  toggle?.addEventListener("click", toggleAutoPlay);
  pagination?.addEventListener("mouseenter", handlePaginationMouseEnter);
  pagination?.addEventListener("mouseleave", handlePaginationMouseLeave);
  pagination?.addEventListener("pointerdown", handlePaginationPointerDown);
  pagination?.addEventListener("pointermove", handlePaginationPointerMove, { passive: false });
  pagination?.addEventListener("pointerup", handlePaginationPointerUp);
  pagination?.addEventListener("pointercancel", handlePaginationPointerCancel);
  pagination?.addEventListener("lostpointercapture", handlePaginationLostCapture);
  pagination?.addEventListener("touchstart", handlePaginationTouchStart, { passive: true });
  pagination?.addEventListener("touchmove", handlePaginationTouchMove, { passive: true });
  pagination?.addEventListener("touchend", handlePaginationTouchEnd, { passive: true });
  pagination?.addEventListener("touchcancel", handlePaginationTouchEnd, { passive: true });
  pagination?.addEventListener("scroll", handlePaginationScroll, { passive: true });
  pagination?.addEventListener("keydown", handlePaginationKeydown);
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
      if (touchResumeTimer) cancelSchedule(touchResumeTimer);
      if (navigationClickResetTimer) cancelSchedule(navigationClickResetTimer);
      navigationTransition = null;
      observer?.disconnect();
      viewport.removeEventListener("keydown", handleKeydown);
      viewport.removeEventListener("pointerdown", handlePointerDown);
      viewport.removeEventListener("pointermove", handlePointerMove);
      viewport.removeEventListener("pointerup", handlePointerUp);
      viewport.removeEventListener("pointercancel", handlePointerCancel);
      viewport.removeEventListener("lostpointercapture", handleViewportLostCapture);
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
      pagination?.removeEventListener("lostpointercapture", handlePaginationLostCapture);
      pagination?.removeEventListener("touchstart", handlePaginationTouchStart);
      pagination?.removeEventListener("touchmove", handlePaginationTouchMove);
      pagination?.removeEventListener("touchend", handlePaginationTouchEnd);
      pagination?.removeEventListener("touchcancel", handlePaginationTouchEnd);
      pagination?.removeEventListener("scroll", handlePaginationScroll);
      pagination?.removeEventListener("keydown", handlePaginationKeydown);
      pagination?.removeEventListener("click", jumpToNavigationTarget);
      view?.removeEventListener?.("resize", handleResize);
      view?.removeEventListener?.("scroll", scheduleVisibilityCheck);
      view?.removeEventListener?.("pointerup", handlePointerUp);
      view?.removeEventListener?.("pointercancel", handlePointerCancel);
      view?.removeEventListener?.("blur", recoverTransientPause);
      view?.removeEventListener?.("focus", recoverTransientPause);
      root.removeEventListener?.("visibilitychange", handleVisibility);
      resetPaginationPointer();
      delete archiveIndex.dataset.carouselState;
      cloneHandlers.forEach(([clone, handler]) => {
        clone.removeEventListener("click", handler);
        clone.remove();
      });
    },
  };
}
