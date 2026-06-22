const root = document.documentElement;
const intro = document.querySelector("[data-intro-sequence]");
const introSticky = document.querySelector("[data-intro-sticky]");
const navLinks = [...document.querySelectorAll("[data-scroll-link]")];
const sections = [...document.querySelectorAll("main section[id]")];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let openArchiveFrame = () => {};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function smoothRange(progress, start, end) {
  const value = clamp((progress - start) / Math.max(0.001, end - start), 0, 1);
  return value * value * (3 - 2 * value);
}

function initSiteBackdrop() {
  const canvas = document.querySelector("#siteBackdropCanvas");
  if (!canvas) return;

  const context = canvas.getContext("2d", { alpha: true });
  let width = 0;
  let height = 0;
  let stars = [];
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let pointerDown = false;
  let frameId = 0;

  function createStars() {
    const compact = window.innerWidth < 720;
    const count = compact ? 90 : 190;
    stars = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * 0.85 + 0.15,
      size: Math.random() * 1.25 + 0.25,
      twinkle: Math.random() * Math.PI * 2,
      warm: Math.random() > 0.86,
    }));
  }

  function resize() {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(window.innerWidth));
    height = Math.max(1, Math.round(window.innerHeight));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    createStars();
  }

  function requestRender() {
    if (!frameId) frameId = requestAnimationFrame(render);
  }

  function render(time = 0) {
    frameId = 0;
    pointerX += (targetX - pointerX) * 0.055;
    pointerY += (targetY - pointerY) * 0.055;
    root.style.setProperty("--site-star-x", `${pointerX.toFixed(2)}px`);
    root.style.setProperty("--site-star-y", `${pointerY.toFixed(2)}px`);

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#030508";
    context.fillRect(0, 0, width, height);

    const glowA = context.createRadialGradient(width * 0.72 + pointerX * 0.08, height * 0.24 + pointerY * 0.05, 0, width * 0.72, height * 0.24, width * 0.7);
    glowA.addColorStop(0, "rgba(95, 168, 211, 0.12)");
    glowA.addColorStop(0.45, "rgba(95, 168, 211, 0.035)");
    glowA.addColorStop(1, "rgba(95, 168, 211, 0)");
    context.fillStyle = glowA;
    context.fillRect(0, 0, width, height);

    const glowB = context.createRadialGradient(width * 0.18 - pointerX * 0.06, height * 0.68 - pointerY * 0.04, 0, width * 0.18, height * 0.68, width * 0.48);
    glowB.addColorStop(0, "rgba(200, 164, 93, 0.06)");
    glowB.addColorStop(0.54, "rgba(200, 164, 93, 0.018)");
    glowB.addColorStop(1, "rgba(200, 164, 93, 0)");
    context.fillStyle = glowB;
    context.fillRect(0, 0, width, height);

    stars.forEach((star) => {
      const strengthX = pointerDown ? 0.075 : 0.045;
      const strengthY = pointerDown ? 0.06 : 0.036;
      const x = star.x * width + pointerX * star.z * strengthX;
      const y = star.y * height + pointerY * star.z * strengthY;
      const alpha = clamp(0.22 + star.z * 0.62 + Math.sin(time * 0.0012 + star.twinkle) * 0.12, 0.16, 0.88);
      context.beginPath();
      context.fillStyle = star.warm ? `rgba(200, 164, 93, ${alpha})` : `rgba(222, 240, 248, ${alpha})`;
      context.arc(x, y, star.size * star.z, 0, Math.PI * 2);
      context.fill();
    });

    if (!prefersReducedMotion && (Math.abs(targetX - pointerX) > 0.45 || Math.abs(targetY - pointerY) > 0.45)) requestRender();
  }

  function updatePointer(event) {
    targetX = event.clientX - width / 2;
    targetY = event.clientY - height / 2;
    requestRender();
  }

  resize();
  render();
  window.addEventListener("resize", () => {
    resize();
    requestRender();
  }, { passive: true });
  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    pointerDown = true;
    updatePointer(event);
  }, { passive: true });
  window.addEventListener("pointerup", () => {
    pointerDown = false;
    requestRender();
  }, { passive: true });
  window.addEventListener("pointercancel", () => {
    pointerDown = false;
    requestRender();
  }, { passive: true });

  return () => cancelAnimationFrame(frameId);
}

