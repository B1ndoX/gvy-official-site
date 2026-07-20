export function initMemberBrawlDialog({ root = globalThis.document } = {}) {
  const dialog = root?.querySelector?.("[data-member-brawl-dialog]");
  const frame = dialog?.querySelector?.("[data-member-brawl-frame]");
  const closeButton = dialog?.querySelector?.("[data-member-brawl-close]");
  const openers = Array.from(root?.querySelectorAll?.("[data-member-brawl-open]") || []);

  if (!dialog || !frame || openers.length === 0) return { cleanup() {} };

  const body = root.body;
  let restoreFocus = null;
  let previousBodyOverflow = "";

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
    if (!frame.getAttribute("src")) frame.setAttribute("src", "./member-brawl.html");
    if (body?.style) body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    closeButton?.focus?.({ preventScroll: true });
  };

  const onBackdropClick = (event) => {
    if (event.target === dialog) close();
  };

  const onCancel = (event) => {
    event.preventDefault();
    close();
  };

  openers.forEach((button) => button.addEventListener("click", open));
  closeButton?.addEventListener("click", close);
  dialog.addEventListener("click", onBackdropClick);
  dialog.addEventListener("cancel", onCancel);

  return {
    open,
    close,
    cleanup() {
      openers.forEach((button) => button.removeEventListener("click", open));
      closeButton?.removeEventListener("click", close);
      dialog.removeEventListener("click", onBackdropClick);
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) close();
    },
  };
}
