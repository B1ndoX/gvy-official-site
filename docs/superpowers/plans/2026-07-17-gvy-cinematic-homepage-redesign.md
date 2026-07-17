# GVY Cinematic Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-preview-only cinematic GVY homepage with clear 1080P hero media, single-video loading, reversible scroll storytelling, a real-photo archive, responsive fallbacks, and preserved compliance content.

**Architecture:** Keep the static HTML/CSS/JavaScript and EdgeOne `dist` build. Introduce focused ES modules for media selection, deferred loading, narrative timelines, archive interaction, and lifecycle cleanup; load GSAP and ScrollTrigger as local build artifacts. Use Node's built-in test runner for pure behavior and static-contract tests, followed by in-app browser verification of the rendered production build.

**Tech Stack:** Semantic HTML, CSS custom properties, vanilla ES modules, GSAP 3 + ScrollTrigger, IntersectionObserver, Node 22 test runner, FFmpeg/libx264, WebP, EdgeOne static build.

---

## File Map

- Modify `package.json`: add GSAP, tests, syntax checks, and combined verification scripts.
- Create `package-lock.json`: lock dependency versions.
- Modify `scripts/build-site.mjs`: copy GSAP browser bundles and the static site into `dist`.
- Replace `index.html`: semantic hero, signal, manifesto, operations, archive, recruitment, lightbox, and compliance footer.
- Create `assets/cinematic-homepage.css`: accepted design system and responsive layout.
- Create `assets/js/hero-video-controller.js`: persisted selection, poster state, and one-source playback.
- Create `assets/js/deferred-media.js`: one-time observer-based media source assignment.
- Create `assets/js/fleet-data.js`: operation and archive configuration.
- Create `assets/js/archive-lightbox.js`: dialog navigation, swipe, scroll lock, and focus restoration.
- Create `assets/js/cinematic-timelines.js`: desktop/mobile/reduced-motion GSAP timelines and cleanup.
- Create `assets/js/cinematic-homepage.js`: initialization and lifecycle orchestration.
- Create `tests/hero-video-controller.test.js`: selection and cache behavior.
- Create `tests/deferred-media.test.js`: one-time media assignment behavior.
- Create `tests/archive-lightbox.test.js`: wrap and swipe navigation behavior.
- Create `tests/homepage-contract.test.js`: HTML, compliance, source-loading, and CSS contract checks.
- Create `assets/hero-random/v2/*`: two new videos and two posters without overwriting old media.
- Create `assets/gallery/optimized/*`: responsive WebP derivatives while retaining JPEG originals.

### Task 1: Establish Test and Build Foundation

**Files:**
- Modify: `package.json`
- Create: `package-lock.json`
- Modify: `scripts/build-site.mjs`
- Create: `tests/homepage-contract.test.js`

- [ ] **Step 1: Write a failing build-contract test**

Create a Node test that reads `package.json` and asserts the presence of `test`, `check:js`, and `verify` scripts, and reads `scripts/build-site.mjs` to require GSAP and ScrollTrigger browser bundles to be copied into `dist/assets/vendor`.