function initStarfield() {
  const canvas = document.querySelector("#starfieldCanvas");
  if (!canvas || !introSticky) return;

  const context = canvas.getContext("2d", { alpha: true });
  let width = 0;
  let height = 0;
  let stars = [];
  let animationFrame = 0;
  let lastRender = 0;

  function createStars() {
    const compact = window.innerWidth < 720;
    const count = compact ? 80 : 160;
    stars = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * 0.9 + 0.1,
      size: Math.random() * 1.7 + 0.35,
      drift: Math.random() * 0.28 + 0.06,
      warm: Math.random() > 0.82,
    }));
  }

  function resize() {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const box = introSticky.getBoundingClientRect();
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    createStars();
  }

  function drawNebula(progress) {
    const blueGlow = context.createRadialGradient(width * 0.72, height * 0.28, 0, width * 0.72, height * 0.28, width * 0.52);
    blueGlow.addColorStop(0, `rgba(95, 168, 211, ${0.13 + progress * 0.04})`);
    blueGlow.addColorStop(0.42, "rgba(95, 168, 211, 0.04)");
    blueGlow.addColorStop(1, "rgba(95, 168, 211, 0)");
    context.fillStyle = blueGlow;
    context.fillRect(0, 0, width, height);

    const goldGlow = context.createRadialGradient(width * 0.23, height * 0.62, 0, width * 0.23, height * 0.62, width * 0.38);
    goldGlow.addColorStop(0, "rgba(200, 164, 93, 0.08)");
    goldGlow.addColorStop(0.5, "rgba(200, 164, 93, 0.025)");
    goldGlow.addColorStop(1, "rgba(200, 164, 93, 0)");
    context.fillStyle = goldGlow;
    context.fillRect(0, 0, width, height);
  }

  function render(time = 0) {
    if (prefersReducedMotion && lastRender) return;
    lastRender = time;
    const progress = Number.parseFloat(intro?.style.getPropertyValue("--intro-progress")) || 0;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#030508";
    context.fillRect(0, 0, width, height);
    drawNebula(progress);

    context.save();
    context.translate(width / 2, height / 2);

    stars.forEach((star) => {
      const warp = progress * progress * 70 * star.z;
      const drift = prefersReducedMotion ? 0 : (time * 0.000015 * star.drift) % 1;
      const x = (star.x - 0.5) * width * (1 + progress * 0.24) + (star.x - 0.5) * warp;
      const y = (((star.y + drift) % 1) - 0.5) * height * (1 + progress * 0.18) + (star.y - 0.5) * warp * 0.72;
      const alpha = clamp(0.28 + star.z * 0.75 + progress * 0.18, 0.18, 1);
      const length = 1 + progress * 18 * star.z;

      context.beginPath();
      context.strokeStyle = star.warm ? `rgba(200, 164, 93, ${alpha})` : `rgba(242, 245, 247, ${alpha})`;
      context.lineWidth = Math.max(0.45, star.size * star.z);
      context.moveTo(x, y);
      context.lineTo(x + (x > 0 ? length : -length) * 0.36, y + (y > 0 ? length : -length) * 0.16);
      context.stroke();
    });

    context.restore();

    if (!prefersReducedMotion) {
      animationFrame = 0;
    }
  }

  resize();
  render();
  window.addEventListener("resize", resize, { passive: true });

  return () => cancelAnimationFrame(animationFrame);
}

