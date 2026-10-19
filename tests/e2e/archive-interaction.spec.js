import { expect, test } from "@playwright/test";

const railSelector = "[data-archive-carousel-pagination]";
const nodeSelector = "[data-archive-carousel-node]";
const photoSelector = ".archive-grid-viewport";

function runtimeFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) failures.push(message.text());
  });
  return failures;
}

async function openGallery(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".archive-gallery-controls").scrollIntoViewIfNeeded();
  await expect(page.locator(nodeSelector).first()).toBeVisible();
  const before = await page.locator(photoSelector).evaluate((element) => element.scrollLeft);
  await expect.poll(() => page.locator(photoSelector).evaluate((element) => element.scrollLeft)).toBeGreaterThan(before + 8);
  // Startup image/timeline layout may settle after the first scroll. Raw touch
  // coordinates need the controls fully inside the actual viewport.
  await page.locator(".archive-gallery-controls").evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(page.locator(railSelector)).toBeInViewport({ ratio: 1 });
}

async function selection(page) {
  return page.locator("[data-archive-index]").evaluate((section) => {
    const photo = section.querySelector(".archive-grid-viewport");
    const originals = [...section.querySelectorAll("[data-archive-grid] > [data-archive-open]")];
    const active = section.querySelector("[data-archive-carousel-node].is-active");
    const index = Number(active?.dataset.archiveCarouselNode);
    return { index, target: originals[index].offsetLeft - originals[0].offsetLeft,
      position: photo.scrollLeft, paused: section.dataset.carouselState === "paused",
      opacity: getComputedStyle(section.querySelector("[data-archive-grid]")).opacity,
      label: section.querySelector("[data-archive-carousel-position]").textContent };
  });
}

async function expectSettled(page, index) {
  await expect.poll(async () => {
    const current = await selection(page);
    return current.index === index && Math.abs(current.position - current.target) < 1;
  }).toBe(true);
  expect((await selection(page)).paused).toBe(true);
}

test("node selection is immediate, moves without a fade, and rapid selection obeys the last input", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  const failures = runtimeFailures(page);
  await openGallery(page);
  const nodes = page.locator(nodeSelector);
  const offsets = await nodes.evaluateAll((buttons) => buttons.map((button) => [button.offsetLeft, button.offsetWidth, button.offsetHeight]));
  const before = await selection(page);
  await nodes.nth(3).click();
  const immediate = await selection(page);
  expect(immediate.index).toBe(3);
  expect(immediate.paused).toBe(true);
  expect(immediate.opacity).toBe("1");
  await page.waitForTimeout(140);
  const intermediate = await selection(page);
  expect(intermediate.position).toBeGreaterThan(before.position + 5);
  expect(intermediate.position).toBeLessThan(intermediate.target - 5);
  expect(intermediate.opacity).toBe("1");
  await expectSettled(page, 3);
  expect(await nodes.evaluateAll((buttons) => buttons.map((button) => [button.offsetLeft, button.offsetWidth, button.offsetHeight]))).toEqual(offsets);
  expect(offsets.every(([, width, height]) => width === 44 && height === 44)).toBe(true);
  await page.mouse.move(10, 10);
  const held = (await selection(page)).position;
  await page.waitForTimeout(650);
  expect((await selection(page)).position).toBe(held);

  await nodes.nth(5).click();
  await page.waitForTimeout(65);
  await nodes.nth(1).click();
  await expectSettled(page, 1);
  await page.waitForTimeout(600);
  expect((await selection(page)).index).toBe(1);
  await nodes.nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await expectSettled(page, 2);
  await page.keyboard.press("End");
  await expectSettled(page, (await nodes.count()) - 1);
  await page.keyboard.press("Home");
  await expectSettled(page, 0);
  await page.keyboard.press("Space");
  await expectSettled(page, 0);
  expect(await page.locator(`${nodeSelector}[tabindex="0"]`).count()).toBe(1);
  await nodes.nth(3).click();
  await page.waitForTimeout(70);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".archive-gallery-controls").evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(page.locator(railSelector)).toBeInViewport({ ratio: 1 });
  await expectSettled(page, 3);
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.locator(".archive-gallery-controls").evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(page.locator(railSelector)).toBeInViewport({ ratio: 1 });
  await expectSettled(page, 3);
  await page.screenshot({ path: testInfo.outputPath("desktop-selected.png") });
  await page.locator("[data-archive-carousel-toggle]").click();
  await page.mouse.move(10, 10);
  const resumed = (await selection(page)).position;
  await expect.poll(async () => (await selection(page)).position).toBeGreaterThan(resumed + 8);
  expect(failures).toEqual([]);
});

