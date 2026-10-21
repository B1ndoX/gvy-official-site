export function initMemberBrawlDialog({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  ResizeObserverClass = view?.ResizeObserver,
} = {}) {
  const dialog = root?.querySelector?.("[data-member-brawl-dialog]");
  const frame = dialog?.querySelector?.("[data-member-brawl-frame]");
  const viewport = dialog?.querySelector?.("[data-member-brawl-viewport]");
  const closeButton = dialog?.querySelector?.("[data-member-brawl-close]");
  const minimizeButton = dialog?.querySelector?.("[data-member-brawl-minimize]");
  const endButton = dialog?.querySelector?.("[data-member-brawl-end]");
  const restorers = Array.from(dialog?.querySelectorAll?.("[data-member-brawl-restore]") || []);
  const openers = Array.from(root?.querySelectorAll?.("[data-member-brawl-open]") || []);
  if (!dialog || !frame || !viewport || !openers.length) return { cleanup() {} };

  const body = root.body;
  let state = "closed", restoreFocus = null, previousBodyOverflow = "", scrollLocked = false;
  let fitFrame = 0, expandedWidth = 960, expandedHeight = 600;
  const setState = (next) => {
    state = next;
    dialog.dataset.windowState = next;
    frame.inert = next === "docked";
    if (next === "docked") frame.setAttribute("aria-hidden", "true");
    else frame.removeAttribute("aria-hidden");
    for (const opener of openers) opener.setAttribute("aria-expanded", String(next !== "closed"));
  };
  const unlockScroll = () => {
    if (scrollLocked && body?.style) body.style.overflow = previousBodyOverflow;
    scrollLocked = false;
  };
  const applyFit = () => {
    fitFrame = 0;
    if (state === "docked") {
      // A thumbnail keeps the existing game viewport. Docking must not resize
      // bodies, rebuild terrain or restart a match merely to show a small view.
      const previewWidth = Math.max(1, viewport.clientWidth);
      const previewHeight = Math.min(210, previewWidth * 0.62);
      let crop = { x: 0, y: 0, width: expandedWidth, height: expandedHeight };
      try {
        const stage = frame.contentDocument?.querySelector(".arena-stage")?.getBoundingClientRect();
        if (stage?.width && stage?.height) crop = stage;
      } catch { /* A loading document uses its existing whole-frame bounds. */ }
      const scale = Math.max(previewWidth / crop.width, previewHeight / crop.height);
      const x = (previewWidth - crop.width * scale) / 2 - crop.x * scale;
      const y = (previewHeight - crop.height * scale) * 0.8 - crop.y * scale;
      dialog.style.setProperty("--member-brawl-preview-height", previewHeight + "px");
      frame.style.width = expandedWidth + "px";
      frame.style.height = expandedHeight + "px";
      frame.style.transform = "translate(" + x + "px," + y + "px) scale(" + scale + ")";
    } else {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.transform = "none";
      dialog.style.removeProperty("--member-brawl-preview-height");
      if (state === "expanded" && viewport.clientWidth && viewport.clientHeight) {
        expandedWidth = viewport.clientWidth;
        expandedHeight = viewport.clientHeight;
      }
    }
  };
  const requestFit = () => {
    if (fitFrame) view?.cancelAnimationFrame?.(fitFrame);
    fitFrame = view?.requestAnimationFrame?.(applyFit) || 0;
    if (!fitFrame) applyFit();
  };
  const minimize = () => {
    if (state !== "expanded") return;
    expandedWidth = viewport.clientWidth || expandedWidth;
    expandedHeight = viewport.clientHeight || expandedHeight;
    setState("docked");
    dialog.close();
    dialog.show();
    unlockScroll();
    applyFit();
    restoreFocus?.focus?.({ preventScroll: true });
  };
  const close = () => {
    setState("closed");
    if (dialog.open) dialog.close();
    unlockScroll();
    // Unloading the document runs the arena's pagehide cleanup and saves its
    // final local checkpoint. A later open starts a fresh lazy document.
    frame.removeAttribute("src");
    applyFit();
    restoreFocus?.focus?.({ preventScroll: true });
    restoreFocus = null;
  };
  const open = (event) => {
    if (state === "expanded") return;
    if (state === "closed") restoreFocus = event?.currentTarget || root.activeElement || null;
    if (!frame.getAttribute("src")) frame.setAttribute("src", "./member-brawl.html");
    if (dialog.open) dialog.close();
    previousBodyOverflow = body?.style?.overflow || "";
    if (body?.style) body.style.overflow = "hidden";
    scrollLocked = true;
    setState("expanded");
    dialog.showModal();
    applyFit(); requestFit();
    minimizeButton?.focus?.({ preventScroll: true });
  };
  const onBackdropClick = (event) => { if (event.target === dialog && state === "expanded") minimize(); };
  const onCancel = (event) => { event.preventDefault(); minimize(); };
  const onNativeClose = () => {
    // External native close also means "put away", unless the user ended the
    // lower-right window. Internal close/show transitions remain open here.
    if (!dialog.open && state === "expanded") minimize();
  };
  const observer = ResizeObserverClass ? new ResizeObserverClass(requestFit) : null;
  observer?.observe(viewport);
  for (const button of openers) button.addEventListener("click", open);
  for (const button of restorers) button.addEventListener("click", open);
  closeButton?.addEventListener("click", minimize);
  minimizeButton?.addEventListener("click", minimize);
  endButton?.addEventListener("click", close);
  frame.addEventListener("load", requestFit);
  dialog.addEventListener("click", onBackdropClick);
  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("close", onNativeClose);
  view?.addEventListener?.("resize", requestFit, { passive: true });
  setState("closed");

  return {
    open, close, minimize, requestFit,
    cleanup() {
      if (fitFrame) view?.cancelAnimationFrame?.(fitFrame);
      observer?.disconnect();
      for (const button of openers) button.removeEventListener("click", open);
      for (const button of restorers) button.removeEventListener("click", open);
      closeButton?.removeEventListener("click", minimize);
      minimizeButton?.removeEventListener("click", minimize);
      endButton?.removeEventListener("click", close);
      frame.removeEventListener("load", requestFit);
      dialog.removeEventListener("click", onBackdropClick);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onNativeClose);
      view?.removeEventListener?.("resize", requestFit);
      close();
    },
  };
}