function initHeroVideoFallback() {
  const video = document.querySelector("[data-hero-video]");
  if (!video || !intro) return;

  let markedSlow = false;
  let usingCdnFallback = false;
  const parseVideoOptions = (value = "") =>
    value
      .split("|")
      .map((path) => path.trim())
      .filter((path) => path && !path.includes("operations-planet-video"));
  const localVideoOptions = parseVideoOptions(video.dataset.heroVideos);
  const cdnVideoOptions = parseVideoOptions(video.dataset.heroCdnVideos);
  const query = new URLSearchParams(window.location.search);
  const requestedVideo = Number(query.get("heroVideo"));
  const forceLocalVideo = query.get("heroSource") === "local";
  const preferredSource = cdnVideoOptions.length > 0 && !forceLocalVideo ? "cdn" : "local";
  const videoOptions = preferredSource === "cdn" ? cdnVideoOptions : localVideoOptions;
  const fallbackVideoOptions = preferredSource === "cdn" ? localVideoOptions : [];
  const cacheSourceKey = `${video.dataset.heroCacheKey || "gvy-command-hero-video"}:${preferredSource}`;
  const cacheTtl = 1000 * 60 * 60 * 24 * 7;

  function readCachedVideoIndex(cacheKey) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (!cached || Date.now() - cached.time > cacheTtl) return -1;
      return Number.isInteger(cached.index) ? cached.index : -1;
    } catch {
      return -1;
    }
  }

  function writeCachedVideoIndex(cacheKey, index) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ index, time: Date.now() }));
    } catch {
      // Private browsing or restricted storage should not block video playback.
    }
  }

  function chooseVideoIndex(options, cacheKey) {
    const requestedIndex = Number.isInteger(requestedVideo) ? requestedVideo - 1 : -1;
    const cachedIndex = readCachedVideoIndex(cacheKey);
    const randomIndex = Math.floor(Math.random() * options.length);
    return requestedIndex >= 0 && requestedIndex < options.length
      ? requestedIndex
      : cachedIndex >= 0 && cachedIndex < options.length
        ? cachedIndex
        : randomIndex;
  }

  function applyVideoSource(options, source, cacheKey) {
    if (!options.length) return false;
    const selectedIndex = chooseVideoIndex(options, cacheKey);
    video.src = options[selectedIndex];
    video.dataset.heroVideoSelected = String(selectedIndex + 1);
    video.dataset.heroVideoSource = source;
    writeCachedVideoIndex(cacheKey, selectedIndex);
    video.load();
    return true;
  }

  if (videoOptions.length > 0) {
    applyVideoSource(videoOptions, preferredSource, cacheSourceKey);
  }

  function showPoster() {
    intro.classList.add("video-paused");
  }

  function showVideo() {
    markedSlow = false;
    intro.classList.remove("video-paused", "video-failed");
  }

  function markFailed() {
    if (!usingCdnFallback && preferredSource === "cdn" && fallbackVideoOptions.length > 0) {
      usingCdnFallback = true;
      if (applyVideoSource(fallbackVideoOptions, "local-fallback", `${video.dataset.heroCacheKey || "gvy-command-hero-video"}:local`)) {
        tryPlay();
        return;
      }
    }
    intro.classList.add("video-failed");
  }

  function tryPlay() {
    const playResult = video.play();
    if (playResult?.catch) playResult.catch(showPoster);
  }

  video.addEventListener("playing", showVideo);
  video.addEventListener("canplay", showVideo);
  video.addEventListener("error", markFailed);
  video.addEventListener("stalled", showPoster);
  video.addEventListener("suspend", () => {
    if (video.readyState < 2) showPoster();
  });

  window.setTimeout(() => {
    if (video.readyState < 2) {
      markedSlow = true;
      showPoster();
    }
  }, 2200);

  ["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
    window.addEventListener(
      eventName,
      () => {
        if (markedSlow || intro.classList.contains("video-paused")) tryPlay();
      },
      { once: true, passive: true },
    );
  });

  tryPlay();
}