test("outside release, cancellation and capture loss cannot leave a ghost node drag", async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  const failures = runtimeFailures(page);
  await openGallery(page);
  const rail = page.locator(railSelector);
  const node = await page.locator(nodeSelector).nth(2).boundingBox();
  await page.mouse.move(node.x + node.width / 2, node.y + 1);
  await page.mouse.down();
  await page.mouse.move(node.x + node.width / 2, node.y - 32);
  await page.mouse.up();
  await expect(rail).not.toHaveClass(/is-dragging/);
  const railPosition = await rail.evaluate((element) => element.scrollLeft);
  await page.mouse.move(node.x + node.width / 2, node.y + node.height / 2);
  await page.mouse.move(node.x + node.width / 2 - 90, node.y + node.height / 2);
  expect(await rail.evaluate((element) => element.scrollLeft)).toBe(railPosition);
  await page.mouse.move(10, 10);
  const position = (await selection(page)).position;
  await expect.poll(async () => (await selection(page)).position).toBeGreaterThan(position + 8);

  for (const ending of ["outside", "capture-loss", "cancel", "blur"]) {
    const bounds = await rail.boundingBox();
    await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height / 2, { steps: 6 });
    await expect(rail).toHaveClass(/is-dragging/);
    if (ending === "capture-loss") await rail.evaluate((element) => element.releasePointerCapture(1));
    if (ending === "cancel") await rail.dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse" });
    if (ending === "blur") await page.evaluate(() => dispatchEvent(new Event("blur")));
    await page.mouse.move(bounds.x + bounds.width + 70, bounds.y - 35);
    await page.mouse.up();
    await expect(rail).not.toHaveClass(/is-dragging/);
    const left = await rail.evaluate((element) => element.scrollLeft);
    await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height / 2);
    await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height / 2);
    expect(await rail.evaluate((element) => element.scrollLeft)).toBe(left);
    await expect(page.locator("[data-archive-dialog]")).not.toHaveAttribute("open", "");
  }
  expect(failures).toEqual([]);
});

test("photo dragging settles once and stays selected, while only short clicks open its lightbox", async ({ page }) => {
  const failures = runtimeFailures(page);
  await openGallery(page);
  await page.locator(nodeSelector).nth(4).click();
  await page.waitForTimeout(90); // A new drag must cancel an unfinished node selection.
  const viewport = page.locator(photoSelector);
  const bounds = await viewport.boundingBox();
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(bounds.width * 0.7, y);
  await page.mouse.down();
  await page.mouse.move(bounds.width * 0.35, y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => {
    const state = await selection(page);
    return state.paused && Math.abs(state.position - state.target) < 1;
  }).toBe(true);
  await expect(page.locator("[data-archive-dialog]")).not.toHaveAttribute("open", "");
  const stationary = (await selection(page)).position;
  await page.waitForTimeout(450);
  expect((await selection(page)).position).toBe(stationary);
  const visiblePhoto = await page.locator("[data-archive-grid] > [data-archive-open]").evaluateAll((photos) => {
    const photo = photos.find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.left > 0 && rect.right < innerWidth;
    });
    return photo.dataset.archiveOpen;
  });
  const photo = page.locator(`[data-archive-grid] > [data-archive-open="${visiblePhoto}"]`);
  const card = await photo.boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await expect(page.locator("[data-archive-dialog]")).not.toHaveAttribute("open", "");
  const source = await photo.locator("source").getAttribute("srcset");
  await photo.click();
  await expect(page.locator("[data-archive-dialog]")).toHaveAttribute("open", "");
  await expect(page.locator("[data-archive-dialog-image]")).toHaveAttribute("srcset", source);
  await page.locator("[data-archive-close]").click();
  expect(failures).toEqual([]);
});

