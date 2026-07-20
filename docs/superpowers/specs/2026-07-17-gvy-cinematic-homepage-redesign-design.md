# GVY Cinematic Homepage Redesign

Date: 2026-07-17  
Status: Approved design, pending written-spec review  
Project: `gvy-official-site`

## 1. Objective

Upgrade the GVY official homepage into a continuous, cinematic fleet-voyage narrative while preserving its identity as a non-commercial Star Citizen player organization website.

The redesign must:

- Preserve the current hero's video-led composition, navigation, primary title, buttons, and deep-space tone.
- Replace the existing middle-page card, planet, and orbit-gallery structures with one continuous fleet story.
- Use scroll-linked, fully reversible motion inspired by the pacing principles of the Apple AirPods Pro page without copying its code, assets, typography, color system, copy, or product-page structure.
- Improve hero-video clarity and ensure only the selected hero video loads.
- Delay all below-the-fold video and image loading.
- Keep the production website available and unchanged until the user explicitly sends `允许部署正式网站`.

## 2. Safety and Deployment Boundary

Development is restricted to the local branch `gvy-cinematic-redesign-v1`.

Production baseline:

- Branch: `main`
- Commit: `d4c1cd6a9fc5575bc70cc4ad015f3fc39a869d08`
- Backup tag: `backup-before-gvy-cinematic-redesign`
- Backup directory: `/Users/bindox/Documents/Codex/Projects/starcitizen-crawler/local-backups/gvy-cinematic-redesign-v1-20260717-175941`

The implementation must not:

- Merge into or push to `main`.
- Push a production deployment.
- Change EdgeOne, DNS, HTTPS, CDN rules, cache invalidation, project topology, domains, or production environment variables.
- Overwrite or delete existing videos, images, pages, or build artifacts needed for rollback.
- Treat approval of the design, preview, or implementation as deployment authorization.

## 3. Existing Architecture and Chosen Approach

The current site is a static HTML/CSS/JavaScript project with a Node copy-based build that publishes `dist` through EdgeOne Pages.

The redesign will preserve this architecture and add GSAP with ScrollTrigger as the only full animation system. It will not migrate the site to React, Vite, or another framework.

Reasons:

- It preserves the proven EdgeOne build and static delivery model.
- ScrollTrigger provides precise pinned timelines, scrubbed progress, reversible playback, refresh handling, and reduced-motion control.
- It avoids maintaining a large custom scroll engine.
- It allows the middle-page experience to be decomposed into focused modules without a framework migration.

Matter.js and the existing member-brawl implementation will be removed from the active homepage once the new recruitment finale replaces it. Old source assets remain recoverable through Git history and the full backup.

## 4. Design System

### Color

- Primary background: near-black deep navy.
- Secondary background: slightly raised blue-black.
- Primary text: cool white.
- Secondary text: readable gray-blue.
- Fleet identification: restrained gold or amber.
- Navigation and coordinate lines: low-saturation blue.
- Overlays: neutral black and deep navy without saturated neon washes.

### Typography

- Chinese display text: system Chinese sans-serif stack with deliberate weight and line-height.
- Latin labels and telemetry: compact monospaced stack.
- Headings remain large enough for cinematic pacing and mobile readability.
- No decorative hero eyebrow or new above-the-fold copy is added beyond the existing accepted hero content.

### Layout

- One shared content-width token.
- Open cinematic stages instead of bordered card grids.
- Consistent page gutters and section transitions.
- Images use explicit aspect ratios and dimensions to prevent layout shift.
- Desktop stages may pin; mobile stages remain primarily document-flow content.

### Motion

- Primary motion uses transform, opacity, clip-path, masks, and restrained blur.
- Typical displacement: 10-40px.
- Typical scale: 0.94-1.05, with larger changes reserved for archive-image expansion.
- Text reveals use masking, small vertical movement, opacity, blur reduction, and line staggering.
- No wheel hijacking, global scroll locking, bouncing, rapid flight, flashing, exaggerated rotation, or persistent glow.
- Every scroll-linked timeline must play forward while scrolling down and reverse continuously while scrolling up.

## 5. Hero Video System

### Source Mapping

`fleet-hero-01` uses:

`/Users/bindox/Downloads/我的文档/IAE 2955 - Save the Date - Roberts Space Industries - Follow the development of Star Citizen and Squadron 42.mp4`

- 1920x860, 30fps, H.264 High, 37.30 seconds, approximately 41,764kbps, no audio.

`fleet-hero-02` uses:

`/Users/bindox/Downloads/我的文档/In Case You Missed It 2026 - Roberts Space Industries - Follow the development of Star Citizen and Squadron 42.mp4`

- 3440x1540, 30fps, H.264 High, 28.33 seconds, approximately 15,720kbps, no audio.

### Encoding

New files are added under `assets/hero-random/v2/`; old files are retained.