function updateIntroProgress() {
  if (!intro) return;

  if (prefersReducedMotion) {
    intro.style.setProperty("--intro-progress", "1");
    intro.style.setProperty("--intro-title", "1");
    intro.style.setProperty("--intro-title-label", "1");
    intro.style.setProperty("--intro-title-main", "1");
    intro.style.setProperty("--intro-title-sub", "1");
    intro.style.setProperty("--intro-title-mark", "1");
    intro.style.setProperty("--intro-motto", "1");
    intro.style.setProperty("--intro-hud", "1");
    intro.style.setProperty("--intro-actions", "1");
    intro.style.setProperty("--intro-scroll-cue", "1");
    intro.style.setProperty("--intro-exit", "0");
    intro.style.setProperty("--intro-dark", "0.82");
    intro.style.setProperty("--intro-blackout", "0");
    intro.style.setProperty("--intro-video-opacity", "0.96");
    intro.style.setProperty("--intro-video-brightness", "0.86");
    intro.style.setProperty("--intro-shade-mid", "0.32");
    intro.style.setProperty("--intro-vignette-bottom", "0.28");
    intro.style.setProperty("--intro-scan-opacity", "0.36");
    intro.style.setProperty("--intro-scan-y", "100%");
    intro.style.setProperty("--intro-frame-opacity", "0.13");
    intro.style.setProperty("--intro-frame-blue-opacity", "0.18");
    intro.style.setProperty("--intro-minimal-opacity", "0.2");
    intro.style.setProperty("--intro-fleet-opacity", "0.18");
    intro.style.setProperty("--intro-mobile-fleet-opacity", "0.16");
    intro.style.setProperty("--intro-fleet-y", "0px");
    intro.style.setProperty("--intro-fleet-scale", "1");
    intro.style.setProperty("--intro-title-clip", "0%");
    intro.style.setProperty("--intro-title-y", "0px");
    intro.style.setProperty("--intro-motto-y", "0px");
    intro.style.setProperty("--intro-motto-clip", "0%");
    intro.style.setProperty("--intro-hud-left-x", "0px");
    intro.style.setProperty("--intro-hud-right-x", "0px");
    intro.style.setProperty("--intro-actions-y", "0px");
    intro.style.setProperty("--intro-actions-line-x", "0%");
    intro.style.setProperty("--intro-cue-y", "0px");
    root.style.setProperty("--command-nav-opacity", "1");
    root.style.setProperty("--command-nav-y", "0px");
    root.style.setProperty("--command-nav-pointer", "auto");
    return;
  }

  const rect = intro.getBoundingClientRect();
  const scrollable = Math.max(1, rect.height - window.innerHeight);
  const rawProgress = (0 - rect.top) / scrollable;
  const progress = clamp(rawProgress, 0, 1);
  const titleExit = 1 - smoothRange(rawProgress, 1.72, 2.46);
  const titleLabel = smoothRange(progress, 0.04, 0.22) * titleExit;
  const titleMain = smoothRange(progress, 0.18, 0.48) * titleExit;
  const titleSub = smoothRange(progress, 0.42, 0.64) * titleExit;
  const titleMark = smoothRange(progress, 0.54, 0.74) * titleExit;
  const title = smoothRange(progress, 0.1, 0.78) * titleExit;
  const motto = smoothRange(progress, 0.68, 0.94) * titleExit;
  const hud = smoothRange(progress, 0.72, 0.9);
  const actions = smoothRange(progress, 0.84, 0.98);
  const exit = smoothRange(rawProgress, 1.72, 2.46);
  const navReveal = smoothRange(progress, 0.72, 0.88);
  const scrollCue = 1 - smoothRange(progress, 0.035, 0.18);
  const videoFade = smoothRange(rawProgress, 1.08, 2.38);
  const blackout = smoothRange(rawProgress, 1.26, 2.46) * 0.34;
  const dark = clamp(0.2 + motto * 0.05 + hud * 0.035 + videoFade * 0.18, 0.2, 0.46);
  const videoOpacity = clamp(1 - videoFade * 0.8, 0.2, 1);
  const scanY = -26 + progress * 520;
  const scanOpacity = clamp(0.16 + title * 0.18 + actions * 0.12, 0.12, 0.46);
  const fleetOpacity = clamp(0.06 + hud * 0.15 - exit * 0.08, 0.03, 0.21);
  const mobileFleetOpacity = clamp(0.04 + hud * 0.12 - exit * 0.05, 0.02, 0.16);

  intro.style.setProperty("--intro-progress", progress.toFixed(4));
  intro.style.setProperty("--intro-title", title.toFixed(4));
  intro.style.setProperty("--intro-title-label", titleLabel.toFixed(4));
  intro.style.setProperty("--intro-title-main", titleMain.toFixed(4));
  intro.style.setProperty("--intro-title-sub", titleSub.toFixed(4));
  intro.style.setProperty("--intro-title-mark", titleMark.toFixed(4));
  intro.style.setProperty("--intro-motto", motto.toFixed(4));
  intro.style.setProperty("--intro-hud", hud.toFixed(4));
  intro.style.setProperty("--intro-actions", actions.toFixed(4));
  intro.style.setProperty("--intro-scroll-cue", scrollCue.toFixed(4));
  intro.style.setProperty("--intro-exit", exit.toFixed(4));
  intro.style.setProperty("--intro-dark", dark.toFixed(4));
  intro.style.setProperty("--intro-blackout", blackout.toFixed(4));
  intro.style.setProperty("--intro-video-opacity", videoOpacity.toFixed(4));
  intro.style.setProperty("--intro-video-brightness", clamp(1 - videoFade * 0.8, 0.2, 1).toFixed(4));
  intro.style.setProperty("--intro-shade-mid", clamp(0.22 + dark * 0.32, 0.22, 0.46).toFixed(4));
  intro.style.setProperty("--intro-vignette-bottom", clamp(0.26 + exit * 0.44, 0.26, 0.7).toFixed(4));
  intro.style.setProperty("--intro-scan-opacity", scanOpacity.toFixed(4));
  intro.style.setProperty("--intro-scan-y", `${scanY.toFixed(2)}%`);
  intro.style.setProperty("--intro-frame-opacity", clamp(0.05 + hud * 0.08, 0.05, 0.13).toFixed(4));
  intro.style.setProperty("--intro-frame-blue-opacity", clamp(0.06 + hud * 0.12, 0.06, 0.18).toFixed(4));
  intro.style.setProperty("--intro-minimal-opacity", clamp(0.42 - title * 0.16, 0.18, 0.42).toFixed(4));
  intro.style.setProperty("--intro-fleet-opacity", fleetOpacity.toFixed(4));
  intro.style.setProperty("--intro-mobile-fleet-opacity", mobileFleetOpacity.toFixed(4));
  intro.style.setProperty("--intro-fleet-y", `${(-exit * 34).toFixed(2)}px`);
  intro.style.setProperty("--intro-fleet-scale", (1 + progress * 0.06).toFixed(4));
  intro.style.setProperty("--intro-title-clip", `${((1 - titleMain) * 100).toFixed(2)}%`);
  intro.style.setProperty("--intro-title-y", `${((1 - title) * 24 - exit * 18).toFixed(2)}px`);
  intro.style.setProperty("--intro-motto-y", `${((1 - motto) * 22 - exit * 16).toFixed(2)}px`);
  intro.style.setProperty("--intro-motto-clip", `${((1 - motto) * 100).toFixed(2)}%`);
  intro.style.setProperty("--intro-hud-left-x", `${((1 - hud) * -34).toFixed(2)}px`);
  intro.style.setProperty("--intro-hud-right-x", `${((1 - hud) * 34).toFixed(2)}px`);
  intro.style.setProperty("--intro-actions-y", `${((1 - actions) * 20).toFixed(2)}px`);
  intro.style.setProperty("--intro-actions-line-x", `${(-100 + actions * 100).toFixed(2)}%`);
  intro.style.setProperty("--intro-cue-y", `${((1 - actions) * 12).toFixed(2)}px`);
  root.style.setProperty("--command-nav-opacity", navReveal.toFixed(4));
  root.style.setProperty("--command-nav-y", `${((1 - navReveal) * -12).toFixed(2)}px`);
  root.style.setProperty("--command-nav-pointer", navReveal > 0.95 ? "auto" : "none");
}

