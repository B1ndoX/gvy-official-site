import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { observePlayback } from "./playback-audit.js";

const layouts = [
  { name: "desktop", width: 1920, height: 1080, index: 0, resolution: [1920, 1080] },
  { name: "phone", width: 390, height: 844, index: 2, resolution: [1280, 720] },
  { name: "2K", width: 2560, height: 1440, index: 1, resolution: [2560, 1440] },
];

for (const layout of layouts) {
  test(`${layout.name} measures real video startup, cached revisit and offscreen recovery`, async ({ page, browserName }, testInfo) => {
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) failures.push(message.text());
    });
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.addInitScript((index) => localStorage.setItem("gvy-command-hero-video:v6",
      JSON.stringify({ index, selectedAt: Date.now() })), layout.index);
    const audit = await observePlayback(page, browserName);
    const results = [];
    const boundaries = [];
    const hero = page.locator("[data-hero-video]");
    let source;
    try {
      for (const phase of ["cold", "warm"]) {
        audit.setPhase(phase);
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page).toHaveTitle(/星远 GVY/);
        await expect(page.locator("h1")).toBeVisible();
        await expect.poll(() => hero.evaluate((video) => !video.paused && video.currentTime > 0.25)).toBe(true);
        await expect.poll(() => page.evaluate(() => window.__gvyPlaybackAudit()[0]?.firstFrameMs)).toBeGreaterThan(0);
        const sample = await audit.snapshot();
        const primary = sample.media.find(({ role }) => role === "hero");
        expect(primary.resolution).toEqual(layout.resolution);
        expect(primary.firstFrameMs).toBeGreaterThan(0);
        expect(primary.firstFrameMs).toBeLessThan(5000); // Local, unthrottled acceptance; not a public-network SLA.
        expect(primary.errors).toEqual([]);
        expect(primary.rebufferCount).toBe(0);
        source ??= primary.src;
        expect(primary.src).toBe(source);
        expect(sample.media.filter((video) => !video.paused)).toHaveLength(1);
        if (browserName === "chromium") {
          expect(sample.responses.some((response) => response.url === source)).toBe(true);
          expect(sample.responses.every((response) => response.status === 206)).toBe(true);
          expect(sample.responses.every((response) => /max-age=31536000.*immutable/.test(response.cacheControl))).toBe(true);
          if (phase === "warm") expect(sample.responses.some((response) => response.diskCache)).toBe(true);
        }
        results.push(sample);
      }
      // Check the actual sticky-shell geometry, not just the section's scroll
      // position: every controller pause/resume must happen outside the screen.
      await hero.evaluate((video) => {
        window.__heroBoundaryEvents = [];
        for (const type of ["play", "pause"]) video.addEventListener(type, () => {
          const rect = document.querySelector("[data-hero-shell]").getBoundingClientRect();
          window.__heroBoundaryEvents.push({ type, top: rect.top, bottom: rect.bottom,
            currentTime: video.currentTime });
        });
      });
      const edge = await page.locator("[data-hero-sequence]")
        .evaluate((section) => section.getBoundingClientRect().bottom + scrollY);
      const boundarySample = async (phase) => {
        const state = await hero.evaluate((video) => {
          const rect = document.querySelector("[data-hero-shell]").getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, paused: video.paused,
            currentTime: video.currentTime, src: video.currentSrc };
        });
        boundaries.push({ phase, ...state });
        return state;
      };
      const scrollToBoundary = async (screens) => page.evaluate((top) =>
        scrollTo({ top, behavior: "instant" }), edge + layout.height * screens);
      await scrollToBoundary(0.35);
      const leavingTime = await hero.evaluate((video) => video.currentTime);
      await expect.poll(() => hero.evaluate((video) => video.currentTime)).toBeGreaterThan(leavingTime + 0.1);
      const leaving = await boundarySample("just-outside");
      expect(leaving.bottom).toBeLessThan(0);
      expect(leaving.paused).toBe(false);
      await scrollToBoundary(1.35);
      await expect.poll(() => hero.evaluate((video) => video.paused)).toBe(true);
      const distant = await boundarySample("outside-runway");
      expect(distant.bottom).toBeLessThan(-layout.height);
      await scrollToBoundary(0.6);
      await expect.poll(() => hero.evaluate((video) => video.currentTime)).toBeGreaterThan(distant.currentTime + 0.1);
      const approaching = await boundarySample("resumed-before-visible");
      expect(approaching.bottom).toBeLessThan(0);
      expect(approaching.paused).toBe(false);
      expect(approaching.src).toBe(source);
      await scrollToBoundary(-0.7);
      const visibleTime = await hero.evaluate((video) => video.currentTime);
      await expect.poll(() => hero.evaluate((video) => video.currentTime)).toBeGreaterThan(visibleTime + 0.1);
      const visible = await boundarySample("visible-again");
      expect(visible.bottom).toBeGreaterThan(0);
      expect(visible.paused).toBe(false);
      expect(await page.locator("[data-hero-shell]").getAttribute("data-hero-state")).toBe("playing");
      expect(await hero.evaluate(() => window.__heroBoundaryEvents.length)).toBeGreaterThanOrEqual(2);
      expect(await hero.evaluate(() => window.__heroBoundaryEvents.every(({ bottom }) => bottom <= 0))).toBe(true);
      const timeBeforeLeaving = await hero.evaluate((video) => video.currentTime);
      await page.locator("[data-operations-section]").scrollIntoViewIfNeeded();
      await expect.poll(() => hero.evaluate((video) => video.paused)).toBe(true);
      await expect.poll(() => page.locator("[data-operation-video]").evaluateAll((videos) =>
        videos.some((video) => video.src && !video.paused && video.currentTime > 0))).toBe(true);
      expect(await page.locator("video").evaluateAll((videos) => videos.filter((video) => !video.paused).length)).toBe(1);
      const timePaused = await hero.evaluate((video) => video.currentTime);
      // Wait on an actual operation frame; the hero clock must remain stopped.
      await page.waitForFunction(() => [...document.querySelectorAll("[data-operation-video]")]
        .some((video) => !video.paused && video.currentTime > 0.5));
      expect(await hero.evaluate((video) => video.currentTime)).toBe(timePaused);
      expect(timePaused).toBeGreaterThanOrEqual(timeBeforeLeaving);
      audit.setPhase("return-to-hero");
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await expect.poll(() => hero.evaluate((video) => video.currentTime)).toBeGreaterThan(timePaused);
      expect(await hero.evaluate((video) => video.paused)).toBe(false);
      expect(await hero.evaluate((video) => video.currentSrc)).toBe(source);
      expect(await page.locator("[data-hero-shell]").getAttribute("data-hero-state")).toBe("playing");
      const returned = await audit.snapshot();
      expect(returned.responses.filter((response) => response.url === source)).toEqual([]);
      results.push(returned);
      expect(failures).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${layout.name}-hero.png`) });
      console.log(`Playback ${layout.name}: ${results.slice(0, 2).map((result) =>
        `${result.phase} ${Math.round(result.media[0].firstFrameMs)}ms, rebuffer ${result.media[0].rebufferCount}`).join("; ")}`);
    } finally {
      const metricsPath = testInfo.outputPath("playback-metrics.json");
      await writeFile(metricsPath, JSON.stringify({ layout, results, boundaries,
        boundaryEvents: await page.evaluate(() => window.__heroBoundaryEvents || []),
        lastSnapshot: await audit.snapshot() }, null, 2) + "\n");
      await testInfo.attach("playback-metrics", { path: metricsPath, contentType: "application/json" });
    }
  });
}
