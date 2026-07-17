export function wrapArchiveIndex(index, length) {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError("Archive length must be a positive integer");
  }
  const numericIndex = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : 0;
  return ((numericIndex % length) + length) % length;
}

export function getSwipeDirection(startX, endX, threshold = 48) {
  const distance = Number(endX) - Number(startX);
  const minimum = Math.max(0, Number(threshold) || 0);
  if (Math.abs(distance) < minimum) return null;
  return distance < 0 ? "next" : "previous";
}

export function createArchiveSession(index = 0, restoreFocus = null) {
  return { index, restoreFocus };
}

function getArchiveItems(root) {
  return Array.from(root?.querySelectorAll?.("[data-archive-grid] [data-archive-open]") || []).map(
    (button, index) => {
      const image = button.querySelector?.("img");
      return {
        index,
        src: image?.getAttribute?.("src") || "",
        alt: image?.getAttribute?.("alt") || `GVY 远航档案 ${String(index + 1).padStart(2, "0")}`,
      };
    },
  );
}

export function initArchiveLightbox({ root = globalThis.document } = {}) {
  const dialog = root?.querySelector?.("[data-archive-dialog]");
  const dialogImage = dialog?.querySelector?.("[data-archive-dialog-image]");
  const dialogCount = dialog?.querySelector?.("[data-archive-dialog-count]");
  const dialogCaption = dialog?.querySelector?.("[data-archive-dialog-caption]");
  const previousButton = dialog?.querySelector?.("[data-archive-prev]");
  const nextButton = dialog?.querySelector?.("[data-archive-next]");
  const closeButton = dialog?.querySelector?.("[data-archive-close]");
  const items = getArchiveItems(root);

  if (!dialog || !dialogImage || items.length === 0) {
    return { cleanup() {} };
  }

  const session = createArchiveSession(0, null);
  const openers = Array.from(root.querySelectorAll?.("[data-archive-open]") || []);
  const body = root.body;
  const previousBodyOverflow = body?.style?.overflow || "";
  let touchStartX = null;

  dialogImage.removeAttribute?.("src");

  const render = (nextIndex) => {
    session.index = wrapArchiveIndex(nextIndex, items.length);
    const item = items[session.index];
    dialogImage.src = item.src;
    dialogImage.alt = item.alt;
    if (dialogCount) {
      dialogCount.textContent = `${String(session.index + 1).padStart(3, "0")} / ${String(items.length).padStart(3, "0")}`;
    }
    if (dialogCaption) dialogCaption.textContent = item.alt;
  };

  const close = () => {
    if (dialog.open) dialog.close();
    dialogImage.removeAttribute?.("src");
    if (body?.style) body.style.overflow = previousBodyOverflow;
    session.restoreFocus?.focus?.({ preventScroll: true });
    session.restoreFocus = null;
  };

  const open = (index, trigger) => {
    session.restoreFocus = trigger || root.activeElement || null;
    render(index);
    if (body?.style) body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    closeButton?.focus?.({ preventScroll: true });
  };

  const showPrevious = () => render(session.index - 1);
  const showNext = () => render(session.index + 1);

  const onOpen = (event) => {
    const trigger = event.currentTarget;
    open(Number(trigger.dataset.archiveOpen), trigger);
  };
  const onDialogClick = (event) => {
    if (event.target === dialog) close();
  };
  const onCancel = (event) => {
    event.preventDefault();
    close();
  };
  const onKeyDown = (event) => {
    if (!dialog.open) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };
  const onTouchStart = (event) => {
    touchStartX = event.changedTouches?.[0]?.clientX ?? null;
  };
  const onTouchEnd = (event) => {
    if (touchStartX == null) return;
    const endX = event.changedTouches?.[0]?.clientX;
    const direction = getSwipeDirection(touchStartX, endX, 48);
    touchStartX = null;
    if (direction === "previous") showPrevious();
    if (direction === "next") showNext();
  };

  openers.forEach((button) => button.addEventListener("click", onOpen));
  previousButton?.addEventListener("click", showPrevious);
  nextButton?.addEventListener("click", showNext);
  closeButton?.addEventListener("click", close);
  dialog.addEventListener("click", onDialogClick);
  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("touchstart", onTouchStart, { passive: true });
  dialog.addEventListener("touchend", onTouchEnd, { passive: true });
  root.addEventListener?.("keydown", onKeyDown);

  return {
    open,
    close,
    cleanup() {
      openers.forEach((button) => button.removeEventListener("click", onOpen));
      previousButton?.removeEventListener("click", showPrevious);
      nextButton?.removeEventListener("click", showNext);
      closeButton?.removeEventListener("click", close);
      dialog.removeEventListener("click", onDialogClick);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("touchstart", onTouchStart);
      dialog.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener?.("keydown", onKeyDown);
      if (dialog.open) close();
    },
  };
}
