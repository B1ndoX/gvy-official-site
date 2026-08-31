import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const edgeoneConfig = JSON.parse(await readFile(new URL("edgeone.json", root), "utf8"));
const productionMedia = JSON.parse(await readFile(new URL("config/production-media.json", root), "utf8"));
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
const cinematicTimelines = await readOptional("assets/js/cinematic-timelines.js");
const cinematicHomepage = await readOptional("assets/js/cinematic-homepage.js");
const heroVideoController = await readOptional("assets/js/hero-video-controller.js");
const archiveCarousel = await readOptional("assets/js/archive-carousel.js");
const memberBrawlDialog = await readOptional("assets/js/member-brawl-dialog.js");
const operationMotion = await readOptional("assets/js/operation-motion.js");
const sectionNavigation = await readOptional("assets/js/section-navigation.js");

test("project exposes repeatable verification commands", () => {
  assert.equal(packageJson.scripts.test, "node --test");
  assert.equal(packageJson.scripts["check:js"], "node scripts/check-js.mjs");
  assert.equal(packageJson.scripts["check:edgeone"], "node scripts/check-edgeone-media.mjs");
  assert.equal(packageJson.scripts["test:site"], "node --test tests/*.test.js");
  assert.equal(
    packageJson.scripts["verify:edgeone"],
    "GVY_SKIP_MEDIA_METADATA=1 npm run test:site && npm run check:js && npm run build && npm run check:dist",
  );
  assert.equal(packageJson.scripts["verify:site"], "npm run test:site && npm run check:js && npm run build && npm run check:dist");
  assert.equal(packageJson.scripts.verify, "npm run verify:site && npm run gallery:publisher:test && npm run gallery:publisher:build");
  assert.equal(edgeoneConfig.buildCommand, "npm run verify:edgeone");
  assert.equal(edgeoneConfig.installCommand, "npm ci --ignore-scripts --omit=dev");
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
  assert.equal(
    edgeoneConfig.headers.some((rule) => rule.source === "/assets/operations-motion/v1/*"),
    false,
  );
});

test("production build copies local GSAP browser bundles", () => {
  assert.match(buildScript, /node_modules\/gsap\/dist\/gsap\.min\.js/);
  assert.match(buildScript, /node_modules\/gsap\/dist\/ScrollTrigger\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/gsap\.min\.js/);
  assert.match(buildScript, /assets\/vendor\/ScrollTrigger\.min\.js/);
});

test("production build includes all three active hero variants", () => {
  assert.equal(productionMedia.heroAssets.length, 10);
  for (const id of ["01", "02", "03"]) {
    assert.ok(productionMedia.heroAssets.some((asset) => asset.startsWith(`fleet-hero-${id}-`) && asset.endsWith(".mp4")));
    assert.ok(productionMedia.heroAssets.some((asset) => asset.startsWith(`fleet-hero-${id}-poster`) && asset.endsWith(".webp")));
  }
  assert.match(buildScript, /productionMedia\.heroAssets/);
});

test("homepage, controller, and production build share the exact active hero assets", () => {
  const activePattern = /fleet-hero-(?:01|02|03)-(?:1080p-v4|mobile-720p-v1|poster-v2|1440p-v4|poster-1440p-v3|1080p-v1|poster-v1)\.(?:mp4|webp)/g;
  const getActiveAssets = (source) => [...new Set(source.match(activePattern) || [])].sort();
  const expected = getActiveAssets(homepage);

  assert.equal(expected.length, 10);
  assert.deepEqual(getActiveAssets(heroVideoController), expected);
  assert.deepEqual([...productionMedia.heroAssets].sort(), expected);
});

