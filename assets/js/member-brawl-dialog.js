export function initMemberBrawlDialog({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  ResizeObserverClass = view?.ResizeObserver,
  loadMembers = async () => { await import("./fleet-members.js"); return view.__gvyFleetRoster?.members; },
} = {}) {
  const dialog = root?.querySelector?.("[data-member-brawl-dialog]");
  const frame = dialog?.querySelector?.("[data-member-brawl-frame]");
  const viewport = dialog?.querySelector?.("[data-member-brawl-viewport]");
  const closeButton = dialog?.querySelector?.("[data-member-brawl-close]");
  const minimizeButton = dialog?.querySelector?.("[data-member-brawl-minimize]");
  const endButton = dialog?.querySelector?.("[data-member-brawl-end]");
  const restorers = Array.from(dialog?.querySelectorAll?.("[data-member-brawl-restore]") || []);
  const openers = Array.from(root?.querySelectorAll?.("[data-member-brawl-open]") || []);
  const hub = dialog?.querySelector?.("[data-game-hub]");
  const toolbar = dialog?.querySelector?.("[data-game-toolbar]");
  const backButton = dialog?.querySelector?.("[data-game-back]");
  const title = dialog?.querySelector?.("[data-game-title]");
  const dockTitle = dialog?.querySelector?.("[data-game-dock-title]");
  const status = dialog?.querySelector?.("[data-game-status]");
  const choices = Array.from(dialog?.querySelectorAll?.("[data-game-select]") || []);
  const previews = Array.from(dialog?.querySelectorAll?.("[data-game-preview]") || []);
  if (!dialog || !frame || !viewport || !openers.length) return { cleanup() {} };

  const body = root.body;
  let state = "closed", restoreFocus = null, previousBodyOverflow = "", scrollLocked = false;
  let fitFrame = 0, expandedWidth = 960, expandedHeight = 600;
  let activeGame = "", generation = 0, membersSent = false, shipMembers = null;
  const names = { members: "舰队成员大乱斗", ships: "星际飞船大乱斗" };
  const updateGame = (game) => {
    activeGame = game;
    dialog.dataset.activeGame = game;
    if (hub) hub.hidden = Boolean(game);
    if (toolbar) toolbar.hidden = !game;
    frame.hidden = !game;
    frame.title = names[game] || "舰队游戏";
    if (title) title.textContent = names[game] || "舰队大乱斗";
    if (dockTitle) dockTitle.textContent = names[game] || "舰队大乱斗 · 选择游戏";
    dialog.setAttribute("aria-label", names[game] || "舰队大乱斗 · 选择游戏");
  };
  const unloadGame = () => {
    generation++;
    membersSent = false;
    shipMembers = null;
    // One iframe owns one game. Navigation tears down its animation/WebGL
    // context; a hidden second simulation is never retained behind the hub.
    frame.removeAttribute("src");
    updateGame("");
  };
  const setState = (next) => {
    state = next;
    dialog.dataset.windowState = next;
    frame.inert = next === "docked";
    if (hub) hub.inert = next === "docked";
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
    if (state === "docked" && activeGame) {
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
      frame.style.height = "calc(100% - var(--game-window-toolbar-height))";
      frame.style.transform = "none";
      dialog.style.removeProperty("--member-brawl-preview-height");
      if (state === "expanded" && viewport.clientWidth && viewport.clientHeight) {
        expandedWidth = frame.clientWidth || viewport.clientWidth;
        expandedHeight = frame.clientHeight || viewport.clientHeight;
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
    expandedWidth = frame.clientWidth || viewport.clientWidth || expandedWidth;
    expandedHeight = frame.clientHeight || viewport.clientHeight || expandedHeight;
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
    unloadGame();
    applyFit();
    restoreFocus?.focus?.({ preventScroll: true });
    restoreFocus = null;
  };
  const open = (event) => {
    if (state === "expanded") return;
    if (state === "closed") restoreFocus = event?.currentTarget || root.activeElement || null;
    for (const preview of previews) {
      if (!preview.getAttribute("src")) preview.setAttribute("src", preview.dataset.src);
    }
    if (dialog.open) dialog.close();
    previousBodyOverflow = body?.style?.overflow || "";
    if (body?.style) body.style.overflow = "hidden";
    scrollLocked = true;
    setState("expanded");
    dialog.showModal();
    applyFit(); requestFit();
    (activeGame ? backButton || minimizeButton : choices[0] || minimizeButton)?.focus?.({ preventScroll: true });
  };
  const chooseGame = async (event) => {
    const game = event.currentTarget.dataset.gameSelect;
    if (!(game in names) || state !== "expanded") return;
    const token = ++generation;
    if (status) status.textContent = game === "ships" ? "正在连接舰队成员…" : "";
    try {
      if (game === "ships") {
        // Load the same versioned roster used by game 1, only on selection.
        // No network polling, external RSI fetch or homepage preload.
        const members = await loadMembers();
        if (token !== generation || state === "closed") return;
        if (!Array.isArray(members) || members.length < 2 || members.length > 100) throw new Error("舰队成员名单暂不可用，请稍后重试。");
        shipMembers = members.map(({ handle, name, avatar }) => ({ handle, name, avatar: new URL(avatar, root.baseURI).href }));
      }
      if (token !== generation) return;
      membersSent = false;
      updateGame(game);
      frame.setAttribute("src", game === "members" ? "./member-brawl.html" : "/games/ship-battle/index.html?embed=1");
      if (status) status.textContent = "";
      applyFit(); requestFit();
      backButton?.focus?.({ preventScroll: true });
    } catch (error) {
      if (token === generation && status) status.textContent = error.message || "游戏连接失败，请重试。";
    }
  };
  const backToHub = () => {
    const previous = activeGame;
    unloadGame();
    if (status) status.textContent = "";
    applyFit(); requestFit();
    choices.find((choice) => choice.dataset.gameSelect === previous)?.focus?.({ preventScroll: true });
  };
  const onMessage = (event) => {
    if (activeGame !== "ships" || event.origin !== view.location.origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.source !== "gvy.ship-battle" || data.version !== 1 || data.type !== "ready" || membersSent || !shipMembers) return;
    membersSent = true;
    frame.contentWindow.postMessage({ source: "gvy.ship-battle", version: 1, type: "command", command: "set-members", members: shipMembers }, view.location.origin);
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
  for (const button of choices) button.addEventListener("click", chooseGame);
  backButton?.addEventListener("click", backToHub);
  closeButton?.addEventListener("click", minimize);
  minimizeButton?.addEventListener("click", minimize);
  endButton?.addEventListener("click", close);
  frame.addEventListener("load", requestFit);
  dialog.addEventListener("click", onBackdropClick);
  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("close", onNativeClose);
  view?.addEventListener?.("resize", requestFit, { passive: true });
  view?.addEventListener?.("message", onMessage);
  updateGame("");
  setState("closed");

  return {
    open, close, minimize, requestFit,
    cleanup() {
      if (fitFrame) view?.cancelAnimationFrame?.(fitFrame);
      observer?.disconnect();
      for (const button of openers) button.removeEventListener("click", open);
      for (const button of restorers) button.removeEventListener("click", open);
      for (const button of choices) button.removeEventListener("click", chooseGame);
      backButton?.removeEventListener("click", backToHub);
      closeButton?.removeEventListener("click", minimize);
      minimizeButton?.removeEventListener("click", minimize);
      endButton?.removeEventListener("click", close);
      frame.removeEventListener("load", requestFit);
      dialog.removeEventListener("click", onBackdropClick);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onNativeClose);
      view?.removeEventListener?.("resize", requestFit);
      view?.removeEventListener?.("message", onMessage);
      close();
    },
  };
}
