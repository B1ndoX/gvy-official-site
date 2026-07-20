const BRAWL_DESIGN_WIDTH = 1440;
const BRAWL_DESIGN_HEIGHT = 900;
const BRAWL_FIT_PADDING = 0;

export function getBrawlFit(
  containerWidth,
  containerHeight,
  designWidth = BRAWL_DESIGN_WIDTH,
  designHeight = BRAWL_DESIGN_HEIGHT,
  padding = BRAWL_FIT_PADDING,
) {
  const availableWidth = Math.max(0, Number(containerWidth) - padding);
  const availableHeight = Math.max(0, Number(containerHeight) - padding);
  const safeDesignWidth = Math.max(1, Number(designWidth) || 1);
  const safeDesignHeight = Math.max(1, Number(designHeight) || 1);
  const scale = Math.min(1, availableWidth / safeDesignWidth, availableHeight / safeDesignHeight);

  return {
    scale: Math.max(0, scale),
    width: safeDesignWidth * Math.max(0, scale),
    height: safeDesignHeight * Math.max(0, scale),
  };
}

export function initMemberBrawlDialog({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  ResizeObserverClass = view?.ResizeObserver,
} = {}) {
  const dialog = root?.querySelector?.("[data-member-brawl-dialog]");
  const frame = dialog?.querySelector?.("[data-member-brawl-frame]");
  const closeButton = dialog?.querySelector?.("[data-member-brawl-close]");
  const openers = Array.from(root?.querySelectorAll?.("[data-member-brawl-open]") || []);

  if (!dialog || !frame || openers.length === 0) {
    return { cleanup() {} };
  }

  const body = root.body;
  let restoreFocus = null;
  let previousBodyOverflow = "";
  let fitFrame = 0;

  const applyFit = () => {
    fitFrame = 0;
    const fit = getBrawlFit(dialog.clientWidth, dialog.clientHeight);
    frame.style.width = `${BRAWL_DESIGN_WIDTH}px`;
    frame.style.height = `${BRAWL_DESIGN_HEIGHT}px`;
    frame.style.transform = `scale(${fit.scale})`;
    dialog.style.setProperty("--member-brawl-scale", String(fit.scale));
  };

  const requestFit = () => {
    if (fitFrame) view?.cancelAnimationFrame?.(fitFrame);
    fitFrame = view?.requestAnimationFrame?.(applyFit) || 0;
    if (!fitFrame) applyFit();
  };

  const close = () => {
    if (!dialog.open) return;
    dialog.close();
    if (body?.style) body.style.overflow = previousBodyOverflow;
    restoreFocus?.focus?.({ preventScroll: true });
    restoreFocus = null;
  };

  const open = (event) => {
    restoreFocus = event?.currentTarget || root.activeElement || null;
    previousBodyOverflow = body?.style?.overflow || "";
    if (!frame.getAttribute("src")) {
      frame.setAttribute("src", "./member-brawl.html?v=20260720-brawl-frame-v16");
    }
    if (body?.style) body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    requestFit();
    closeButton?.focus?.({ preventScroll: true });
  };

  const onBackdropClick = (event) => {
    if (event.target === dialog) close();
  };

  const onCancel = (event) => {
    event.preventDefault();
    close();
  };

  const resizeObserver = ResizeObserverClass ? new ResizeObserverClass(requestFit) : null;
  resizeObserver?.observe(dialog);
  openers.forEach((button) => button.addEventListener("click", open));
  closeButton?.addEventListener("click", close);
  frame.addEventListener("load", requestFit);
  dialog.addEventListener("click", onBackdropClick);
  dialog.addEventListener("cancel", onCancel);
  view?.addEventListener?.("resize", requestFit, { passive: true });

  return {
    open,
    close,
    requestFit,
    cleanup() {
      if (fitFrame) view?.cancelAnimationFrame?.(fitFrame);
      resizeObserver?.disconnect();
      openers.forEach((button) => button.removeEventListener("click", open));
      closeButton?.removeEventListener("click", close);
      frame.removeEventListener("load", requestFit);
      dialog.removeEventListener("click", onBackdropClick);
      dialog.removeEventListener("cancel", onCancel);
      view?.removeEventListener?.("resize", requestFit);
      if (dialog.open) close();
    },
  };
}