test("homepage, controller, and production checks share one hero cache version", () => {
  const controllerVersion = heroVideoController.match(/HERO_MEDIA_VERSION\s*=\s*"([^"]+)"/)?.[1];
  const homepageVersions = [...homepage.matchAll(/hero-random\/v2\/[^"']+\?v=([^"']+)/g)]
    .map((match) => match[1]);

  assert.ok(controllerVersion);
  assert.ok(homepageVersions.length >= productionMedia.heroAssets.length);
  assert.deepEqual([...new Set(homepageVersions)], [productionMedia.edgeCacheVersion]);
  assert.equal(controllerVersion, productionMedia.edgeCacheVersion);
});

test("production build excludes publisher-only gallery workspaces", () => {
  for (const path of [
    "assets/gallery/thumbs",
    "assets/gallery/originals",
  ]) {
    assert.match(buildScript, new RegExp(path.replaceAll("/", "\\/")));
  }
});

test("production build includes one dedicated mobile encode for every operation", () => {
  for (const name of ["combat", "industry", "logistics", "exploration"]) {
    assert.ok(productionMedia.operationAssets.includes(`${name}-mobile-1280-v1.mp4`));
  }
  assert.equal(productionMedia.operationAssets.length, 12);
  assert.match(buildScript, /productionMedia\.operationAssets/);
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
  assert.match(homepage, /星远舰队/);
  assert.doesNotMatch(homepage, /星际远航者/);
  assert.match(homepage, /综合型玩家舰队/);
  assert.match(homepage, /探索未知为方向/);
  assert.match(homepage, /工业体系构筑远航基础/);
  assert.match(homepage, /协同作战与成员互助/);
  assert.match(homepage, /<dt>舰队名称<\/dt><dd>星远<\/dd>/);
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

test("navigation keeps six ordered icon-and-caption destinations without item frames", () => {
  assert.match(
    homepage,
    /nav-icon-map[\s\S]*?<strong>舰队定位<\/strong><small>远航档案<\/small>[\s\S]*?nav-icon-compass[\s\S]*?<strong>选择航向<\/strong><small>探索 \/ 行动<\/small>[\s\S]*?nav-icon-images[\s\S]*?<strong>团建图册<\/strong><small>团建回忆<\/small>[\s\S]*?nav-icon-users[\s\S]*?<strong>加入舰队<\/strong><small>招募开放<\/small>[\s\S]*?nav-icon-blueprint[\s\S]*?<strong>蓝图查询<\/strong><small>制造 \/ 拆解<\/small>[\s\S]*?nav-icon-hand-coins[\s\S]*?<strong>维科洛查询<\/strong><small>合同 \/ 奖励<\/small>/,
  );
  assert.match(homepage, /class="nav-item nav-tool-link nav-blueprint-link" href="https:\/\/lantu\.gvyvoyagers\.vip"/);
  assert.match(homepage, /class="nav-item nav-tool-link nav-wikelo-link" href="https:\/\/wikelo\.gvyvoyagers\.vip"/);
  assert.match(cinematicCss, /\.nav-tool-link\s*\{[\s\S]*?border:\s*0/);
  assert.match(cinematicCss, /\.nav-item-icon\s*\{[\s\S]*?mask-size:\s*contain/);
  assert.match(cinematicCss, /\.nav-item-copy small\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(cinematicCss, /@media \(max-width: 760px\)[\s\S]*?grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(cinematicCss, /@media \(max-width: 760px\)[\s\S]*?\.nav-item-copy small\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(cinematicCss, /\.nav-links a\s*\{\s*display:\s*none/);
  assert.match(cinematicCss, /@media \(max-width: 350px\)[\s\S]*?\.brand-copy small\s*\{\s*display:\s*none;/);
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
  assert.match(cinematicCss, /@media \(min-width: 2561px\)[\s\S]*?\.hero-sequence\s*\{[\s\S]*?height:\s*1440px;/);
  assert.match(cinematicCss, /overflow-x:\s*clip/);
  assert.match(
    cinematicCss,
    /\.signal-lead,[\s\S]*?\.signal-story\s*\{[\s\S]*?max-width:\s*clamp\(570px, 38vw, 780px\)/,
  );
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
  assert.match(cinematicTimelines, /enterDuration = 3\.8/);
  assert.match(cinematicTimelines, /enterStagger = 0\.76/);
  assert.match(cinematicTimelines, /holdDuration = 7\.8/);
  assert.match(cinematicTimelines, /exitDuration = 5\.8/);
  assert.match(cinematicTimelines, /exitStagger = 0\.18/);
  assert.match(cinematicTimelines, /const exitStart = enterEnd \+ holdDuration/);
  assert.match(cinematicTimelines, /\.addLabel\("hero-exit", exitStart\)[\s\S]*?\.to\(\s*heroExitText/);
  const heroExitBlock = cinematicTimelines.match(
    /\.to\(\s*heroExitText,[\s\S]*?"hero-exit",\s*\)/,
  )?.[0] || "";
  assert.match(heroExitBlock, /stagger:\s*exitStagger/);
  assert.doesNotMatch(heroExitBlock, /filter|blur/);
  const mobileTimelineBlock = cinematicTimelines.match(
    /function createMobileTimelines[\s\S]*?\n\}/,
  )?.[0] || "";
  assert.match(mobileTimelineBlock, /holdDuration:\s*15/);
  assert.match(mobileTimelineBlock, /exitDuration:\s*10\.4/);
  assert.match(mobileTimelineBlock, /exitStagger:\s*0\.12/);
  assert.match(mobileTimelineBlock, /showMobileStableContent/);
  assert.doesNotMatch(mobileTimelineBlock, /fadeTextSequenceThroughViewport|fadeThroughViewport/);
  assert.match(homepage, /data-motion-pending/);
  assert.match(homepage, /data-archive-index/);
  assert.match(homepage, /data-archive-carousel-toggle/);
  assert.equal((homepage.match(/data-archive-latest-start/g) || []).length, 1);
  assert.match(homepage, /data-archive-carousel-pagination/);
  assert.match(homepage, /按照片选择团建相册；可左右滑动/);
  assert.doesNotMatch(homepage, /data-archive-carousel-latest/);
  assert.doesNotMatch(homepage, /data-archive-carousel-scrubber/);
  assert.doesNotMatch(homepage, /data-archive-carousel-scrubber-output/);
  assert.doesNotMatch(homepage, />NEW</);
  assert.doesNotMatch(homepage, />最新</);
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
  const paginationPointerDown = archiveCarousel.slice(
    archiveCarousel.indexOf("function handlePaginationPointerDown"),
    archiveCarousel.indexOf("function handlePaginationPointerMove"),
  );
  const paginationPointerMove = archiveCarousel.slice(
    archiveCarousel.indexOf("function handlePaginationPointerMove"),
    archiveCarousel.indexOf("function finishPaginationPointer"),
  );
  assert.doesNotMatch(paginationPointerDown, /setPointerCapture/);
  assert.match(paginationPointerMove, /paginationDragging[\s\S]*setPointerCapture/);
  assert.match(archiveCarousel, /DRAG_THRESHOLD_PX\s*=\s*8/);
  assert.match(archiveCarousel, /HOLD_SUPPRESSION_MS\s*=\s*240/);
  assert.match(archiveCarousel, /查看团建照片 \$\{targetIndex \+ 1\}，共 \$\{cards\.length\} 张/);
  assert.match(archiveCarousel, /getCarouselNavigationRevealPosition/);
  assert.match(archiveCarousel, /pagination\.scrollTo/);
  assert.match(archiveCarousel, /paginationStartScrollLeft/);
  assert.match(archiveCarousel, /addEventListener\("mouseenter"/);
  assert.match(archiveCarousel, /addEventListener\("mouseleave"/);
  assert.doesNotMatch(archiveCarousel, /centeredLeft/);
  assert.match(archiveCarousel, /shouldAllowCarouselClick/);
  assert.match(archiveCarousel, /allowPointerClickUntil/);
  assert.match(archiveCarousel, /event\.detail === 0/);
  assert.doesNotMatch(archiveCarousel, /suppressClickUntil|suppressClickTimer|dragSuppressClick/);
  assert.match(archiveCarousel, /handleViewportClick, true/);
  assert.match(archiveCarousel, /ArrowRight/);
  assert.match(archiveCarousel, /requestAnimationFrame/);
  assert.match(archiveCarousel, /pixelsPerSecond\s*=\s*56/);
  assert.match(archiveCarousel, /resolveCarouselTargetIndex/);
  assert.match(archiveCarousel, /getCarouselCardPosition/);
  assert.match(archiveCarousel, /getCarouselNavigationTargetIndexes/);
  assert.match(archiveCarousel, /getCarouselNavigationIndex/);
  assert.doesNotMatch(archiveCarousel, /getCarouselScrubberIndex|startScrubbing|is-scrubbing/);
  assert.match(archiveCarousel, /is-returning-target/);
  assert.match(archiveCarousel, /data-archive-clone/);
  assert.match(archiveCarousel, /virtualPosition/);
  assert.match(archiveCarousel, /advanceCarouselPosition/);
  assert.match(archiveCarousel, /updateInViewFromGeometry/);
  assert.match(archiveCarousel, /pageScrolling/);
  assert.doesNotMatch(archiveCarousel, /pageTouchActive/);
  const touchMove = archiveCarousel.slice(
    archiveCarousel.indexOf("function handleTouchMove"),
    archiveCarousel.indexOf("function cancelTouchResume"),
  );
  assert.match(touchMove, /getCarouselTouchIntent/);
  assert.match(touchMove, /touchIntent !== "horizontal"/);
  assert.match(touchMove, /preventDefault/);
  assert.match(touchMove, /setPosition\(touchStartScrollLeft - \(touch\.clientX - touchStartX\)\)/);
  assert.match(archiveCarousel, /TOUCH_RESUME_DELAY_MS\s*=\s*160/);
  assert.match(archiveCarousel, /addEventListener\("touchmove", handleTouchMove, \{ passive: false \}\)/);
  assert.doesNotMatch(archiveCarousel, /touchSettling|handleViewportScroll/);
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
  assert.match(cinematicCss, /\.hero-sequence\s*\{\s*height:\s*var\(--gvy-mobile-hero-height, 220svh\);/);
  assert.match(cinematicCss, /rgba\(2, 4, 8, 0\.72\) 84%[\s\S]*?#020408 100%/);
  assert.match(cinematicCss, /overscroll-behavior-y:\s*none/);
  assert.match(cinematicCss, /html\[data-hero-exit-complete\]/);
  assert.match(cinematicHomepage, /removeAttribute\("data-motion-pending"\)/);
});

test("homepage lifecycle initializes every controller once and cleans up", () => {
  assert.match(cinematicHomepage, /initHeroVideo/);
  assert.doesNotMatch(cinematicHomepage, /initDeferredMedia|deferred-media\.js/);
  assert.match(cinematicHomepage, /initArchiveLightbox/);
  assert.match(cinematicHomepage, /initArchiveCarousel/);
  assert.match(cinematicHomepage, /archive-lightbox\.js\?v=20260729-gallery-lightbox-webp-v61/);
  assert.match(cinematicHomepage, /archive-carousel\.js\?v=20260819-mobile-viewport-stability-v80/);
  assert.match(cinematicHomepage, /cinematic-timelines\.js\?v=20260819-mobile-viewport-stability-v80/);
  assert.match(cinematicHomepage, /operation-motion\.js\?v=20260727-operation-preplay-v37/);
  assert.match(cinematicHomepage, /hero-video-controller\.js\?v=20260729-hero-source-lock-v60/);
  assert.match(cinematicHomepage, /member-brawl-dialog\.js\?v=20260729-production-trim-v62/);
  assert.match(cinematicHomepage, /initMemberBrawlDialog/);
  assert.match(cinematicHomepage, /initOperationMotion/);
  assert.match(cinematicHomepage, /initSectionNavigation/);
  assert.match(cinematicHomepage, /section-navigation\.js\?v=20260819-mobile-viewport-stability-v80/);
  assert.match(cinematicHomepage, /initMobileViewportStability/);
  assert.match(sectionNavigation, /aria-current/);
  assert.match(cinematicCss, /\.nav-links\s*\{[\s\S]*?touch-action:\s*pan-x/);
  assert.match(cinematicCss, /\.nav-item\.is-active::after/);
  assert.doesNotMatch(cinematicCss, /--nav-active-panel/);
  assert.match(sectionNavigation, /resolveHorizontalFollowTarget/);
  assert.match(cinematicHomepage, /initCinematicTimelines/);
  assert.match(cinematicHomepage, /initStartupTimelineRefresh/);
  assert.match(cinematicHomepage, /shouldSkipStartupRefresh/);
  assert.doesNotMatch(cinematicHomepage, /fonts\?\.ready/);
  assert.match(cinematicHomepage, /addEventListener\?\.\("load", refreshOnce/);
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
  assert.match(homepage, /cinematic-homepage\.js\?v=20260829-startup-refresh-v83/);
  assert.match(homepage, /cinematic-homepage\.css\?v=20260825-mobile-scroll-flash-v82/);
  assert.match(cinematicHomepage, /cinematic-timelines\.js\?v=20260819-mobile-viewport-stability-v80/);
  assert.match(cinematicCss, /\.archive-grid-viewport\s*\{[\s\S]*?touch-action:\s*pan-y pinch-zoom/);
  assert.match(cinematicCss, /\.hero-media\s*\{\s*transform:\s*scale\(1\);\s*will-change:\s*transform;/);
  assert.match(cinematicCss, /@media \(max-width: 760px\)[\s\S]*?\.hero-media\s*\{\s*will-change:\s*auto;/);
  assert.match(cinematicCss, /@media \(max-width: 760px\)[\s\S]*?\.hero-media video\s*\{\s*transition-duration:\s*240ms;/);
});

test("desktop operation scenes follow continuous scroll progress without forced snapping", () => {
  assert.match(cinematicTimelines, /const stageSpan = 2\.5/);
  assert.match(cinematicTimelines, /const stageSettleOffset = 0\.82/);
  assert.match(cinematicTimelines, /scrub:\s*0\.42/);
  assert.doesNotMatch(cinematicTimelines, /snapToSettledOperation|snap:\s*\{/);
});

test("large 16:9 hero only accelerates entry while keeping the restored breathing exit", () => {
  assert.match(cinematicTimelines, /const LARGE_16_9_DESKTOP_QUERY = "\(min-width: 1920px\)[^"]+\(min-aspect-ratio: 17 \/ 10\)"/);
  assert.match(cinematicTimelines, /enterDuration:\s*large16x9Desktop \? 3\.5 : 3\.8/);
  assert.match(cinematicTimelines, /enterStagger:\s*large16x9Desktop \? 0\.7 : 0\.76/);
  assert.match(cinematicTimelines, /holdDuration = 7\.8/);
  assert.match(cinematicTimelines, /exitDuration = 5\.8/);
  assert.match(cinematicTimelines, /exitStagger = 0\.18/);
  assert.match(cinematicCss, /\.hero-motto\s*\{[\s\S]*?bottom:\s*15vh/);
  assert.match(cinematicCss, /@media \(max-width: 760px\)[\s\S]*?\.hero-sequence\s*\{\s*height:\s*var\(--gvy-mobile-hero-height, 220svh\);\s*\}[\s\S]*?\.hero-motto\s*\{\s*right:\s*20px;\s*bottom:\s*17vh;/);
});

test("hero exit remains visible before fleet positioning begins at every viewport", () => {
  assert.match(cinematicCss, /\.hero-sequence\s*\{[\s\S]*?--hero-transition-opacity:\s*0;/);
  assert.doesNotMatch(cinematicCss, /\.hero-sequence::after/);
  assert.match(cinematicCss, /\.hero-sticky::after\s*\{[\s\S]*?z-index:\s*4;[\s\S]*?opacity:\s*var\(--hero-transition-opacity\)/);
  assert.match(cinematicCss, /\.hero-title\s*\{[\s\S]*?z-index:\s*5;/);
  assert.match(cinematicCss, /\.hero-motto\s*\{[\s\S]*?z-index:\s*5;/);
  assert.match(cinematicCss, /\.signal-section\s*\{[\s\S]*?margin-top:\s*0;/);
  assert.match(cinematicTimelines, /const exitStart = enterEnd \+ holdDuration/);
  assert.match(cinematicTimelines, /const exitSpan = exitDuration \+ \(heroExitText\.length - 1\) \* exitStagger/);
  assert.match(cinematicTimelines, /"--hero-transition-opacity":\s*1[\s\S]*?duration:\s*exitSpan[\s\S]*?"hero-exit"/);
  assert.match(cinematicTimelines, /exitDuration = 5\.8/);
  assert.match(cinematicTimelines, /exitStagger = 0\.18/);
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
  assert.match(
    cinematicCss,
    /@media \(min-width: 1920px\) and \(max-width: 2560px\) and \(min-height: 1100px\) and \(min-aspect-ratio: 17 \/ 10\)[\s\S]*?\.hero-sequence\s*\{[\s\S]*?height:\s*250svh[\s\S]*?\.hero-motto\s*\{[\s\S]*?bottom:\s*clamp\(220px, 17vh, 270px\)[\s\S]*?max-width:\s*clamp\(420px, 21vw, 520px\)[\s\S]*?\.hero-motto p\s*\{[\s\S]*?font-size:\s*clamp\(1\.18rem, 1vw, 1\.38rem\)[\s\S]*?\.hero-motto span\s*\{[\s\S]*?font-size:\s*clamp\(0\.82rem, 0\.7vw, 1rem\)[\s\S]*?\.operations-section\s*\{[\s\S]*?min-height:\s*330svh[\s\S]*?\.archive-section\s*\{[\s\S]*?padding:\s*12vh 0 8vh[\s\S]*?\.recruit-section\s*\{[\s\S]*?min-height:\s*90svh/,
  );
});

test("gallery keeps upload order with sequential lightbox indexes and no visible card numbers", () => {
  const grid = homepage.match(/<div class="archive-grid" data-archive-grid[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  const entries = [...grid.matchAll(/data-archive-open="(\d+)"[\s\S]*?<img src="\.\/assets\/gallery\/team-(\d+)\.(?:jpe?g|png)"/g)]
    .map((match) => ({ openIndex: Number(match[1]), number: Number(match[2]) }));
  const galleryCount = entries.length;
  assert.ok(galleryCount >= 2);
  assert.equal(new Set(entries.map((entry) => entry.number)).size, galleryCount);
  assert.match(homepage, /aria-label="舰队团建照片匀速滚动相册，可点击放大或按住拖拽切换"/);
  entries.forEach((entry, index) => {
    assert.equal(entry.openIndex, index);
  });
  assert.doesNotMatch(grid, /<span>\d+<\/span>|远航档案\s*\d+/);
  assert.doesNotMatch(cinematicCss, /\.archive-grid button > span|archive-scrubber/);
  assert.doesNotMatch(homepage, /data-archive-dialog-count|data-archive-dialog-caption/);
  assert.match(homepage, /<figcaption><p>团建回忆<\/p><\/figcaption>/);
});

test("member brawl popup preserves the published runtime without a nested frame shell", async () => {
  assert.match(memberBrawlPage, /GVY \/\/ MEMBER ARENA/);
  assert.match(memberBrawlPage, /JOIN READY/);
  assert.match(memberBrawlPage, /RECRUIT ARENA/);
  assert.match(memberBrawlPage, /舰队成员大乱斗，快快加入我们！/);
  assert.match(memberBrawlPage, /data-brawl-start/);
  assert.match(memberBrawlPage, /INITIATE MEMBER ARENA/);
  assert.match(memberBrawlPage, /fleet-command-brawl\.js\?v=20260712-audit-fixes/);
  assert.doesNotMatch(memberBrawlPage, /<script[^>]+fleet-command\.js/);
  assert.match(memberBrawlPage, /class="member-brawl-terminal reveal is-visible"/);
  assert.match(memberBrawlDialog, /\.\/member-brawl\.html/);
  assert.match(memberBrawlDialog, /BRAWL_DESIGN_WIDTH\s*=\s*1440/);
  assert.match(memberBrawlDialog, /BRAWL_DESIGN_HEIGHT\s*=\s*900/);
  assert.doesNotMatch(homepage, /data-member-brawl-stage|member-brawl-dialog-shell/);
  assert.match(homepage, /期待你的<em>加入<\/em>/);
  assert.match(cinematicCss, /\.member-brawl-dialog[\s\S]*?aspect-ratio:\s*8\s*\/\s*5/);
  assert.match(cinematicCss, /\.hero-title h1 span[\s\S]*?font-weight:\s*900/);
  assert.match(cinematicTimelines, /ease:\s*"power2\.out"/);
  assert.match(homepage, /scrolling="no"/);
  assert.match(memberBrawlDialog, /member-brawl\.html\?v=20260729-production-trim-v62/);
  assert.match(memberBrawlPage, /\.brawl-section[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0;/);
  assert.match(memberBrawlPage, /\.member-brawl-terminal[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%/);
  assert.match(buildScript, /"member-brawl\.html"/);

  const expectedHashes = new Map([
    ["assets/fleet-command-brawl.js", "a7a88d8a42b1c6412238f0a5581e9cb9b3a91c65e930bbee33425d7bdc5af793"],
    ["assets/fleet-command.css", "96c55b6d0d8e5f196e44c310cbd0486c88f561bb6e854d0df2a18cffdcbd6a89"],
    ["assets/vendor/matter.min.js", "72d30be0f579eb02ce1e0b6f9d359a4f392e6837e5a26ba8be5dbee7f88e24ae"],
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
  assert.match(homepage, /<img\b[^>]*width="\d+"[^>]*height="\d+"/);
  assert.match(homepage, /<img\b[^>]*loading="lazy"/);

  const grid = homepage.match(/<div class="archive-grid" data-archive-grid[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  const photoNumbers = [...grid.matchAll(/<img src="\.\/assets\/gallery\/team-(\d+)\.(?:jpe?g|png)"/g)]
    .map((match) => Number(match[1]));

  await Promise.all(
    photoNumbers.map((number) =>
      access(
        new URL(
          `assets/gallery/optimized/team-${String(number).padStart(2, "0")}-1280.webp`,
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