test.describe("native mobile gestures", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("holding and native swiping the nodes cannot fight autoplay or accidentally select a photo", async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "Native CDP touch input requires Chromium; physical Safari remains a separate check.");
    const failures = runtimeFailures(page);
    await openGallery(page);
    const rail = page.locator(railSelector);
    await rail.evaluate((element) => {
      window.__archiveNativeScrollEnds = 0;
      element.addEventListener("scrollend", () => { window.__archiveNativeScrollEnds += 1; });
    });
    const bounds = await rail.boundingBox();
    const session = await page.context().newCDPSession(page);
    const touch = async (type, x, y) => session.send("Input.dispatchTouchEvent", { type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
    const x = bounds.x + bounds.width * 0.82;
    const y = bounds.y + bounds.height / 2;
    await touch("touchStart", x, y);
    const held = await selection(page);
    await page.waitForTimeout(400);
    expect(Math.abs((await selection(page)).position - held.position)).toBeLessThan(1);
    for (let step = 1; step <= 8; step += 1) {
      await touch("touchMove", x - step * 20, y);
      await page.waitForTimeout(20);
    }
    const releasePosition = await rail.evaluate((element) => element.scrollLeft);
    await touch("touchEnd");
    await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(50);
    expect((await selection(page)).index).toBe(held.index);
    expect((await selection(page)).paused).toBe(true);
    // Native inertia is intentional. Check that autoplay does not pull the rail
    // back only after the browser says the user's native scroll has finished.
    await expect.poll(() => page.evaluate(() => window.__archiveNativeScrollEnds)).toBeGreaterThan(0);
    const browsed = await rail.evaluate((element) => element.scrollLeft);
    expect(browsed).toBeGreaterThanOrEqual(releasePosition - 1);
    console.log(`Native node rail: release ${releasePosition}px, settled ${browsed}px`);
    await page.waitForTimeout(600);
    expect(Math.abs((await rail.evaluate((element) => element.scrollLeft)) - browsed)).toBeLessThan(2);
    expect(Math.abs((await selection(page)).position - held.position)).toBeLessThan(1);
    const target = await rail.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const button = [...element.querySelectorAll("button")].find((item) => {
        const bounds = item.getBoundingClientRect();
        return bounds.left > rect.left + 20 && bounds.right < rect.right - 20;
      });
      return Number(button.dataset.archiveCarouselNode);
    });
    await page.locator(nodeSelector).nth(target).tap();
    await expectSettled(page, target);
    await expect(page.locator("[data-archive-dialog]")).not.toHaveAttribute("open", "");
    const photo = await page.locator(photoSelector).boundingBox();
    const photoY = photo.y + photo.height / 2;
    await touch("touchStart", 310, photoY);
    for (let step = 1; step <= 8; step += 1) {
      await touch("touchMove", 310 - step * 25, photoY);
      await page.waitForTimeout(20);
    }
    await touch("touchEnd");
    await expect.poll(async () => {
      const state = await selection(page);
      return state.index !== target && Math.abs(state.position - state.target) < 1;
    }).toBe(true);
    await expect(page.locator("[data-archive-dialog]")).not.toHaveAttribute("open", "");
    await page.screenshot({ path: testInfo.outputPath("phone-selected.png") });
    const railAgain = await rail.boundingBox();
    const beforeScroll = await page.evaluate(() => scrollY);
    await touch("touchStart", railAgain.x + 80, railAgain.y + railAgain.height / 2);
    for (let step = 1; step <= 8; step += 1) {
      await touch("touchMove", railAgain.x + 80, railAgain.y + railAgain.height / 2 - step * 18);
      await page.waitForTimeout(20);
    }
    await touch("touchEnd");
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(beforeScroll + 40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(failures).toEqual([]);
  });
});

test("reduced motion selects the exact photo without an animated detour", async ({ page }) => {
  const failures = runtimeFailures(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openGallery(page);
  await page.locator(nodeSelector).nth(3).click();
  const state = await selection(page);
  expect(state.index).toBe(3);
  expect(Math.abs(state.position - state.target)).toBeLessThan(1);
  expect(state.opacity).toBe("1");
  expect(state.paused).toBe(true);
  expect(failures).toEqual([]);
});
