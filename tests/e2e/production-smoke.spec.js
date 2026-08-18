import { expect, test } from "@playwright/test";

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

  await expect(page).toHaveTitle(/星际远航者/);
  await expect(page.locator("[data-hero-shell]")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const gallery = page.locator("[data-archive-grid]");
  const galleryViewport = page.locator(".archive-grid-viewport");
  await galleryViewport.scrollIntoViewIfNeeded();
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

  await page.locator("[data-archive-open='2']").click();
  await expect(page.locator("[data-archive-dialog]")).toHaveAttribute("open", "");
  await expect(page.locator("[data-archive-dialog-image]")).toHaveAttribute("srcset", /optimized\/team-03-1280\.webp/);
  await page.locator("[data-archive-close]").click();

  const brawlOpener = page.locator("[data-member-brawl-open]");
  await brawlOpener.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(brawlOpener).toBeVisible();
  await brawlOpener.click();
  await expect(page.locator("[data-member-brawl-dialog]")).toHaveAttribute("open", "");
  const arena = page.frameLocator("[data-member-brawl-frame]");
  await arena.locator("[data-brawl-start]").click();
  await expect(arena.locator(".member-fighter")).toHaveCount(31);
  await page.locator("[data-member-brawl-close]").click();

  expect(runtimeFailures).toEqual([]);
});

test("mobile navigation keeps all destinations in its own rail and touch-style gallery drag stays under user control", async ({ page }) => {
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
  }));
  expect(navigationRail.overflowX).toBe("auto");
  expect(navigationRail.scrollWidth).toBeGreaterThan(navigationRail.clientWidth);
  await page.locator(".nav-links").evaluate((rail) => rail.scrollTo({ left: rail.scrollWidth, behavior: "instant" }));
  await expect(page.locator(".nav-wikelo-link")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

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
