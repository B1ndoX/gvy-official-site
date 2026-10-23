import {initGameCardPreviews} from './game-card-previews.js';
import {createShipGameCache} from './ship-game-cache.js';

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
  const fullscreenButton = dialog?.querySelector?.("[data-member-brawl-fullscreen]");
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
  const cachePanel=dialog?.querySelector?.('[data-ship-cache]');
  const cacheBar=dialog?.querySelector?.('[data-ship-cache-bar]');
  const cacheLabel=dialog?.querySelector?.('[data-ship-cache-label]');
  const cacheNote=dialog?.querySelector?.('[data-ship-cache-note]');
  if (!dialog || !frame || !viewport || !openers.length) return { cleanup() {} };

  const cardPreviews=initGameCardPreviews({root:dialog,view});
  const body = root.body;
  let state = "closed", restoreFocus = null, previousBodyOverflow = "", scrollLocked = false;
  let fitFrame = 0, expandedWidth = 960, expandedHeight = 600;
  let activeGame = "", generation = 0, membersSent = false, shipMembers = null;
  const names = { members: "舰队成员大乱斗", ships: "星际飞船大乱斗" };
  const shipCache=createShipGameCache({view,onProgress(data){
    if(cachePanel){cachePanel.hidden=false;cachePanel.dataset.state=data.type;}
    if(cacheBar){cacheBar.max=data.total||1;if(data.total)cacheBar.value=data.loaded;else cacheBar.removeAttribute('value');}
    if(cacheLabel)cacheLabel.textContent=data.type==='complete'?'飞船资源已缓存':data.type==='error'?data.message:data.total?`准备资源 ${Math.round(data.loaded/data.total*100)}% · ${data.loaded} / ${data.total}`:'正在检查本机游戏缓存…';
    if(cacheNote){cacheNote.hidden=data.type==='complete';cacheNote.textContent=data.firstLoad?'首次准备较久，之后优先读取本机缓存。':'正在补齐未缓存资源，已有资源直接读取。';}
  }});
  let windowMaximized=false, ownsFullscreen=false;
  const updateGame = (game) => {
    cardPreviews.stop(true);
    activeGame = game;
    if(fullscreenButton)fullscreenButton.hidden=!game;
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
    if(next!=="expanded")cardPreviews.stop(true);
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
  const setMaximized = (value) => {
    windowMaximized=value;
    dialog.dataset.windowMaximized=String(value);
    fullscreenButton?.setAttribute("aria-pressed",String(value));
    fullscreenButton?.querySelector("svg path")?.setAttribute("d",value?"M8 8h12v12H8ZM4 16V4h12v4":"M5 5h14v14H5Z");
    fullscreenButton?.setAttribute("aria-label",value?"还原战斗窗口":"全屏战斗窗口");
    fullscreenButton?.setAttribute("title",value?"还原窗口":"全屏");
    requestFit();
  };
  const leaveFullscreen = () => {
    if(!windowMaximized && !ownsFullscreen)return;
    setMaximized(false);
    if(ownsFullscreen && root.fullscreenElement)void root.exitFullscreen?.().catch(()=>{});
    ownsFullscreen=false;
  };
  const toggleFullscreen = async () => {
    if(state!=="expanded" || !activeGame)return;
    if(windowMaximized){leaveFullscreen();return;}
    setMaximized(true);
    // A dialog cannot itself request Fullscreen; keep it in the top layer
    // above the fullscreen document. CSS expansion also works on mobile Safari.
    if(root.documentElement?.requestFullscreen && !root.fullscreenElement){
      try{await root.documentElement.requestFullscreen();ownsFullscreen=true;if(state!=="expanded")leaveFullscreen();}
      catch{/* Element fullscreen is unavailable: retain the expanded window. */}
    }
  };
  const onFullscreenChange = () => {
    if(ownsFullscreen && !root.fullscreenElement){ownsFullscreen=false;setMaximized(false);}
    requestFit();
  };
  const minimize = () => {
    if (state !== "expanded") return;
    leaveFullscreen();
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
    leaveFullscreen();
    shipCache.stop();
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
    void shipCache.prepare();
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
        if(status)status.textContent='正在连接舰队成员…';
        const [members]=await Promise.all([loadMembers(),shipCache.ready()]);
        if (token !== generation || state === "closed") return;
        if (!Array.isArray(members) || members.length < 2 || members.length > 100) throw new Error("舰队成员名单暂不可用，请稍后重试。");
        shipMembers = members.map(({ handle, name, avatar }) => ({ handle, name, avatar: new URL(avatar, root.baseURI).href }));
        shipCache.hold();
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
    leaveFullscreen();
    const previous = activeGame;
    unloadGame();
    shipCache.resume();
    if (status) status.textContent = "";
    applyFit(); requestFit();
    choices.find((choice) => choice.dataset.gameSelect === previous)?.focus?.({ preventScroll: true });
  };
  const onMessage = (event) => {
    if (activeGame !== "ships" || event.origin !== view.location.origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.source !== "gvy.ship-battle" || data.version !== 1) return;
    if(data.type==='loading'){if(data.payload?.active)shipCache.hold();else shipCache.resume();return;}
    if(data.type==='ready')shipCache.resume();
    if (!["members-request", "ready"].includes(data.type) || membersSent || !shipMembers) return;
    membersSent = true;
    frame.contentWindow.postMessage({ source: "gvy.ship-battle", version: 1, type: "command", command: "set-members", members: shipMembers, firstLoad:shipCache.isFirstLoad() }, view.location.origin);
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
  fullscreenButton?.addEventListener("click", toggleFullscreen);
  root.addEventListener?.("fullscreenchange",onFullscreenChange);
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
      fullscreenButton?.removeEventListener("click", toggleFullscreen);
      root.removeEventListener?.("fullscreenchange",onFullscreenChange);
      endButton?.removeEventListener("click", close);
      frame.removeEventListener("load", requestFit);
      dialog.removeEventListener("click", onBackdropClick);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onNativeClose);
      view?.removeEventListener?.("resize", requestFit);
      view?.removeEventListener?.("message", onMessage);
      close();
      shipCache.cleanup();
      cardPreviews.cleanup();
    },
  };
}
