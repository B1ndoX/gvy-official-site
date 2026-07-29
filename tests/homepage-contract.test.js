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
const operationMotion = await readOptional("assets/js/operation-motion.js");
const sectionNavigation = await readOptional("assets/js/section-navigation.js");

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

test("EdgeOne gives operation motion immutable browser and edge cache lifetimes", () => {
  const operationRule = edgeoneConfig.headers.find(
    (rule) => rule.source === "/assets/operations-motion/v2/*",
  );
  assert.ok(operationRule);
  const headers = new Map(operationRule.headers.map(({ key, value }) => [key, value]));
  assert.equal(headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.equal(headers.get("Pages-Cache-Control"), "s-maxage=7776000");
});

test("production build copies local GSAP browser bundles", () => {
  assert.match(buildScript, /node_modules\/gsap\/dist\/gsap\.min\.js/);
  assert.match(buildScript, /node_modules\/gsap\/dist\/ScrollTrigger\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/gsap\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/ScrollTrigger\.min\.js/);
});

test("production build includes all three active hero variants", () => {
  assert.match(buildScript, /fleet-hero-01-1080p-v4\.mp4/);
  assert.match(buildScript, /fleet-hero-01-mobile-720p-v1\.mp4/);
  assert.match(buildScript, /fleet-hero-01-poster-v2\.webp/);
  assert.match(buildScript, /fleet-hero-02-1080p-v4\.mp4/);
  assert.match(buildScript, /fleet-hero-02-mobile-720p-v1\.mp4/);
  assert.match(buildScript, /fleet-hero-02-1440p-v4\.mp4/);
  assert.match(buildScript, /fleet-hero-03-1080p-v1\.mp4/);
  assert.match(buildScript, /fleet-hero-03-mobile-720p-v1\.mp4/);
  assert.match(buildScript, /fleet-hero-03-poster-v1\.webp/);
});

test("production build includes one dedicated mobile encode for every operation", () => {
  for (const name of ["combat", "industry", "logistics", "exploration"]) {
    assert.match(buildScript, new RegExp(`${name}-mobile-1280-v1\\.mp4`));
  }
});

test("homepage selects and starts one hero before the first paint", () => {
  const heroVideos = homepage.match(/<video\b[^>]*data-hero-video[^>]*>/g) || [];
  assert.equal(heroVideos.length, 1);
  assert.doesNotMatch(heroVideos[0], /\ssrc\s*=/);
  const heroVideoBlock = homepage.match(/<video\b[^>]*data-hero-video[^>]*>[\s\S]*?<\/video>/)?.[0] || "";
  assert.doesNotMatch(heroVideoBlock, /<source\b/);
  const heroPoster = homepage.match(/<img\b[^>]*data-hero-poster[^>]*>/)?.[0] || "";
  assert.doesNotMatch(heroPoster, /\ssrc\s*=/);
  assert.match(heroPoster, /fetchpriority="high"/);
  assert.match(homepage, /window\.__gvyHeroBootstrap/);
  assert.match(homepage, /posterPreload\.rel\s*=\s*"preload"/);
  assert.match(homepage, /video\.src\s*=\s*bootstrap\.video/);
  assert.match(homepage, /stickyTtl\s*=\s*10\s*\*\s*60\s*\*\s*1000/);
  assert.doesNotMatch(homepage, /setTimeout\(\(\)\s*=>\s*document\.documentElement\.removeAttribute\("data-motion-pending"\)/);
  assert.match(homepage, /data-hero-shell/);
});

test("homepage follows the approved voyage narrative", () => {
  const orderedIds = ["fleet-signal", "manifesto", "operations", "archive", "recruit"];
  const positions = orderedIds.map((id) => homepage.indexOf(`id="${id}"`));
  positions.forEach((position) => assert.ok(position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);

  assert.match(homepage, /FLEET POSITIONING \/ GALACTIC VOYAGERS/);
  assert.match(homepage, /综合型玩家舰队/);
  assert.match(homepage, /探索未知为方向/);
  assert.match(homepage, /工业体系构筑远航基础/);
  assert.match(homepage, /协同作战与成员互助/);
  assert.match(homepage, /<dt>舰队名称<\/dt><dd>星际远航者<\/dd>/);
  assert.match(homepage, /因远航而集结/);
  assert.match(homepage, /未知值得共同见证，险途值得并肩穿越/);
  assert.match(homepage, /第一次驾驶飞船，还是早已熟悉量子航线/);
  assert.match(homepage, /远航，从来不是一个人的故事/);
  assert.match(homepage, /有人迎战，有人开拓，有人维系航线，也有人率先驶向未知。/);
  assert.match(homepage, /每一个需要它们的地方。/);
  assert.match(homepage, /我们真实经历的远航/);
  assert.match(homepage, /这里记录的，是 GVY 成员真正并肩经历的远航。/);
  assert.doesNotMatch(homepage, /我们不只是舰船与呼号的集合。/);
  assert.doesNotMatch(homepage, /没有虚构，也没有替身。/);
  assert.match(homepage, /下一段航程/);
  assert.match(homepage, /期待你的<em>加入<\/em>/);
  assert.equal((homepage.match(/data-operation-index=/g) || []).length, 4);
});

test("abandoned ambient videos are not mounted in the homepage", () => {
  const deferredVideos = homepage.match(/<video\b[^>]*data-deferred-media[^>]*>/g) || [];
  assert.equal(deferredVideos.length, 0);
  assert.doesNotMatch(homepage, /operations-planet-video\.mp4/);
  assert.doesNotMatch(homepage, /archive-planet-feed\.mp4/);
  assert.doesNotMatch(homepage, /operations-ambient|archive-ambient/);
});

test("operation motion keeps still-image fallbacks and loads no clip from HTML", async () => {
  const operationVideos = homepage.match(/<video\b[^>]*data-operation-video[^>]*>/g) || [];
  assert.equal(operationVideos.length, 4);
  operationVideos.forEach((video) => {
    assert.match(video, /data-src-mobile="\.\/assets\/operations-motion\/v2\/[a-z]+-mobile-1280-v1\.mp4"/);
    assert.match(video, /data-src-compact="\.\/assets\/operations-motion\/v2\/[a-z]+-1920-v2\.mp4"/);
    assert.match(video, /data-src-wide="\.\/assets\/operations-motion\/v2\/[a-z]+-2560-v2\.mp4"/);
    assert.match(video, /preload="none"/);
    assert.doesNotMatch(video, /\ssrc\s*=/);
  });
  assert.match(homepage, /data-operation-active="0"/);
  assert.match(operationMotion, /prefers-reduced-motion: reduce/);
  assert.match(operationMotion, /navigator\?\.connection\?\.saveData/);
  assert.match(operationMotion, /pauseAll/);
  assert.match(operationMotion, /IntersectionObserver|Observer/);
  assert.match(cinematicTimelines, /dataset\.operationActive/);

  await Promise.all(
    ["combat", "industry", "logistics", "exploration"].flatMap((name) =>
      [
        access(new URL(`assets/operations-motion/v2/${name}-mobile-1280-v1.mp4`, root)),
        ...[1920, 2560].map((width) =>
          access(new URL(`assets/operations-motion/v2/${name}-${width}-v2.mp4`, root)),
        ),
      ],
    ),
  );
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
  assert.match(homepage, /class="footer-brand"/);
  assert.match(homepage, /GALACTIC VOYAGERS \/ GVY/);
  assert.match(
    homepage,
    /玩家自建非商业资料站，非 Star Citizen 官方网站；相关名称、商标与素材归其权利方所有。/,
  );
  assert.doesNotMatch(homepage, /不提供游戏下载、充值、账号交易、虚拟物品交易或游戏运营服务/);
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
  assert.match(cinematicCss, /@media \(min-width: 2561px\)/);
  assert.match(cinematicCss, /main,[\s\S]*?\.site-footer\s*\{[\s\S]*?width:\s*2560px;/);
  assert.doesNotMatch(cinematicCss, /min-height:\s*4838px/);
  assert.match(cinematicCss, /grid-template-rows:\s*repeat\(4, 945px\)/);
  assert.match(cinematicCss, /\.operation-visuals,[\s\S]*?\.operation-copy-stack\s*\{\s*display:\s*contents;/);
  assert.match(cinematicCss, /\.hero-sequence\s*\{\s*height:\s*1440px;/);
  assert.match(cinematicCss, /overflow-x:\s*clip/);
  assert.match(
    cinematicCss,
    /\.signal-lead,[\s\S]*?\.signal-story\s*\{[\s\S]*?max-width:\s*clamp\(570px, 38vw, 780px\)/,
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

test("operation stage uses four interactive local progress segments without numeric ornaments", () => {
  assert.equal((homepage.match(/data-operation-jump=/g) || []).length, 4);
  assert.doesNotMatch(homepage, /class="operation-number"/);
  assert.doesNotMatch(homepage, /<span>01<\/span>[\s\S]*?<span>04<\/span>/);
  assert.match(homepage, /<nav class="operation-progress" aria-label="行动编队场景切换">/);
  assert.match(cinematicCss, /\.operation-copy-stack\s*\{[\s\S]*?width:\s*34vw/);
  assert.match(cinematicCss, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(cinematicCss, /\.operation-progress-segment:is\(:hover, :focus-visible\)/);
  assert.match(cinematicCss, /scaleX\(var\(--segment-progress\)\)/);
  assert.match(cinematicCss, /\.operation-progress-segment\.is-past::after\s*\{[\s\S]*?opacity:\s*0\.3/);
  assert.match(cinematicCss, /\.operation-progress-segment\.is-current::after\s*\{[\s\S]*?opacity:\s*1/);
  assert.match(cinematicTimelines, /style\.setProperty\("--segment-progress"/);
  assert.match(cinematicTimelines, /classList\.toggle\("is-past", index < nextIndex\)/);
  assert.match(cinematicTimelines, /classList\.toggle\("is-current", index === nextIndex\)/);
  assert.match(cinematicTimelines, /dataset\.operationJump/);
  assert.match(cinematicTimelines, /scrollTo\(\{ top: targetScroll, behavior: "smooth" \}\)/);
});

test("cinematic timelines register GSAP and cover every narrative stage", () => {
  assert.match(cinematicTimelines, /registerPlugin\(ScrollTrigger\)/);
  assert.match(cinematicTimelines, /ignoreMobileResize:\s*true/);
  assert.match(cinematicTimelines, /gsap\.matchMedia\(\)/);
  assert.match(cinematicTimelines, /prefers-reduced-motion/);
  assert.match(cinematicTimelines, /min-width:\s*761px/);
  assert.match(cinematicTimelines, /max-width:\s*760px/);
  assert.match(cinematicTimelines, /max-width:\s*2560px/);
  assert.match(cinematicTimelines, /wide:\s*"\(min-width:\s*2561px\)/);
  for (const id of ["hero", "signal", "operations", "recruit"]) {
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
  assert.match(cinematicTimelines, /animateBlur:\s*false/);
  assert.match(cinematicTimelines, /end:\s*"bottom 40%"/);
  assert.match(cinematicTimelines, /data-hero-exit-complete/);
  assert.match(cinematicTimelines, /gsap\.set\(heroText,\s*\{[\s\S]*?autoAlpha:\s*0/);
  assert.match(cinematicTimelines, /const heroExitText = \[\.\.\.heroText\]\.reverse\(\)/);
  assert.match(cinematicTimelines, /const enterDuration = 3\.8/);
  assert.match(cinematicTimelines, /const enterStagger = 0\.76/);
  assert.match(cinematicTimelines, /exitStart = 16\.5/);
  assert.match(cinematicTimelines, /exitDuration = 1\.15/);
  assert.match(cinematicTimelines, /exitStagger = 0\.62/);
  assert.match(cinematicTimelines, /\.addLabel\("hero-exit", exitStart\)[\s\S]*?\.to\(\s*heroExitText/);
  const heroExitBlock = cinematicTimelines.match(
    /\.to\(\s*heroExitText,[\s\S]*?"hero-exit",\s*\)/,
  )?.[0] || "";
  assert.match(heroExitBlock, /stagger:\s*exitStagger/);
  assert.doesNotMatch(heroExitBlock, /filter|blur/);
  const mobileTimelineBlock = cinematicTimelines.match(
    /function createMobileTimelines[\s\S]*?\n\}/,
  )?.[0] || "";
  assert.match(mobileTimelineBlock, /showMobileStableContent/);
  assert.doesNotMatch(mobileTimelineBlock, /fadeTextSequenceThroughViewport|fadeThroughViewport/);
  assert.match(homepage, /data-motion-pending/);
  assert.match(homepage, /data-archive-index/);
  assert.match(homepage, /data-archive-carousel-toggle/);
  assert.equal((homepage.match(/data-archive-latest-start/g) || []).length, 1);
  assert.match(homepage, /data-archive-carousel-latest/);
  assert.match(homepage, />NEW</);
  assert.match(homepage, />最新</);
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
  assert.match(archiveCarousel, /pointerdown/);
  assert.match(archiveCarousel, /pointermove/);
  assert.match(archiveCarousel, /setPointerCapture/);
  assert.match(archiveCarousel, /DRAG_THRESHOLD_PX\s*=\s*8/);
  assert.match(archiveCarousel, /suppressClickUntil/);
  assert.match(archiveCarousel, /handleViewportClick, true/);
  assert.match(archiveCarousel, /ArrowRight/);
  assert.match(archiveCarousel, /requestAnimationFrame/);
  assert.match(archiveCarousel, /pixelsPerSecond\s*=\s*48/);
  assert.match(archiveCarousel, /resolveCarouselTargetIndex/);
  assert.match(archiveCarousel, /getCarouselCardPosition/);
  assert.match(archiveCarousel, /getLatestBatchStartIndex/);
  assert.match(archiveCarousel, /is-returning-latest/);
  assert.match(archiveCarousel, /data-archive-clone/);
  assert.match(archiveCarousel, /virtualPosition/);
  assert.match(archiveCarousel, /advanceCarouselPosition/);
  assert.match(archiveCarousel, /updateInViewFromGeometry/);
  assert.match(archiveCarousel, /pageScrolling/);
  assert.doesNotMatch(archiveCarousel, /pageTouchActive/);
  assert.match(archiveCarousel, /addEventListener\?\.\("scroll"/);
  assert.match(archiveCarousel, /let manuallyPaused\s*=\s*false/);
  assert.match(archiveCarousel, /recoverTransientPause/);
  assert.match(archiveCarousel, /addEventListener\?\.\("pointerup"/);
  assert.match(archiveCarousel, /addEventListener\?\.\("focus"/);
  assert.doesNotMatch(archiveCarousel, /intervalMs/);
  assert.match(homepage, /团建相册/);
  assert.doesNotMatch(homepage, /COMPLETE LOG/);
  assert.match(cinematicCss, /html\[data-motion-pending\]/);
  assert.match(cinematicCss, /grid-template-rows:\s*repeat\(4, 56\.25vw auto\)/);
  assert.match(operationMotion, /dataset\.srcMobile/);
  assert.match(operationMotion, /cardObserver/);
  assert.doesNotMatch(cinematicCss, /\.archive-ambient|\.operations-ambient/);
  assert.match(cinematicCss, /\.hero-sequence\s*\{\s*height:\s*220svh;/);
  assert.match(cinematicCss, /rgba\(2, 4, 8, 0\.72\) 84%[\s\S]*?#020408 100%/);
  assert.match(cinematicCss, /overscroll-behavior-y:\s*none/);
  assert.match(cinematicCss, /html\[data-hero-exit-complete\]/);
  assert.match(cinematicHomepage, /removeAttribute\("data-motion-pending"\)/);
});

test("homepage lifecycle initializes every controller once and cleans up", () => {
  assert.match(cinematicHomepage, /initHeroVideo/);
  assert.match(cinematicHomepage, /initDeferredMedia/);
  assert.match(cinematicHomepage, /initArchiveLightbox/);
  assert.match(cinematicHomepage, /initArchiveCarousel/);
  assert.match(cinematicHomepage, /archive-carousel\.js\?v=20260729-gallery-latest-preview-v54/);
  assert.match(cinematicHomepage, /cinematic-timelines\.js\?v=20260728-zoom-scale-v51/);
  assert.match(cinematicHomepage, /operation-motion\.js\?v=20260727-operation-preplay-v37/);
  assert.match(cinematicHomepage, /hero-video-controller\.js\?v=20260722-breathing-media-v26/);
  assert.match(cinematicHomepage, /member-brawl-dialog\.js\?v=20260720-brawl-frame-v16/);
  assert.match(cinematicHomepage, /initMemberBrawlDialog/);
  assert.match(cinematicHomepage, /initOperationMotion/);
  assert.match(cinematicHomepage, /initSectionNavigation/);
  assert.match(cinematicHomepage, /section-navigation\.js\?v=20260726-nav-video-quality-v32/);
  assert.match(sectionNavigation, /aria-current/);
  assert.match(cinematicCss, /\.nav-links a\.is-active::after/);
  assert.match(cinematicHomepage, /initCinematicTimelines/);
  assert.match(cinematicHomepage, /data-motion-initialized/);
  assert.match(cinematicHomepage, /pagehide/);
  assert.match(cinematicHomepage, /cleanup/);
});

test("operation stage fades its entry and exit edges with scroll progress", () => {
  assert.match(cinematicCss, /--operations-entry-shade:\s*1/);
  assert.match(cinematicCss, /--operations-exit-shade:\s*0/);
  assert.match(cinematicCss, /\.operations-stage::after\s*\{[\s\S]*?#040910 100%/);
  assert.match(
    cinematicCss,
    /\.operations-stage::before,\s*\n\s*\.operations-stage::after\s*\{\s*display:\s*none;/,
  );
  assert.match(cinematicTimelines, /"--operations-entry-shade":\s*0[\s\S]*?duration:\s*1\.25/);
  assert.match(cinematicTimelines, /"--operations-exit-shade":\s*1[\s\S]*?duration:\s*1\.46/);
  assert.match(homepage, /cinematic-homepage\.css\?v=20260729-gallery-latest-preview-v54/);
  assert.match(homepage, /cinematic-homepage\.js\?v=20260729-gallery-latest-preview-v54/);
});

test("desktop operation scenes follow continuous scroll progress without forced snapping", () => {
  assert.match(cinematicTimelines, /const stageSpan = 2\.5/);
  assert.match(cinematicTimelines, /const stageSettleOffset = 0\.82/);
  assert.match(cinematicTimelines, /scrub:\s*0\.42/);
  assert.doesNotMatch(cinematicTimelines, /snapToSettledOperation|snap:\s*\{/);
});

test("non-hero narrative pacing removes empty travel without changing the hero sequence", () => {
  assert.match(cinematicCss, /\.hero-sequence\s*\{[\s\S]*?height:\s*250svh/);
  assert.match(cinematicCss, /\.signal-section\s*\{[\s\S]*?min-height:\s*100svh/);
  assert.match(cinematicCss, /\.signal-main\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(cinematicCss, /\.signal-backdrop\s*\{[\s\S]*?mask-image:\s*linear-gradient/);
  assert.match(homepage, /assets\/gvy-logo-hq\.png/);
  assert.doesNotMatch(homepage, /class="manifesto-section/);
  assert.match(cinematicCss, /\.operations-section\s*\{[\s\S]*?min-height:\s*400svh/);
  assert.match(
    cinematicCss,
    /@media \(min-width: 761px\) and \(max-width: 2560px\) and \(min-aspect-ratio: 16 \/ 9\)[\s\S]*?\.signal-section\s*\{[\s\S]*?min-height:\s*92svh[\s\S]*?\.signal-stage\s*\{[\s\S]*?min-height:\s*84svh/,
  );
  assert.match(cinematicTimelines, /id:\s*"gvy-signal-identity"/);
  assert.match(cinematicTimelines, /id:\s*"gvy-signal-visual"[\s\S]*?start:\s*"top 72%"[\s\S]*?end:\s*"top 8%"/);
  assert.match(cinematicTimelines, /id:\s*"gvy-signal-drift"[\s\S]*?start:\s*"top 100%"[\s\S]*?end:\s*"bottom 0%"/);
  assert.match(cinematicTimelines, /id:\s*"gvy-signal-orbits"[\s\S]*?start:\s*"top 100%"[\s\S]*?end:\s*"bottom 0%"/);
  assert.match(cinematicTimelines, /identityCells[\s\S]*?scale:\s*0\.97[\s\S]*?stagger:\s*0\.1/);
  assert.match(cinematicTimelines, /id:\s*"gvy-mobile-signal-orbits"/);
  assert.match(cinematicTimelines, /"gvy-mobile-signal-image"/);
  assert.match(cinematicTimelines, /"gvy-mobile-recruit-image"/);
  assert.match(cinematicCss, /grid-template-rows:\s*repeat\(4, 56\.25vw auto\)/);
  assert.match(cinematicCss, /\.operation-visual:nth-child\(4\)\s*\{\s*grid-row:\s*7/);
  assert.match(cinematicCss, /\.archive-section\s*\{[\s\S]*?padding:\s*24vh 0 16vh/);
});

test("gallery exposes every sequential production team photo before seamless cloning", () => {
  const grid = homepage.match(/<div class="archive-grid" data-archive-grid>([\s\S]*?)<\/div>/)?.[1] || "";
  const galleryCount = (grid.match(/data-archive-open=/g) || []).length;
  assert.ok(galleryCount >= 47);
  assert.match(homepage, new RegExp(`aria-label="${galleryCount} 张舰队团建照片`));
  for (let index = 1; index <= galleryCount; index += 1) {
    assert.match(grid, new RegExp(`data-archive-open="${index - 1}"`));
    assert.match(grid, new RegExp(`team-${String(index).padStart(2, "0")}\\.(?:jpe?g|png)`));
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
  assert.match(homepage, /\.\/assets\/gallery\/optimized\/team-37-1920\.webp 1920w/);
  assert.match(homepage, /\.\/assets\/gallery\/team-37\.png/);
  assert.match(homepage, /\.\/assets\/gallery\/optimized\/team-47-1280\.webp 1280w/);
  assert.match(homepage, /\.\/assets\/gallery\/team-47\.png/);
  assert.match(homepage, /<img\b[^>]*width="\d+"[^>]*height="\d+"/);
  assert.match(homepage, /<img\b[^>]*loading="lazy"/);

  const grid = homepage.match(/<div class="archive-grid" data-archive-grid>([\s\S]*?)<\/div>/)?.[1] || "";
  const galleryCount = (grid.match(/data-archive-open=/g) || []).length;

  await Promise.all(
    Array.from({ length: galleryCount }, (_, index) =>
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
