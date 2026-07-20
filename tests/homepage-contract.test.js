import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const edgeoneConfig = JSON.parse(await readFile(new URL("edgeone.json", root), "utf8"));
const buildScript = await readFile(new URL("scripts/build-site.mjs", root), "utf8");
const homepage = await readFile(new URL("index.html", root), "utf8");
const memberBrawlPage = await readFile(new URL("member-brawl.html", root), "utf8");

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
const archiveCarousel = await readOptional("assets/js/archive-carousel.js");
const memberBrawlDialog = await readOptional("assets/js/member-brawl-dialog.js");

test("project exposes repeatable verification commands", () => {
  assert.equal(packageJson.scripts.test, "node --test");
  assert.equal(packageJson.scripts["check:js"], "node scripts/check-js.mjs");
  assert.equal(packageJson.scripts["check:edgeone"], "node scripts/check-edgeone-media.mjs");
  assert.match(packageJson.scripts.verify, /npm run test/);
  assert.match(packageJson.scripts.verify, /npm run check:js/);
  assert.match(packageJson.scripts.verify, /npm run build/);
});

test("EdgeOne gives versioned hero media long browser and edge cache lifetimes", () => {
  const heroRule = edgeoneConfig.headers.find(
    (rule) => rule.source === "/assets/hero-random/v2/*",
  );
  assert.ok(heroRule);
  const headers = new Map(heroRule.headers.map(({ key, value }) => [key, value]));
  assert.equal(headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.equal(headers.get("Pages-Cache-Control"), "s-maxage=7776000");
});

test("production build copies local GSAP browser bundles", () => {
  assert.match(buildScript, /node_modules\/gsap\/dist\/gsap\.min\.js/);
  assert.match(buildScript, /node_modules\/gsap\/dist\/ScrollTrigger\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/gsap\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/ScrollTrigger\.min\.js/);
});

test("production build includes both active hero variants", () => {
  assert.match(buildScript, /fleet-hero-01-1080p-v4\.mp4/);
  assert.match(buildScript, /fleet-hero-01-poster-v2\.webp/);
  assert.match(buildScript, /fleet-hero-02-1080p-v4\.mp4/);
  assert.match(buildScript, /fleet-hero-02-1440p-v4\.mp4/);
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
  assert.match(homepage, /远航，从来不是一个人的故事/);
  assert.match(homepage, /有人迎战，有人开拓，有人维系航线，也有人率先驶向未知。/);
  assert.match(homepage, /我们真实经历的远航/);
  assert.match(homepage, /下一段航程/);
  assert.match(homepage, /期待你的<em>加入<\/em>/);
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

test("old planet and card map stay removed while the production brawl remains isolated", () => {
  assert.doesNotMatch(homepage, /<script[^>]+matter\.min\.js/i);
  assert.doesNotMatch(homepage, /data-orbit-gallery/);
  assert.doesNotMatch(homepage, /class="[^"]*archive-planet/);
  assert.doesNotMatch(homepage, /operation-video-sphere/);
  assert.match(homepage, /data-member-brawl-open/);
  assert.match(homepage, /data-member-brawl-frame/);
  assert.match(memberBrawlPage, /data-member-brawl-field/);
  assert.match(memberBrawlPage, /assets\/vendor\/matter\.min\.js\?v=0\.20\.0/);
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
  assert.match(
    cinematicCss,
    /\.signal-lead\s*\{[\s\S]*?max-width:\s*700px;[\s\S]*?text-wrap:\s*balance;/,
  );
});

test("fleet operation data contains four official full-bleed stages", () => {
  const operationsBlock = fleetData.match(/FLEET_OPERATIONS\s*=\s*\[([\s\S]*?)\n\];/)?.[1] || "";
  assert.equal((operationsBlock.match(/number:\s*"0[1-4]"/g) || []).length, 4);
  assert.equal((operationsBlock.match(/image:\s*"\.\/assets\/official\/operations-/g) || []).length, 4);
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
  assert.match(cinematicTimelines, /enterDuration\s*=\s*1\.9/);
  assert.match(cinematicTimelines, /holdDuration\s*=\s*4\.6/);
  assert.match(cinematicTimelines, /scrub:/);
  assert.doesNotMatch(cinematicTimelines, /toggleActions/);
  assert.doesNotMatch(cinematicTimelines, /once:\s*true/);
  assert.match(cinematicTimelines, /fadeThroughViewport/);
  assert.match(cinematicTimelines, /autoAlpha:\s*0,\s*y:\s*exitY/);
  assert.match(cinematicTimelines, /cleanup\(\)/);
  assert.doesNotMatch(cinematicTimelines, /gvy-archive-gallery/);
  assert.match(cinematicTimelines, /operationsStage/);
  assert.match(cinematicTimelines, /operationProgress/);
  assert.match(cinematicTimelines, /yPercent:\s*-100/);
  assert.match(cinematicTimelines, /holdDuration:\s*15/);
  assert.match(cinematicTimelines, /animateBlur:\s*false/);
  assert.match(cinematicTimelines, /id:\s*"gvy-hero-exit"/);
  assert.match(cinematicTimelines, /start:\s*"bottom 100%"/);
  assert.match(cinematicTimelines, /end:\s*"bottom 40%"/);
  assert.match(cinematicTimelines, /stagger:\s*\{\s*each:\s*exitStagger,\s*from:\s*"end"\s*\}/);
  const mobileTimelineBlock = cinematicTimelines.match(
    /function createMobileTimelines[\s\S]*?\n\}/,
  )?.[0] || "";
  assert.match(mobileTimelineBlock, /showMobileStableContent/);
  assert.doesNotMatch(mobileTimelineBlock, /fadeTextSequenceThroughViewport|fadeThroughViewport/);
  assert.match(homepage, /data-motion-pending/);
  assert.match(homepage, /data-archive-index/);
  assert.match(homepage, /data-archive-carousel-toggle/);
  assert.match(homepage, /A-007 \/ MUSTER/);
  assert.match(homepage, /A-013 \/ HANGAR/);
  assert.match(homepage, /A-014 \/ FLIGHTLINE/);
  assert.match(homepage, /舰队组织/);
  assert.match(homepage, /<dt>QQ群<\/dt><dd>691311516<\/dd>/);
  assert.match(homepage, /当前状态/);
  assert.doesNotMatch(archiveCarousel, /elastic\.out/);
  assert.doesNotMatch(archiveCarousel, /skewX/);
  assert.doesNotMatch(archiveCarousel, /addEventListener\("wheel"/);
  assert.doesNotMatch(archiveCarousel, /pointerenter/);
  assert.doesNotMatch(archiveCarousel, /focusin/);
  assert.doesNotMatch(archiveCarousel, /pointerdown/);
  assert.doesNotMatch(archiveCarousel, /setPointerCapture/);
  assert.match(archiveCarousel, /ArrowRight/);
  assert.match(archiveCarousel, /requestAnimationFrame/);
  assert.match(archiveCarousel, /pixelsPerSecond\s*=\s*34/);
  assert.match(archiveCarousel, /data-archive-clone/);
  assert.match(archiveCarousel, /pageScrolling/);
  assert.match(archiveCarousel, /pageTouchActive/);
  assert.match(archiveCarousel, /addEventListener\?\.\("scroll"/);
  assert.doesNotMatch(archiveCarousel, /intervalMs/);
  assert.match(homepage, /团建相册/);
  assert.doesNotMatch(homepage, /COMPLETE LOG/);
  assert.match(cinematicCss, /html\[data-motion-pending\]/);
  assert.match(cinematicCss, /\.operation-copy:nth-child\(1\)::before[\s\S]*?\/ contain no-repeat/);
  assert.match(cinematicCss, /\.archive-ambient\s*\{\s*display:\s*none;/);
  assert.match(cinematicCss, /\.hero-sequence\s*\{\s*height:\s*220svh;/);
  assert.match(cinematicCss, /rgba\(2, 4, 8, 0\.72\) 84%[\s\S]*?#020408 100%/);
  assert.match(cinematicHomepage, /removeAttribute\("data-motion-pending"\)/);
});

test("homepage lifecycle initializes every controller once and cleans up", () => {
  assert.match(cinematicHomepage, /initHeroVideo/);
  assert.match(cinematicHomepage, /initDeferredMedia/);
  assert.match(cinematicHomepage, /initArchiveLightbox/);
  assert.match(cinematicHomepage, /initArchiveCarousel/);
  assert.match(cinematicHomepage, /archive-carousel\.js\?v=20260720-reverse-stability-v18/);
  assert.match(cinematicHomepage, /cinematic-timelines\.js\?v=20260720-reverse-stability-v18/);
  assert.match(cinematicHomepage, /member-brawl-dialog\.js\?v=20260720-brawl-frame-v16/);
  assert.match(cinematicHomepage, /initMemberBrawlDialog/);
  assert.match(cinematicHomepage, /initCinematicTimelines/);
  assert.match(cinematicHomepage, /pagehide/);
  assert.match(cinematicHomepage, /cleanup/);
});

test("gallery exposes every one of the 18 production team photos before seamless cloning", () => {
  const grid = homepage.match(/<div class="archive-grid" data-archive-grid>([\s\S]*?)<\/div>/)?.[1] || "";
  assert.equal((grid.match(/data-archive-open=/g) || []).length, 18);
  for (let index = 1; index <= 18; index += 1) {
    assert.match(grid, new RegExp(`team-${String(index).padStart(2, "0")}\\.jpg`));
  }
});

test("member brawl popup preserves the published runtime without a nested frame shell", async () => {
  assert.match(memberBrawlPage, /GVY \/\/ MEMBER ARENA/);
  assert.match(memberBrawlPage, /JOIN READY/);
  assert.match(memberBrawlPage, /RECRUIT ARENA/);
  assert.match(memberBrawlPage, /舰队成员大乱斗，快快加入我们！/);
  assert.match(memberBrawlPage, /data-brawl-start/);
  assert.match(memberBrawlPage, /INITIATE MEMBER ARENA/);
  assert.match(memberBrawlPage, /fleet-command-brawl\.js\?v=20260712-audit-fixes/);
  assert.match(memberBrawlPage, /fleet-command\.js\?v=20260712-audit-fixes/);
  assert.match(memberBrawlDialog, /\.\/member-brawl\.html/);
  assert.match(memberBrawlDialog, /BRAWL_DESIGN_WIDTH\s*=\s*1440/);
  assert.match(memberBrawlDialog, /BRAWL_DESIGN_HEIGHT\s*=\s*900/);
  assert.doesNotMatch(homepage, /data-member-brawl-stage|member-brawl-dialog-shell/);
  assert.match(homepage, /期待你的<em>加入<\/em>/);
  assert.match(cinematicCss, /\.member-brawl-dialog[\s\S]*?aspect-ratio:\s*8\s*\/\s*5/);
  assert.match(cinematicCss, /\.hero-title h1 span[\s\S]*?font-weight:\s*900/);
  assert.match(cinematicTimelines, /ease:\s*"power2\.out"/);
  assert.match(homepage, /scrolling="no"/);
  assert.match(memberBrawlDialog, /member-brawl\.html\?v=20260720-brawl-frame-v16/);
  assert.match(memberBrawlPage, /\.brawl-section[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0;/);
  assert.match(memberBrawlPage, /\.member-brawl-terminal[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%/);
  assert.match(buildScript, /"member-brawl\.html"/);

  const expectedHashes = new Map([
    ["assets/fleet-command-brawl.js", "a7a88d8a42b1c6412238f0a5581e9cb9b3a91c65e930bbee33425d7bdc5af793"],
    ["assets/fleet-command.css", "96c55b6d0d8e5f196e44c310cbd0486c88f561bb6e854d0df2a18cffdcbd6a89"],
    ["assets/vendor/matter.min.js", "72d30be0f579eb02ce1e0b6f9d359a4f392e6837e5a26ba8be5dbee7f88e24ae"],
    ["assets/fleet-command.js", "ab0d6e1f29a97c751f259112e4ff1e60606091f5afd1fdddfba518b4d2c88cb9"],
  ]);

  for (const [path, expected] of expectedHashes) {
    const source = await readFile(new URL(path, root));
    assert.equal(createHash("sha256").update(source).digest("hex"), expected);
  }
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

  await Promise.all(
    ["combat", "industry", "logistics", "exploration"].flatMap((name) =>
      [1280, 1920].map((width) =>
        access(new URL(`assets/official/operations-${name}-${width}.webp`, root)),
      ),
    ),
  );
});