function initPointerParallax() {
  if (prefersReducedMotion) return;

  window.addEventListener(
    "pointermove",
    (event) => {
      const x = clamp((event.clientX / window.innerWidth - 0.5) * 10, -5, 5);
      const y = clamp((event.clientY / window.innerHeight - 0.5) * 10, -5, 5);
      root.style.setProperty("--pointer-x", `${x.toFixed(2)}px`);
      root.style.setProperty("--pointer-y", `${y.toFixed(2)}px`);
    },
    { passive: true },
  );
}

function initSmoothLinks() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    });
  });
}

function initNavSpy() {
  const targetMap = new Map();
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href?.startsWith("#") || targetMap.has(href)) return;
    const section = document.querySelector(href);
    if (section) targetMap.set(href, { href, section, links: [] });
  });

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    targetMap.get(href)?.links.push(link);
  });

  const targets = [...targetMap.values()]
    .map((link) => {
      return link;
    })
    .filter(Boolean);
  if (!targets.length) return;

  let ticking = false;

  function sync() {
    const viewportTop = Number.parseFloat(getComputedStyle(root).getPropertyValue("--nav-h")) || 74;
    const viewportBottom = window.innerHeight;
    let active = null;
    let bestScore = -1;

    targets.forEach((item) => {
      const rect = item.section.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, viewportTop);
      const visibleBottom = Math.min(rect.bottom, viewportBottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const centerDistance = Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight * 0.5);
      const score = visibleHeight * 2 - centerDistance * 0.18;
      if (score > bestScore) {
        bestScore = score;
        active = item;
      }
    });

    if (bestScore <= 0 && window.scrollY < targets[0].section.offsetTop - window.innerHeight * 0.5) {
      active = null;
    } else if (!active || bestScore <= 0) {
      active = targets[0];
    }

    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;
    if (nearBottom) active = targets[targets.length - 1];

    targets.forEach((item) => {
      item.links.forEach((link) => {
        link.classList.toggle("is-active", item === active);
        if (item === active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    });
  }

  function requestSync() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      sync();
      ticking = false;
    });
  }

  sync();
  window.addEventListener("scroll", requestSync, { passive: true });
  window.addEventListener("resize", requestSync, { passive: true });
}

