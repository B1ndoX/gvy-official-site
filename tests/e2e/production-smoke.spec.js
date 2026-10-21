import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { decodeRoster } from "../../scripts/lib/rsi-members.mjs";
import { parseGalleryState, removeGalleryItems } from "../../tools/gallery-publisher/lib/gallery-html.mjs";

const fleetRoster = decodeRoster(readFileSync(new URL("../../assets/js/fleet-members.js", import.meta.url), "utf8"));
const media = JSON.parse(readFileSync(new URL("../../config/production-media.json", import.meta.url), "utf8"));
const operationSource = (name) => {
  const asset = media.operationAssets.find((file) => file.startsWith(`${name}-2560-v`));
  if (!asset) throw new Error(`Missing wide operation encode: ${name}`);
  return `./assets/operations-motion/v2/${asset}`;
};

function collectRuntimeFailures(page) {
  const failures = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) failures.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  return failures;
}

test("desktop homepage, gallery and member arena remain operational", async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  const runtimeFailures = collectRuntimeFailures(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveTitle(/星远 GVY/);
  await expect(page.locator("[data-hero-shell]")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const operationSection = page.locator("[data-operations-section]");
  const operationVideos = operationSection.locator("[data-operation-video]");
  const operationCases = [
    ["切换到战斗与护航", "0", operationSource("combat")],
    ["切换到工业与资源", "1", operationSource("industry")],
    ["切换到运输与后勤", "2", operationSource("logistics")],
    ["切换到探索与勘测", "3", operationSource("exploration")],
  ];
  for (const [name, index, source] of operationCases) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(operationSection).toHaveAttribute("data-operation-active", index);
    await expect(operationVideos.nth(Number(index))).toHaveAttribute("src", source);
    await expect.poll(async () => operationVideos.evaluateAll((videos) =>
      videos.filter((video) => video.src && !video.paused).length)).toBe(1);
  }

  const gallery = page.locator("[data-archive-grid]");
  const galleryViewport = page.locator(".archive-grid-viewport");
  await galleryViewport.scrollIntoViewIfNeeded();
  const originals = gallery.locator("button[data-archive-open]:not([data-archive-clone])");
  await expect(gallery.locator("[data-archive-clone]")).toHaveCount(await originals.count());
  await expect(gallery.locator("button[data-archive-clone]")).toHaveCount(0);
  const playback = page.locator("[data-archive-carousel-toggle]");
  await playback.click();
  const pausedAt = await galleryViewport.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(450);
  const pausedAfter = await galleryViewport.evaluate((element) => element.scrollLeft);
  expect(Math.abs(pausedAfter - pausedAt)).toBeLessThan(1);

  const bounds = await galleryViewport.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("[data-archive-dialog]")).not.toHaveAttribute("open", "");

  const targetPhoto = originals.nth(Math.min(2, (await originals.count()) - 1));
  const expectedSource = await targetPhoto.locator("source").getAttribute("srcset");
  await targetPhoto.click();
  await expect(page.locator("[data-archive-dialog]")).toHaveAttribute("open", "");
  await expect(page.locator("[data-archive-dialog-image]")).toHaveAttribute("srcset", expectedSource);
  await page.locator("[data-archive-close]").click();

  const brawlOpener = page.locator("[data-member-brawl-open]");
  await brawlOpener.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(brawlOpener).toBeVisible();
  await brawlOpener.click();
  await page.locator('[data-game-select="members"]').click();
  await expect(page.locator("[data-member-brawl-dialog]")).toHaveAttribute("open", "");
  const arena = page.frameLocator("[data-member-brawl-frame]");
  await arena.locator("[data-brawl-start]").click();
  await expect(arena.locator(".member-fighter")).toHaveCount(fleetRoster.members.length);
  await expect.poll(() => arena.locator(".fighter-avatar-wrap > img").evaluateAll((images) =>
    images.filter((image) => !image.complete || image.naturalWidth === 0).length)).toBe(0);
  await page.locator("[data-member-brawl-close]").click();

  expect(runtimeFailures).toEqual([]);
});