- `fleet-hero-01-1080p-v2.mp4`
- `fleet-hero-02-1080p-v2.mp4`
- `fleet-hero-01-poster-v2.webp`
- `fleet-hero-02-poster-v2.webp`

Video output requirements:

- 1920x1080 MP4.
- H.264 via `libx264`.
- yuv420p.
- 30fps, preserving the source cadence.
- No audio.
- `faststart` enabled.
- Initial test target: slow preset and CRF 19, adjusted only after objective image inspection.

Both sources use an approximately 96:43 ultrawide frame. Cropping must be reviewed against representative frames rather than applied mechanically.

- Hero 02 can be cropped from the 3440x1540 master and downscaled to 1920x1080.
- Hero 01 requires a moderate approximately 25.6% enlargement from its high-bitrate 1920x860 master before a subject-safe 16:9 crop. No sharpening, AI interpolation, AI redrawing, or synthetic detail is allowed.

Poster frames are extracted from the corresponding masters at points that visually connect to the opening playback and contain no black frames, controls, or watermarks added by the site.

### Selection and Loading

The existing seven-day persistence remains.

1. Read the stored selection before assigning any media URL.
2. Validate the saved index and timestamp.
3. Randomly select 01 or 02 only when the record is missing or expired.
4. Assign the matching poster immediately.
5. Create only one hero `video` element and assign only the selected `src`.
6. Do not include a fallback `<source src>` in HTML.
7. Crossfade from poster to video only after reliable `loadeddata`, `canplay`, and `playing` state.
8. Keep the poster visible if playback fails or stalls before the first frame.

With `prefers-reduced-motion`, the hero defaults to its selected poster and does not start the long autoplay presentation.

### Below-the-Fold Video Loading

Below-the-fold videos begin with no `src` and no `<source src>`.

- Store the URL in `data-src`.
- Use one IntersectionObserver with approximately one viewport of root margin.
- Assign `src` once when the relevant stage approaches.
- Mark the element as initialized to prevent repeated assignments or downloads.
- Pause when appropriate but do not destroy and recreate the element while scrolling.

## 6. Narrative Structure

### 6.1 Existing Hero

The accepted hero remains the primary opening image. During the final part of its scroll range:

- Video scales up slightly and darkens.
- Existing title, motto, controls, and scroll indicator fade naturally.
- The background remains present long enough to connect into the fleet-signal stage.

### 6.2 Fleet Signal Access

Labels:

- `GVY FLEET NETWORK`
- `舰队信号已接入`

Sequence:

1. A small signal point appears at the center.
2. It extends horizontally into a navigation line.
3. The GVY emblem resolves from restrained blur.
4. The title reveals through a mask.
5. ORG/GVY, QQ group 691311516, and RECRUITING appear as one connected identity rail rather than separate cards.
6. The complete sequence reverses when scrolling upward.

### 6.3 Voyage Manifesto

Labels:

- `WHY WE VOYAGE`
- `因远航而集结`

This is a near-full-screen stage. Two large dark masks separate gradually to reveal the emblem, title, and approved manifesto. The background moves backward subtly while the text appears line by line through masks, small upward movement, and blur reduction.

There is no typewriter effect, card grid, split-column layout, or rapid entrance.

### 6.4 Fleet Operations

Labels:

- `FLEET OPERATIONS`
- `远航，从来不是一个人的故事`

One pinned visual stage presents four sequential operation states:

1. Combat and escort.
2. Industry and resources.
3. Logistics and transport.
4. Exploration and action.

Each state uses one shared data structure for number, English label, Chinese title, description, image, image position, and theme adjustment. Only the current state receives full emphasis. A narrow progress route at the edge identifies all four states without becoming a button grid.

At the end, the four routes converge on the GVY emblem and the line `不同的航线，同一个舰队。`

Only real existing Star Citizen and fleet assets may be used. Missing imagery is handled with space, coordinates, routes, typography, and existing media, never fake ships or generated replacements.

### 6.5 Fleet Archive

Labels:

- `FLEET ARCHIVE`
- `我们真实经历的远航`

The blue-grid planet and orbiting collage are removed.

The narrative begins with selected higher-resolution real fleet images, primarily from `team-13` through `team-18`:

- A central image begins at approximately 40% viewport width.
- Scroll expands it toward full width, reduces blur, removes radius, and narrows surrounding space.
- Its label and description appear only after the image is established.
- The image then enlarges slightly, dims, and recedes while the next image enters from depth or a mask.

After the featured sequence, all activity images form a regular archive wall with consistent ratios, gaps, radius, and brightness treatment.

The lightbox supports:

- Click or keyboard opening.
- Escape to close.
- Previous and next controls using proper SVG icons.
- Arrow-key navigation.
- Touch swipe on mobile.
- Background scroll lock while open.
- Focus restoration to the invoking thumbnail.

Original JPEG files remain untouched. Derived WebP or AVIF display assets use explicit dimensions and responsive source sets.