function initReveal() {
  const items = [...document.querySelectorAll(".reveal")];
  if (!items.length) return;

  if (prefersReducedMotion) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  items.forEach((item, index) => {
    const isLargeSurface = item.matches(".operation-map, .archive-wall, .doctrine-panel, .terminal");
    const delay = isLargeSurface ? 60 : (index % 4) * 55;
    item.style.setProperty("--reveal-delay", `${delay}ms`);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );
  items.forEach((item) => observer.observe(item));
}

function initDoctrinePanel() {
  const items = [...document.querySelectorAll("[data-doctrine]")];
  const nodes = [...document.querySelectorAll("[data-node]")];
  if (!items.length) return;

  function activate(key) {
    items.forEach((item) => item.classList.toggle("active", item.dataset.doctrine === key));
    nodes.forEach((node) => node.classList.toggle("active", node.dataset.node === key));
  }

  items.forEach((item) => {
    const key = item.dataset.doctrine;
    item.addEventListener("mouseenter", () => activate(key));
    item.addEventListener("focus", () => activate(key));
  });
}

function initOperationMap() {
  const map = document.querySelector("[data-operation-map]");
  const filters = [...document.querySelectorAll("[data-filter]")];
  const nodes = [...document.querySelectorAll(".operation-node")];
  if (!filters.length || !nodes.length) return;

  function syncFilter(role) {
    filters.forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === role);
    });
  }

  function activateNode(node, interacting = true, sync = true) {
    if (!node) return;
    const role = node.dataset.role || "combat";
    nodes.forEach((item) => item.classList.toggle("active", item === node));
    map?.setAttribute("data-active-role", role);
    map?.classList.toggle("is-interacting", interacting);
    if (sync) syncFilter(role);
  }

  function setFilter(role) {
    syncFilter(role);
    nodes.forEach((node) => {
      const matches = role === "all" || node.dataset.role === role;
      node.classList.toggle("is-dimmed", !matches);
    });
    const activeNode = role === "all" ? nodes[0] : nodes.find((node) => node.dataset.role === role);
    activateNode(activeNode, role !== "all", role !== "all");
  }

  filters.forEach((button) => {
    button.addEventListener("click", () => setFilter(button.dataset.filter));
  });

  nodes.forEach((node) => {
    node.addEventListener("mouseenter", () => {
      nodes.forEach((item) => item.classList.remove("is-dimmed"));
      activateNode(node, true);
    });
    node.addEventListener("focus", () => {
      nodes.forEach((item) => item.classList.remove("is-dimmed"));
      activateNode(node, true);
    });
    node.addEventListener("click", () => {
      nodes.forEach((item) => item.classList.remove("is-dimmed"));
      activateNode(node, true);
    });
  });

  map?.addEventListener("mouseleave", () => {
    const activeFilter = filters.find((button) => button.classList.contains("active"))?.dataset.filter || "all";
    if (activeFilter === "all") activateNode(nodes[0], false, false);
  });

  activateNode(nodes.find((node) => node.classList.contains("active")) || nodes[0], false);
}