test("mobile navigation fits all destinations in one row and touch-style gallery drag stays under user control", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeFailures = collectRuntimeFailures(page);
  await page.goto("/#fleet-signal", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".command-nav")).toBeVisible();

  const mobileNavigation = await page.locator(".nav-item").evaluateAll((links) =>
    links.map((link) => ({ display: getComputedStyle(link).display, title: link.querySelector("strong")?.textContent })));
  expect(mobileNavigation).toHaveLength(6);
  expect(mobileNavigation.map(({ title }) => title)).toEqual([
    "舰队定位",
    "选择航向",
    "团建图册",
    "加入舰队",
    "蓝图查询",
    "维科洛查询",
  ]);
  mobileNavigation.forEach(({ display }) => expect(display).not.toBe("none"));
  const navigationRail = await page.locator(".nav-links").evaluate((rail) => ({
    clientWidth: rail.clientWidth,
    scrollWidth: rail.scrollWidth,
    overflowX: getComputedStyle(rail).overflowX,
    columns: getComputedStyle(rail).gridTemplateColumns.split(" ").length,
  }));
  expect(navigationRail.overflowX).toBe("hidden");
  expect(navigationRail.scrollWidth).toBe(navigationRail.clientWidth);
  expect(navigationRail.columns).toBe(6);
  for (const item of await page.locator(".nav-item").all()) await expect(item).toBeInViewport();
  for (const caption of await page.locator(".nav-item small").all()) await expect(caption).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const stableBefore = await page.evaluate(() => ({
    fullHeight: getComputedStyle(document.documentElement).getPropertyValue("--gvy-mobile-full-height").trim(),
    heroHeight: document.querySelector("[data-hero-sequence]")?.getBoundingClientRect().height,
    navWillChange: getComputedStyle(document.querySelector(".command-nav")).willChange,
  }));
  expect(stableBefore.fullHeight).toBe("844px");
  expect(stableBefore.navWillChange).toContain("transform");
  await page.setViewportSize({ width: 390, height: 760 });
  await page.waitForTimeout(300);
  const stableAfterHeightOnlyResize = await page.evaluate(() => ({
    fullHeight: getComputedStyle(document.documentElement).getPropertyValue("--gvy-mobile-full-height").trim(),
    heroHeight: document.querySelector("[data-hero-sequence]")?.getBoundingClientRect().height,
  }));
  expect(stableAfterHeightOnlyResize.fullHeight).toBe(stableBefore.fullHeight);
  expect(stableAfterHeightOnlyResize.heroHeight).toBeCloseTo(stableBefore.heroHeight, 3);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  const downwardPosition = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(180);
  const upwardPosition = await page.evaluate(() => window.scrollY);
  expect(upwardPosition).toBeLessThan(downwardPosition);
  await expect(page.locator(".command-nav")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });

  const galleryViewport = page.locator(".archive-grid-viewport");
  await galleryViewport.scrollIntoViewIfNeeded();
  await page.locator("[data-archive-carousel-toggle]").click();
  const before = await galleryViewport.evaluate((element) => element.scrollLeft);
  const bounds = await galleryViewport.boundingBox();
  expect(bounds).not.toBeNull();
  const startX = bounds.x + bounds.width * 0.72;
  const endX = bounds.x + bounds.width * 0.28;
  const y = bounds.y + bounds.height * 0.5;
  await galleryViewport.evaluate((element, points) => {
    const createTouch = (clientX) => new Touch({
      identifier: 7,
      target: element,
      clientX,
      clientY: points.y,
      pageX: clientX,
      pageY: points.y,
      screenX: clientX,
      screenY: points.y,
    });
    const dispatch = (type, activeX, changedX = activeX) => element.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: activeX == null ? [] : [createTouch(activeX)],
      targetTouches: activeX == null ? [] : [createTouch(activeX)],
      changedTouches: [createTouch(changedX)],
    }));
    dispatch("touchstart", points.startX);
    dispatch("touchmove", points.endX);
    dispatch("touchend", null, points.endX);
  }, { startX, endX, y });
  const after = await galleryViewport.evaluate((element) => element.scrollLeft);
  expect(Math.abs(after - before)).toBeGreaterThan(50);
  await expect(page.locator("[data-archive-dialog]")).not.toHaveAttribute("open", "");

  expect(runtimeFailures).toEqual([]);
});