### 6.6 Recruitment Finale

Labels:

- `THE NEXT VOYAGE`
- `下一段航程，期待你的加入`

Featured archive imagery contracts into distant lights or coordinates. A deep-space view returns, followed by the title, supporting copy, QQ group 691311516, and the `加入星际远航者` action.

The button reveals through its outline, restrained background fill, and text clarity. The section transitions directly into the compliance footer.

## 7. Component and File Boundaries

The static page remains semantic HTML. JavaScript behavior is split by responsibility rather than placed in one page script.

Planned units:

- Hero video controller: selection, persistence, poster, playback states, and fallback.
- Deferred media controller: one-time IntersectionObserver source assignment.
- Scroll narrative controller: GSAP registration, media-query branches, timeline lifecycle, and refresh.
- Fleet signal timeline.
- Voyage manifesto timeline.
- Fleet operations timeline and data.
- Archive story timeline, gallery data, and lightbox.
- Recruitment finale timeline.
- Shared motion and design-token configuration.

Each initializer returns or records cleanup for timelines, ScrollTriggers, observers, event listeners, requestAnimationFrame callbacks, and timers. Initialization is idempotent to prevent duplicate registration.

## 8. Mobile and Accessibility

Desktop breakpoint behavior uses pinned stages where the visual transformation requires time.

At tablet and phone widths:

- Signal access is shortened to approximately one viewport.
- Manifesto masks use a shorter reveal.
- Fleet operations become four large vertical image-led blocks.
- Archive becomes a vertical single-image story followed by a swipe-capable gallery.
- Long pinning, heavy blur, large parallax, and simultaneous animation counts are reduced.
- No interaction depends on hover.
- Controls meet touch-size and keyboard-focus requirements.
- Horizontal overflow is prohibited at 430px, 390px, and 375px.

Reduced-motion mode preserves the complete content hierarchy with static posters and short fades, without pinned scroll timelines or parallax.

## 9. Compliance Footer

The footer must retain:

- `陕ICP备2026017597号-1`
- The existing MIIT query link.
- Any public-security filing details if they are later found in an authoritative existing source.

The disclaimer must state at minimum:

`本站为玩家自建非商业资料展示站，非 Star Citizen 官方网站，不提供游戏下载、充值、账号交易、虚拟物品交易或游戏运营服务。Star Citizen及相关名称、商标、图像和素材归其权利方所有。`

No commerce, payments, account trading, virtual-item trading, paid membership, game download, private server, open forum, or uncontrolled upload feature is introduced.

## 10. Error Handling

- Storage failures fall back to a session selection without blocking playback.
- Invalid cached indexes or timestamps are ignored.
- Hero media failure leaves the matching poster visible.
- Deferred media failure leaves a static poster or background without repeated retries.
- Missing archive derivatives fall back to the retained original image and expose an accessible status only if both fail.
- GSAP or ScrollTrigger initialization failure leaves all content visible in normal document flow.
- Lightbox image failure preserves controls and provides a readable failure state.

## 11. Performance Requirements

- Initial Media requests contain only the selected hero video when motion is enabled.
- The unselected hero video produces no request.
- Operations and archive videos produce no request before their observer threshold.
- Images below the hero are lazy-loaded and use WebP or AVIF derivatives.
- All imagery reserves layout space.
- Scroll-linked writes use GSAP transforms or opacity rather than layout-triggering properties.
- Filters are limited on mobile.
- No persistent requestAnimationFrame loop runs for an off-screen section.
- No duplicate listeners, timelines, observers, video elements, or source assignments are permitted.

## 12. Verification

Implementation verification will include:

- JavaScript syntax and configured static checks.
- Build.
- Local production preview from `dist`.
- Desktop viewports: 2560x1440, 1920x1080, and a common laptop size.
- Tablet and phone viewports: 430px, 390px, and 375px.
- Chrome and available Safari/Edge coverage.
- Console warning and error inspection.
- Fresh-cache media-request inspection.
- Seven-day persistence and forced-expiry checks.
- Poster-to-video transition and media-failure checks.
- Fast down-scroll, fast up-scroll, reverse playback, pin exit, and layout-jump checks.
- Reduced-motion behavior.
- Archive lightbox click, keyboard, Escape, arrows, touch swipe, focus restoration, and scroll locking.
- Footer, ICP link, disclaimer, and site-link verification.
- Lighthouse or equivalent performance review.

The first implementation checkpoint is the repaired hero-video production preview and Network audit. The middle-page redesign begins only after that checkpoint passes locally.

## 13. Delivery Boundary

The completed work stops at a local preview and report. The report will include commits, files, dependencies, media parameters, comparison images, Network evidence, responsive behavior, test results, known limitations, written deployment steps, and rollback instructions.

No production deployment will be executed without the exact authorization phrase `允许部署正式网站`.