function initArchiveLightbox() {
  const dialog = document.querySelector("#archiveDialog");
  const image = document.querySelector("#archiveDialogImage");
  const caption = document.querySelector("#archiveDialogCaption");
  const frames = [...document.querySelectorAll(".archive-frame[data-full]")];
  if (!dialog || !image || !caption || !frames.length) return;

  openArchiveFrame = (frame) => {
    const src = frame.dataset.full;
    const label = frame.dataset.caption || frame.querySelector("img")?.alt || "GVY ARCHIVE";
    if (!src) return;
    image.src = src;
    image.alt = label;
    caption.textContent = `GVY ARCHIVE / FLEET MEMORY / ${label}`;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      window.open(src, "_blank", "noopener,noreferrer");
    }
  };

  frames.forEach((frame) => {
    frame.addEventListener("click", (event) => {
      const orbitGallery = frame.closest("[data-orbit-gallery]");
      if (orbitGallery && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (orbitGallery?.dataset.dragSuppressClick === "true") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      openArchiveFrame(frame);
    });
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    image.removeAttribute("src");
  });
}

function initArchiveImageFallback() {
  const frames = [...document.querySelectorAll(".archive-frame[data-full]")];
  frames.forEach((frame) => {
    const image = frame.querySelector("img");
    if (!image) return;

    function handleImageError() {
      if (image.dataset.fallbackTried !== "true") {
        image.dataset.fallbackTried = "true";
        image.src = frame.dataset.full;
        return;
      }

      frame.classList.add("is-image-missing");
      image.hidden = true;
    }

    image.addEventListener("error", handleImageError);
    if (image.complete && image.naturalWidth === 0) handleImageError();
  });
}