test("mobile cold startup keeps immediate reverse scrolling stable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeFailures = collectRuntimeFailures(page);
  await page.route(/fleet-hero-\d+-mobile-720p-v1\.mp4/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_800));
    await route.abort("failed");
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const initial = await page.evaluate(() => ({
    fullHeight: getComputedStyle(document.documentElement).getPropertyValue("--gvy-mobile-full-height").trim(),
    heroHeight: document.querySelector("[data-hero-sequence]")?.getBoundingClientRect().height,
    scrollHeight: document.documentElement.scrollHeight,
    heroState: document.querySelector("[data-hero-shell]")?.dataset.heroState,
    videoReadyState: document.querySelector("[data-hero-video]")?.readyState,
  }));
  expect(initial.fullHeight).toBe("844px");
  expect(initial.heroState).toBe("loading");
  expect(initial.videoReadyState).toBeLessThan(2);

  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(150);
  const downwardPosition = await page.evaluate(() => window.scrollY);
  expect(downwardPosition).toBeGreaterThan(0);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(220);
  const upwardPosition = await page.evaluate(() => window.scrollY);
  expect(upwardPosition).toBeLessThan(downwardPosition);

  const afterReverse = await page.evaluate(() => ({
    fullHeight: getComputedStyle(document.documentElement).getPropertyValue("--gvy-mobile-full-height").trim(),
    heroHeight: document.querySelector("[data-hero-sequence]")?.getBoundingClientRect().height,
    scrollHeight: document.documentElement.scrollHeight,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  expect(afterReverse.fullHeight).toBe(initial.fullHeight);
  expect(afterReverse.heroHeight).toBeCloseTo(initial.heroHeight, 3);
  expect(afterReverse.scrollHeight).toBe(initial.scrollHeight);
  expect(afterReverse.horizontalOverflow).toBe(false);
  expect(runtimeFailures).toEqual([]);
});

test("2K 16:9 keeps the dedicated pacing and selects the available 1440p hero", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  const runtimeFailures = collectRuntimeFailures(page);
  await page.addInitScript(() => {
    localStorage.setItem("gvy-command-hero-video:v6", JSON.stringify({ index: 1, selectedAt: Date.now() }));
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const state = await page.evaluate(() => {
    const hero = document.querySelector("[data-hero-sequence]");
    const video = document.querySelector("[data-hero-video]");
    const operations = document.querySelector("[data-operations-section]");
    return {
      heroHeight: hero.getBoundingClientRect().height,
      heroQuality: video.dataset.heroVideoQuality,
      heroSource: video.src,
      operationsMinHeight: Number.parseFloat(getComputedStyle(operations).minHeight),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(state.heroHeight).toBeCloseTo(3600, 0);
  expect(state.operationsMinHeight).toBeCloseTo(4752, 0);
  expect(state.heroQuality).toBe("1440p");
  expect(state.heroSource).toMatch(/fleet-hero-02-1440p-v4\.mp4/);
  expect(state.horizontalOverflow).toBe(false);
  expect(runtimeFailures).toEqual([]);
});

test("cached page lifecycle preserves exactly one controller and gallery interaction", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const lifecycle = await page.evaluate(() => {
    const controller = window.__gvyCinematicHomepage;
    const count = document.querySelectorAll("[data-archive-clone]").length;
    for (let i = 0; i < 3; i++) {
      dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    }
    return { same: window.__gvyCinematicHomepage === controller, count,
      after: document.querySelectorAll("[data-archive-clone]").length };
  });
  expect(lifecycle.same).toBe(true);
  expect(lifecycle.count).toBeGreaterThan(0);
  expect(lifecycle.after).toBe(lifecycle.count);
  await page.locator("[data-archive-carousel-toggle]").scrollIntoViewIfNeeded();
  await page.locator("[data-archive-carousel-toggle]").click();
  await expect(page.locator("[data-archive-index]")).toHaveAttribute("data-carousel-state", "paused");
  await page.goto("/404.html");
  await page.goBack({ waitUntil: "commit" });
  await expect.poll(() => page.evaluate(() => !!window.__gvyCinematicHomepage)).toBe(true);
});

test("transient stalled and waiting events preserve the playing hero and locked source", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-hero-shell]")).toHaveAttribute("data-hero-state", "playing");
  const before = await page.locator("[data-hero-video]").evaluate((video) => {
    const state = { src: video.src, time: video.currentTime };
    video.dispatchEvent(new Event("stalled"));
    video.dispatchEvent(new Event("waiting"));
    return state;
  });
  await expect(page.locator("[data-hero-shell]")).toHaveAttribute("data-hero-state", "playing");
  await expect.poll(() => page.locator("[data-hero-video]").evaluate((v) => v.currentTime)).toBeGreaterThan(before.time);
  expect(await page.locator("[data-hero-video]").evaluate((v) => v.src)).toBe(before.src);
});

test("operation state follows both breakpoint directions without duplicate players", async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const section = page.locator("[data-operations-section]");
  for (let i = 0; i < 2; i++) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("[data-operation-visual='3']").evaluate((v) => v.scrollIntoView({ block: "center" }));
    await expect(section).toHaveAttribute("data-operation-active", "3");
    await expect.poll(() => section.locator("video").nth(3).evaluate((v) => !!v.src && !v.paused)).toBe(true);
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.getByRole("button", { name: "切换到工业与资源", exact: true }).click();
    await expect(section).toHaveAttribute("data-operation-active", "1");
    await expect.poll(() => section.locator("video").evaluateAll((vs) => vs.filter((v) => v.src && !v.paused).length)).toBe(1);
  }
});

