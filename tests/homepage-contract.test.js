import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const buildScript = await readFile(new URL("scripts/build-site.mjs", root), "utf8");
const homepage = await readFile(new URL("index.html", root), "utf8");

async function readOptional(path) {
  try {
    return await readFile(new URL(path, root), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

const cinematicCss = await readOptional("assets/cinematic-homepage.css");
const fleetData = await readOptional("assets/js/fleet-data.js");
const cinematicTimelines = await readOptional("assets/js/cinematic-timelines.js");
const cinematicHomepage = await readOptional("assets/js/cinematic-homepage.js");

test("project exposes repeatable verification commands", () => {
  assert.equal(packageJson.scripts.test, "node --test");
  assert.equal(packageJson.scripts["check:js"], "node scripts/check-js.mjs");
  assert.match(packageJson.scripts.verify, /npm run test/);
  assert.match(packageJson.scripts.verify, /npm run check:js/);
  assert.match(packageJson.scripts.verify, /npm run build/);
});

test("production build copies local GSAP browser bundles", () => {
  assert.match(buildScript, /node_modules\/gsap\/dist\/gsap\.min\.js/);
  assert.match(buildScript, /node_modules\/gsap\/dist\/ScrollTrigger\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/gsap\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/ScrollTrigger\.min\.js/);
});

test("homepage contains one source-free hero video", () => {
  const heroVideos = homepage.match(/<video\b[^>]*data-hero-video[^>]*>/g) || [];
  assert.equal(heroVideos.length, 1);
  assert.doesNotMatch(heroVideos[0], /\ssrc\s*=/);
  const heroVideoBlock = homepage.match(/<video\b[^>]*data-hero-video[^>]*>[\s\S]*?<\/video>/)?.[0] || "";
  assert.doesNotMatch(heroVideoBlock, /<source\b/);
  assert.match(homepage, /data-hero-poster/);
  assert.match(homepage, /data-hero-shell/);
});

test("homepage follows the approved voyage narrative", () => {
  const orderedIds = ["fleet-signal", "manifesto", "operations", "archive", "recruit"];
  const positions = orderedIds.map((id) => homepage.indexOf(`id="${id}"`));
  positions.forEach((position) => assert.ok(position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);

  assert.match(homepage, /舰队信号已接入/);
  assert.match(homepage, /因远航而集结/);
  assert.match(homepage, /每一次远航，都需要不同的人/);
  assert.match(homepage, /我们真实经历的远航/);
  assert.match(homepage, /下一段航程，等待你的加入/);
  assert.equal((homepage.match(/data-operation-index=/g) || []).length, 4);
});

test("below-fold videos have deferred data sources only", () => {
  const deferredVideos = homepage.match(/<video\b[^>]*data-deferred-media[^>]*>/g) || [];
  assert.equal(deferredVideos.length, 2);
  deferredVideos.forEach((video) => {
    assert.match(video, /data-src="\.\/assets\/(?:operations-planet-video|archive-planet-feed)\.mp4"/);
    assert.doesNotMatch(video, /\ssrc\s*=/);
    assert.match(video, /preload="none"/);
  });
});

test("old planet, card map, and Matter runtime are removed from the active page", () => {
  assert.doesNotMatch(homepage, /matter\.min\.js/i);
  assert.doesNotMatch(homepage, /data-orbit-gallery/);
  assert.doesNotMatch(homepage, /class="[^"]*archive-planet/);
  assert.doesNotMatch(homepage, /operation-video-sphere/);
  assert.doesNotMatch(homepage, /member-brawl/);
});

test("archive controls use SVG icons and compliance copy is exact", () => {
  assert.match(homepage, /data-archive-prev[\s\S]*?<svg/);
  assert.match(homepage, /data-archive-next[\s\S]*?<svg/);
  assert.match(homepage, /陕ICP备2026017597号-1/);
  assert.match(homepage, /https:\/\/beian\.miit\.gov\.cn\//);
  assert.match(
    homepage,
    /本站为玩家自建非商业资料展示站，非 Star Citizen 官方网站，不提供游戏下载、充值、账号交易、虚拟物品交易或游戏运营服务。Star Citizen及相关名称、商标、图像和素材归其权利方所有。/,
  );
});

test("cinematic design system defines responsive and reduced-motion contracts", () => {
  for (const token of [
    "--space-black",
    "--space-navy",
    "--text-primary",
    "--text-secondary",
    "--fleet-gold",
    "--route-blue",
    "--content-max",
    "--motion-ease",
  ]) {
    assert.match(cinematicCss, new RegExp(token));
  }
  assert.match(cinematicCss, /@media \(max-width: 760px\)/);
  assert.match(cinematicCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cinematicCss, /overflow-x:\s*clip/);
});

test("fleet operation data contains four real-image stages", () => {
  const operationsBlock = fleetData.match(/FLEET_OPERATIONS\s*=\s*\[([\s\S]*?)\n\];/)?.[1] || "";
  assert.equal((operationsBlock.match(/number:\s*"0[1-4]"/g) || []).length, 4);
  assert.equal((operationsBlock.match(/image:\s*"\.\/assets\/gallery\/team-/g) || []).length, 4);
  assert.match(fleetData, /COMBAT/);
  assert.match(fleetData, /INDUSTRY/);
  assert.match(fleetData, /LOGISTICS/);
  assert.match(fleetData, /EXPLORATION/);
});

test("cinematic timelines register GSAP and cover every narrative stage", () => {
  assert.match(cinematicTimelines, /registerPlugin\(ScrollTrigger\)/);
  assert.match(cinematicTimelines, /gsap\.matchMedia\(\)/);
  assert.match(cinematicTimelines, /prefers-reduced-motion/);
  assert.match(cinematicTimelines, /min-width:\s*761px/);
  assert.match(cinematicTimelines, /max-width:\s*760px/);
  for (const id of ["hero", "signal", "manifesto", "operations", "recruit"]) {
    assert.match(cinematicTimelines, new RegExp(`gvy-${id}`));
  }
  assert.match(cinematicTimelines, /fadeTextSequenceThroughViewport/);
  assert.match(cinematicTimelines, /stagger:\s*enterStagger/);
  assert.match(cinematicTimelines, /holdDuration\s*=\s*3\.2/);
  assert.match(cinematicTimelines, /scrub:/);
  assert.doesNotMatch(cinematicTimelines, /toggleActions/);
  assert.doesNotMatch(cinematicTimelines, /once:\s*true/);
  assert.match(cinematicTimelines, /fadeThroughViewport/);
  assert.match(cinematicTimelines, /autoAlpha:\s*0,\s*y:\s*exitY/);
  assert.match(cinematicTimelines, /cleanup\(\)/);
  assert.match(homepage, /data-motion-pending/);
  assert.match(cinematicCss, /html\[data-motion-pending\]/);
  assert.match(cinematicHomepage, /removeAttribute\("data-motion-pending"\)/);
});

test("homepage lifecycle initializes every controller once and cleans up", () => {
  assert.match(cinematicHomepage, /initHeroVideo/);
  assert.match(cinematicHomepage, /initDeferredMedia/);
  assert.match(cinematicHomepage, /initArchiveLightbox/);
  assert.match(cinematicHomepage, /initCinematicTimelines/);
  assert.match(cinematicHomepage, /pagehide/);
  assert.match(cinematicHomepage, /cleanup/);
});

test("real fleet imagery uses responsive WebP sources with JPEG fallbacks", async () => {
  const pictures = homepage.match(/<picture\b[\s\S]*?<\/picture>/g) || [];
  assert.ok(pictures.length >= 25);
  assert.match(homepage, /type="image\/webp"/);
  assert.match(homepage, /\.\/assets\/gallery\/optimized\/team-18-1920\.webp 1920w/);
  assert.match(homepage, /\.\/assets\/gallery\/team-18\.jpg/);
  assert.match(homepage, /<img\b[^>]*width="\d+"[^>]*height="\d+"/);
  assert.match(homepage, /<img\b[^>]*loading="lazy"/);

  await Promise.all(
    Array.from({ length: 18 }, (_, index) =>
      access(
        new URL(
          `assets/gallery/optimized/team-${String(index + 1).padStart(2, "0")}-1280.webp`,
          root,
        ),
      ),
    ),
  );
});