function initArchiveOrbit() {
  const gallery = document.querySelector("[data-orbit-gallery]");
  const frames = [...document.querySelectorAll("[data-orbit-gallery] .archive-frame")];
  if (!gallery || !frames.length) return;
  const planetVideo = gallery.querySelector(".archive-planet video");

  let frameId = 0;
  let active = false;
  let paused = false;
  let orbitStartTime = 0;
  let pausedAt = 0;
  let pausedDuration = 0;
  let lastTickTime = 0;
  let dragOffset = 0;
  let dragStartX = 0;
  let dragStartOffset = 0;
  let dragFrame = null;
  let dragPointerId = null;
  let didDrag = false;
  let dragSuppressTimer = 0;
  let size = { width: 0, height: 0, radiusX: 0, radiusY: 0, radiusZ: 0 };
  const orbitItems = frames.map((frame, index) => ({
    frame,
    angle: (index / frames.length) * Math.PI * 2,
    opacity: "",
    transform: "",
    zIndex: "",
    pointerEvents: "",
  }));

  function measure() {
    const box = gallery.getBoundingClientRect();
    size = {
      width: box.width,
      height: box.height,
      radiusX: clamp(box.width * 0.34, 210, 560),
      radiusY: clamp(box.height * 0.13, 62, 132),
      radiusZ: clamp(box.width * 0.24, 160, 390),
    };
    if (window.innerWidth < 720) {
      size.radiusX = clamp(box.width * 0.28, 130, 230);
      size.radiusY = clamp(box.height * 0.11, 44, 88);
      size.radiusZ = clamp(box.width * 0.18, 90, 170);
    }
  }

  function getOrbitTime(time) {
    if (!orbitStartTime && time > 0) orbitStartTime = time;
    if (!orbitStartTime) return 0;
    return Math.max(0, time - orbitStartTime - pausedDuration);
  }

  function place(time = lastTickTime) {
    const rotation = (prefersReducedMotion ? 0.72 : getOrbitTime(time) * 0.000105) + dragOffset;
    orbitItems.forEach((item, index) => {
      const { frame } = item;
      const angle = item.angle + rotation;
      const x = Math.sin(angle) * size.radiusX;
      const depth = Math.cos(angle);
      const depth01 = (depth + 1) / 2;
      const y = Math.sin(angle * 1.7 + index * 0.48) * size.radiusY;
      const scale = Math.round((0.58 + depth01 * 0.48) * 1000) / 1000;
      const opacity = Math.round((0.26 + depth01 * 0.7) * 1000) / 1000;
      const zIndex = String(Math.round(8 + depth01 * 18));
      const tilt = Math.round(-Math.sin(angle) * 50) / 10;
      const pointerEvents = depth01 > 0.18 ? "auto" : "none";
      const nextOpacity = opacity.toFixed(3);
      const nextTransform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotateY(${tilt.toFixed(1)}deg) scale(${scale.toFixed(3)})`;

      if (item.zIndex !== zIndex) {
        frame.style.zIndex = zIndex;
        item.zIndex = zIndex;
      }
      if (item.opacity !== nextOpacity) {
        frame.style.opacity = nextOpacity;
        item.opacity = nextOpacity;
      }
      if (item.transform !== nextTransform) {
        frame.style.transform = nextTransform;
        item.transform = nextTransform;
      }
      if (item.pointerEvents !== pointerEvents) {
        frame.style.pointerEvents = pointerEvents;
        item.pointerEvents = pointerEvents;
      }

      if (prefersReducedMotion) {
        frame.style.setProperty("--static-x", `${x.toFixed(1)}px`);
        frame.style.setProperty("--static-y", `${y.toFixed(1)}px`);
        frame.style.setProperty("--static-scale", scale.toFixed(3));
      }
    });
  }

  function tick(time) {
    if (!active || paused || prefersReducedMotion) return;
    lastTickTime = time;
    place(time);
    frameId = requestAnimationFrame(tick);
  }

  function start() {
    if (active && !paused) return;
    active = true;
    paused = false;
    pausedAt = 0;
    const playResult = planetVideo?.play?.();
    if (playResult?.catch) playResult.catch(() => {});
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(tick);
  }

  function stop() {
    active = false;
    paused = false;
    pausedAt = 0;
    planetVideo?.pause?.();
    cancelAnimationFrame(frameId);
  }

  measure();
  place(0);

  frames.forEach((frame) => {
    frame.addEventListener("pointerenter", () => frame.classList.add("is-hovered"));
    frame.addEventListener("pointerleave", () => frame.classList.remove("is-hovered"));
  });

  gallery.addEventListener(
    "click",
    (event) => {
      if (gallery.dataset.dragSuppressClick !== "true") return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  gallery.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const frame = event.target.closest(".archive-frame");
    if (!frame || !gallery.contains(frame)) return;
    event.preventDefault();
    event.stopPropagation();
    dragFrame = frame;
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartOffset = dragOffset;
    didDrag = false;
    window.clearTimeout(dragSuppressTimer);
    gallery.dataset.dragSuppressClick = "false";
    gallery.classList.add("is-dragging");
    gallery.setPointerCapture?.(event.pointerId);
  });

  gallery.addEventListener("pointermove", (event) => {
    if (dragPointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragStartX;
    if (Math.abs(deltaX) > 4) didDrag = true;
    if (!didDrag) return;
    event.preventDefault();
    dragOffset = dragStartOffset + deltaX * 0.006;
    place(lastTickTime || performance.now());
  });

  function endDrag(event) {
    if (dragPointerId !== event.pointerId) return;
    const frame = dragFrame;
    if (didDrag) {
      gallery.dataset.dragSuppressClick = "true";
      dragSuppressTimer = window.setTimeout(() => {
        gallery.dataset.dragSuppressClick = "false";
      }, 320);
    } else if (frame && event.type !== "pointercancel") {
      gallery.dataset.dragSuppressClick = "true";
      openArchiveFrame(frame);
      dragSuppressTimer = window.setTimeout(() => {
        gallery.dataset.dragSuppressClick = "false";
      }, 320);
    }
    dragFrame = null;
    dragPointerId = null;
    didDrag = false;
    gallery.classList.remove("is-dragging");
    frames.forEach((frame) => frame.classList.remove("is-hovered"));
    gallery.releasePointerCapture?.(event.pointerId);
  }

  gallery.addEventListener("pointerup", endDrag);
  gallery.addEventListener("pointercancel", endDrag);

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting) start();
      else stop();
    },
    { threshold: 0.12 },
  );
  observer.observe(gallery);

  window.addEventListener(
    "resize",
    () => {
      measure();
      place(lastTickTime);
    },
    { passive: true },
  );
}

function initScrollLoop() {
  let ticking = false;

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateIntroProgress();
      ticking = false;
    });
  }

  updateIntroProgress();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
}

initSiteBackdrop();
initStarfield();
initHeroVideoFallback();
initPointerParallax();
initScrollLoop();
initSmoothLinks();
initNavSpy();
initReveal();
initDoctrinePanel();
initOperationMap();
initArchiveImageFallback();
initArchiveOrbit();
initArchiveLightbox();