test("arena start waits for deferred scripts before accepting the first click", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeFailures = collectRuntimeFailures(page);
  let releaseScript;
  const scriptGate = new Promise((resolve) => { releaseScript = resolve; });
  await page.route(/\/assets\/vendor\/matter\.min\.js(?:\?|$)/, async (route) => {
    await scriptGate;
    await route.continue();
  });
  await page.goto("/member-brawl.html", { waitUntil: "commit" });
  const start = page.locator("[data-brawl-start]");
  try {
    await expect(start).toHaveCount(1);
    await expect(start).toHaveAttribute("hidden", "");
    await expect(start).toBeHidden();
  } finally {
    releaseScript();
  }
  await expect(start).toBeVisible();
  await expect(start).toBeEnabled();
  expect(await start.evaluate((button) => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await start.click();
  await expect(page.locator(".member-fighter")).toHaveCount(fleetRoster.members.length);
  const fighter = page.locator(".member-fighter:not([hidden])").first();
  await expect.poll(() => fighter.evaluate((v) => getComputedStyle(v).transform)).not.toBe("none");
  const firstPosition = await fighter.evaluate((v) => getComputedStyle(v).transform);
  await expect.poll(() => fighter.evaluate((v) => getComputedStyle(v).transform)).not.toBe(firstPosition);
  expect(runtimeFailures).toEqual([]);
});

test("arena consumes the current local snapshot and safely displays changed member names without contacting RSI", async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  const upstream = [];
  const rosterRequests = [];
  page.on("request", (request) => { if (/^https:\/\/(?:cdn\.)?robertsspaceindustries\.com\//.test(request.url())) upstream.push(request.url()); });
  page.on("request", (request) => { if (/fleet-members\.js|fleet-command-brawl\.js|\/member-avatars\//.test(request.url())) rosterRequests.push(request.url()); });
  const avatar = fleetRoster.members[0].avatar;
  let names = ['<img src=x onerror="window.unexpectedRosterMarkup=1">', "成员甲 & 成员乙"];
  await page.route(/\/assets\/js\/fleet-members\.js(?:\?|$)/, (route) => route.fulfill({
    contentType: "text/javascript", body: `window.__gvyFleetRoster = ${JSON.stringify({ members: names.map((name) => ({ name, rank: "星舰船员", avatar })) })};`,
  }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__gvyCinematicHomepage));
  expect(rosterRequests).toEqual([]);
  await page.goto("/member-brawl.html");
  await page.locator("[data-brawl-start]").click();
  await expect(page.locator(".member-fighter")).toHaveCount(2);
  expect(await page.locator(".fighter-name").allTextContents()).toEqual(names);
  await expect(page.locator(".fighter-name img")).toHaveCount(0);
  expect(await page.evaluate(() => window.unexpectedRosterMarkup)).toBeUndefined();
  names = ["改名后的成员", "新加入的成员", "第三位成员"];
  await page.reload();
  await page.locator("[data-brawl-start]").click();
  await expect(page.locator(".member-fighter")).toHaveCount(3);
  expect(await page.locator(".fighter-name").allTextContents()).toEqual(names);
  expect(upstream).toEqual([]);
  expect(failures).toEqual([]);
});

test("docking keeps one live arena and only the dock close unloads its document", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("[data-member-brawl-open]").evaluate((v) => v.click());await page.locator('[data-game-select="members"]').click();
  const arena = page.frameLocator("[data-member-brawl-frame]");
  await arena.locator("[data-arena-mode]").selectOption("classic");
  await arena.locator("[data-brawl-start]").click();
  const frame = page.frames().find((f) => f.url().includes("member-brawl.html"));
  await frame.evaluate(() => { window.__arenaAuditIdentity = true; });
  const before = await frame.evaluate(() => window.__gvyArena.snapshot().simTime);
  await page.locator("[data-member-brawl-close]").click();
  await expect(page.locator("[data-member-brawl-dialog]")).toHaveAttribute("data-window-state", "docked");
  await expect.poll(() => frame.evaluate(() => window.__gvyArena.snapshot().simTime)).toBeGreaterThan(before + 250);
  await page.locator("[data-member-brawl-restore]").first().click();
  expect(await frame.evaluate(() => window.__arenaAuditIdentity)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-member-brawl-dialog]")).toHaveAttribute("data-window-state", "docked");
  await page.locator("[data-member-brawl-end]").click();
  await expect(page.locator("[data-member-brawl-dialog]")).not.toHaveAttribute("open", "");
  await expect(page.locator("[data-member-brawl-frame]")).not.toHaveAttribute("src", /.+/);
});

test("manual pause during an attack freezes damage, effects and cooldowns across docking until resumed", async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 20260907;
    Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("[data-member-brawl-open]").evaluate((v) => v.click());await page.locator('[data-game-select="members"]').click();
  const arena = page.frameLocator("[data-member-brawl-frame]");
  await arena.locator("[data-arena-mode]").selectOption("classic");
  await arena.locator("[data-brawl-start]").click();
  const state = () => arena.locator(".member-fighter").evaluateAll((fighters) =>
    fighters.map((v) => ({ id: v.dataset.index, style: v.style.cssText, classes: v.className })));
  for (let cycle = 0; cycle < 3; cycle++) {
    await expect.poll(() => arena.locator(".is-attacking").count()).toBeGreaterThan(0);
    await arena.locator("[data-arena-pause]").click();
    const frozen = await state();
    await page.locator("[data-member-brawl-minimize]").click();
    await page.waitForTimeout(700);
    expect(await state()).toEqual(frozen);
    await page.locator("[data-member-brawl-restore]").first().click();
    await arena.locator("[data-arena-pause]").click();
    await expect.poll(state).not.toEqual(frozen);
  }
});

test("a legally reduced two-photo gallery still supports nodes, cloning and the correct lightbox", async ({ page }) => {
  await page.route("http://127.0.0.1:8001/", async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const gallery = parseGalleryState(html);
    const body = removeGalleryItems(html, gallery.items.slice(2).map((item) => item.number));
    await route.fulfill({ response, body });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-archive-grid] [data-archive-clone]")).toHaveCount(2);
  const photo = page.locator("[data-archive-grid] button[data-archive-open]").nth(1);
  const expected = await photo.locator("source").getAttribute("srcset");
  await photo.click();
  await expect(page.locator("[data-archive-dialog-image]")).toHaveAttribute("srcset", expected);
  await page.locator("[data-archive-close]").click();
});