```js
test("project exposes repeatable verification commands", () => {
  assert.equal(pkg.scripts.test, "node --test");
  assert.match(pkg.scripts.verify, /npm run test/);
  assert.match(pkg.scripts.verify, /npm run build/);
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `node --test tests/homepage-contract.test.js`  
Expected: FAIL because the new scripts and GSAP copy logic do not exist.

- [ ] **Step 3: Add dependencies and verification scripts**

Set scripts to:

```json
{
  "build": "node scripts/build-site.mjs",
  "test": "node --test",
  "check:js": "node --check assets/js/*.js && node --check scripts/build-site.mjs",
  "verify": "npm run test && npm run check:js && npm run build"
}
```

Add GSAP as a pinned runtime dependency and install it through npm to generate `package-lock.json`.

- [ ] **Step 4: Copy GSAP bundles during production build**

After copying `assets`, copy:

```js
await copyFile(resolve(root, "node_modules/gsap/dist/gsap.min.js"), resolve(output, "assets/vendor/gsap.min.js"));
await copyFile(resolve(root, "node_modules/gsap/dist/ScrollTrigger.min.js"), resolve(output, "assets/vendor/ScrollTrigger.min.js"));
```

- [ ] **Step 5: Run the test and build**

Run: `node --test tests/homepage-contract.test.js && npm run build`  
Expected: PASS and both GSAP files exist in `dist/assets/vendor`.

- [ ] **Step 6: Commit foundation changes**

```bash
git add package.json package-lock.json scripts/build-site.mjs tests/homepage-contract.test.js
git commit -m "build: add test and GSAP preview foundation"
```

### Task 2: Implement Test-Driven Hero Selection

**Files:**
- Create: `tests/hero-video-controller.test.js`
- Create: `assets/js/hero-video-controller.js`

- [ ] **Step 1: Write failing tests for cache selection**

Cover valid cached selection, expired selection, invalid cached indexes, deterministic random selection, and explicit expiration storage.

```js
test("uses the cached index while the seven-day record is valid", () => {
  const selection = resolveHeroSelection({
    record: { index: 1, expiresAt: 2000 },
    now: 1000,
    optionCount: 2,
    random: () => 0,
  });
  assert.deepEqual(selection, { index: 1, shouldPersist: false });
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/hero-video-controller.test.js`  
Expected: FAIL because the controller module does not exist.

- [ ] **Step 3: Implement pure selection helpers**

Export `resolveHeroSelection`, `readHeroRecord`, `writeHeroRecord`, and the seven-day TTL constant. Records use `{ index, expiresAt }`, reject non-integer indexes, and fall back safely when storage throws.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/hero-video-controller.test.js`  
Expected: all selection tests PASS.

- [ ] **Step 5: Write failing tests for media mapping**

Test that `getHeroMedia(index)` returns exactly one video and one matching poster and rejects unknown indexes.

- [ ] **Step 6: Implement the browser controller**

`initHeroVideo()` must:

- Select before assigning a media URL.
- Set the matching poster first.
- Set only one `video.src`.
- Never create a `<source>` element.
- Fade the video in only after playback starts.
- Keep the poster visible on error.
- Avoid assigning a video URL in reduced-motion mode.
- Return a cleanup function for listeners and timers.

- [ ] **Step 7: Run hero tests and commit**

Run: `node --test tests/hero-video-controller.test.js`  
Expected: PASS.

```bash
git add tests/hero-video-controller.test.js assets/js/hero-video-controller.js
git commit -m "feat: select and load one persisted hero video"
```

### Task 3: Produce New Hero Media and Posters

**Files:**
- Create: `assets/hero-random/v2/fleet-hero-01-1080p-v2.mp4`
- Create: `assets/hero-random/v2/fleet-hero-02-1080p-v2.mp4`
- Create: `assets/hero-random/v2/fleet-hero-01-poster-v2.webp`
- Create: `assets/hero-random/v2/fleet-hero-02-poster-v2.webp`
- Create: `tests/media-contract.test.js`

- [ ] **Step 1: Write failing media-contract tests**

Assert all four output paths exist. Use FFmpeg output to assert the MP4s are 1920x1080, H.264, yuv420p, 30fps, have no audio stream, and have durations matching their masters within 0.1 seconds.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/media-contract.test.js`  
Expected: FAIL because the new media does not exist.

- [ ] **Step 3: Render crop previews and inspect representative frames**

Use subject-aware crop filters for each master, inspecting opening, middle, and ending frames before final encoding. Hero 01 may use the approved moderate enlargement; neither file receives sharpening or AI processing.

- [ ] **Step 4: Encode both videos**

Use `libx264`, `preset slow`, starting at CRF 19, yuv420p, 30fps, no audio, and `+faststart`. Keep quality over arbitrary file-size targets.

- [ ] **Step 5: Extract matching WebP posters**

Extract clean, opening-adjacent frames from each master at 1920x1080 using the same crop geometry as its video.

- [ ] **Step 6: Inspect outputs with contact sheets and metadata**

Check sharpness, dark gradients, motion detail, subject cropping, frame rate, duration, codec, pixel format, audio absence, and file size.

- [ ] **Step 7: Verify GREEN and commit**

Run: `node --test tests/media-contract.test.js`  
Expected: PASS.

```bash
git add tests/media-contract.test.js assets/hero-random/v2
git commit -m "assets: add high-quality 1080p hero media"
```

### Task 4: Implement Deferred Media Loading

**Files:**
- Create: `tests/deferred-media.test.js`
- Create: `assets/js/deferred-media.js`

- [ ] **Step 1: Write failing pure-behavior tests**

Test source assignment exactly once, no assignment without `data-src`, poster preservation on failure, and initialized-state persistence.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/deferred-media.test.js`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement source assignment and observer initialization**

Export `assignDeferredSource(media)` and `initDeferredMedia({ rootMargin: "100% 0px" })`. The observer unobserves initialized targets and the initializer returns a disconnect cleanup.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test tests/deferred-media.test.js`  
Expected: PASS.

```bash
git add tests/deferred-media.test.js assets/js/deferred-media.js
git commit -m "feat: defer below-fold media requests"
```

### Task 5: Replace Homepage Structure and Lock the Design System

**Files:**
- Modify: `index.html`
- Create: `assets/cinematic-homepage.css`
- Modify: `tests/homepage-contract.test.js`
- Create: `assets/js/fleet-data.js`

- [ ] **Step 1: Add failing HTML contract tests**

Require exactly one hero video with no `src` or child `<source>`, the approved section order and headings, four operations, archive dialog controls using inline SVG, the QQ group, ICP link, and exact minimum disclaimer. Reject Matter.js, old orbit-gallery markup, the blue-grid archive planet, and direct lower-video `src` values.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/homepage-contract.test.js`  
Expected: FAIL against the old homepage.

- [ ] **Step 3: Replace semantic homepage HTML**

Build the approved sequence:

`hero → fleet signal → manifesto → operations → archive story → archive wall → recruitment → footer`.

Preserve the existing hero nav, primary title, motto, scroll indicator, and links. Use existing real gallery images and the current GVY logo. Remove active references to Matter.js, the old brawl, the card map, and orbit planet.

- [ ] **Step 4: Add centralized fleet data**

Export four operation records and featured archive records. Each operation contains `id`, `number`, `english`, `title`, `description`, `image`, and `position`.

- [ ] **Step 5: Implement the CSS design system**

Define tokens for deep-navy backgrounds, cool-white text, blue-gray secondary text, fleet amber, route blue, content width, type scale, spacing, radius, and easing. Implement open cinematic stages, image masks, signal rail, operations progress route, archive expansion, recruitment finale, focus states, and lightbox.

- [ ] **Step 6: Add responsive and reduced-motion CSS**

At phone widths, remove long pins, render operations vertically, keep archive images clear, ensure touch controls, and prevent horizontal overflow. Reduced motion keeps all content visible and static.

- [ ] **Step 7: Verify contracts and commit**

Run: `node --test tests/homepage-contract.test.js`  
Expected: PASS.

```bash
git add index.html assets/cinematic-homepage.css assets/js/fleet-data.js tests/homepage-contract.test.js
git commit -m "feat: rebuild homepage as a fleet voyage narrative"
```

### Task 6: Implement Archive Interaction Test-First

**Files:**
- Create: `tests/archive-lightbox.test.js`
- Create: `assets/js/archive-lightbox.js`

- [ ] **Step 1: Write failing navigation tests**

Test circular previous/next indexes, swipe threshold direction, no navigation below the swipe threshold, and restoration target retention.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/archive-lightbox.test.js`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure navigation helpers**

Export `wrapArchiveIndex(index, length)` and `getSwipeDirection(startX, endX, threshold)`.

- [ ] **Step 4: Implement accessible dialog behavior**

Support click, Enter/Space through native buttons, Escape, arrow keys, SVG previous/next buttons, backdrop close, touch swipe, body scroll lock, and focus restoration. Remove the dialog image source after closing.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test tests/archive-lightbox.test.js`  
Expected: PASS.

```bash
git add tests/archive-lightbox.test.js assets/js/archive-lightbox.js
git commit -m "feat: add accessible fleet archive lightbox"
```

### Task 7: Implement GSAP Scroll Narrative

**Files:**
- Create: `assets/js/cinematic-timelines.js`
- Create: `assets/js/cinematic-homepage.js`
- Modify: `tests/homepage-contract.test.js`

- [ ] **Step 1: Add failing lifecycle contract tests**

Require GSAP registration, one `gsap.matchMedia()` branch for desktop/mobile/reduced motion, timeline identifiers for all five stages, `scrub` without `toggleActions`, and exported cleanup.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/homepage-contract.test.js`  
Expected: FAIL because timeline modules do not exist.

- [ ] **Step 3: Implement desktop timelines top-to-bottom**

Register ScrollTrigger once. Build one top-level scrubbed timeline per pinned stage, animate children rather than pinned elements, use `ease: "none"` for scroll-linked transforms, and create triggers in document order.

- [ ] **Step 4: Implement mobile and reduced-motion branches**

Use `gsap.matchMedia()` to replace long pins with short reveal triggers on mobile. Reduced motion sets stable final states and does not create pinned timelines.

- [ ] **Step 5: Implement lifecycle orchestration**

Initialize hero, deferred media, timelines, and lightbox once. Return cleanup functions and handle `pagehide`. Refresh ScrollTrigger once after fonts and critical images settle.

- [ ] **Step 6: Verify contracts and commit**

Run: `npm run test && npm run check:js`  
Expected: PASS with no syntax errors.

```bash
git add assets/js/cinematic-timelines.js assets/js/cinematic-homepage.js tests/homepage-contract.test.js
git commit -m "feat: add reversible cinematic scroll timelines"
```

### Task 8: Optimize Real Fleet Images

**Files:**
- Create: `assets/gallery/optimized/*.webp`
- Modify: `index.html`
- Modify: `tests/homepage-contract.test.js`

- [ ] **Step 1: Add failing responsive-image contracts**

Require `picture`, WebP sources, explicit width and height, lazy loading below the first featured archive frame, and retained original JPEG fallback paths.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/homepage-contract.test.js`  
Expected: FAIL because optimized derivatives are missing.

- [ ] **Step 3: Generate derivatives from the existing originals**

Create 1280px and, where source resolution allows, 1920px WebP variants. Do not alter people, ships, color content, or original JPEGs.

- [ ] **Step 4: Wire responsive image markup**

Reserve correct ratios, use WebP sources and JPEG fallbacks, and keep the featured high-resolution sequence image-led.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/homepage-contract.test.js && npm run build`  
Expected: PASS.

```bash
git add assets/gallery/optimized index.html tests/homepage-contract.test.js
git commit -m "perf: add responsive fleet archive images"
```

### Task 9: Production Preview and Fidelity QA

**Files:**
- Create: `docs/qa/gvy-cinematic-fidelity-ledger.md`
- Modify implementation files only when a verified mismatch requires a fix.

- [ ] **Step 1: Run the full verification suite**

Run: `npm run verify`  
Expected: all tests, syntax checks, and production build PASS.

- [ ] **Step 2: Start a local production server**

Run: `python3 -m http.server 8001 --directory dist`  
Open: `http://127.0.0.1:8001/`.

- [ ] **Step 3: Verify hero requests with a fresh session**

Confirm one hero video element, one selected v2 URL, no request for the unselected hero, and no operations/archive video before the observer threshold. Refresh to confirm persistence and inject an expired record to confirm reselection.

- [ ] **Step 4: Verify desktop narrative**

At 2560x1440, 1920x1080, and laptop size, inspect every stage, fast down-scroll, fast up-scroll, reverse playback, pin exits, next-section continuity, typography, media crop, and footer.

- [ ] **Step 5: Verify mobile and accessibility**

At 430px, 390px, and 375px, inspect overflow, title wrapping, image obstruction, touch behavior, lightbox, buttons, no hover dependency, and reduced motion.

- [ ] **Step 6: Compare accepted spec and rendered screenshots**

Capture the implementation at representative desktop and mobile sizes. Use `view_image` on the approved visual references/contact sheets and the final screenshots in the same QA pass. Record at least five concrete comparison points in the fidelity ledger.

- [ ] **Step 7: Verify links, compliance, and performance**

Check RSI, blueprint, ICP, navigation, disclaimer, console, media loading, image loading, CLS, and Lighthouse or an equivalent browser audit.

- [ ] **Step 8: Fix every actionable mismatch and rerun verification**

Repeat tests and browser inspection until no material mismatch, console error, media race, overflow, clipped content, or broken interaction remains.

- [ ] **Step 9: Commit QA evidence**

```bash
git add docs/qa/gvy-cinematic-fidelity-ledger.md
git commit -m "docs: record cinematic homepage preview QA"
```

The task stops after local preview and reporting. No merge, push, EdgeOne deployment, CDN purge, DNS change, or production replacement is allowed.
