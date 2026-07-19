# GVY Cinematic Homepage Preview QA Ledger

Date: 2026-07-17  
Branch: `gvy-cinematic-redesign-v1`  
Scope: local production preview only  
Production deployment: not performed

## Safety boundary

- Production remains on `main` at `d4c1cd6a9fc5575bc70cc4ad015f3fc39a869d08`.
- Backup tag remains `backup-before-gvy-cinematic-redesign`.
- Full backup remains at `/Users/bindox/Documents/Codex/Projects/starcitizen-crawler/local-backups/gvy-cinematic-redesign-v1-20260717-175941`.
- No merge, push, EdgeOne operation, DNS change, CDN purge, environment change, or production-file replacement was performed.

## Automated verification

`npm run verify` passed:

- 31 Node tests passed.
- JavaScript syntax checks passed for 8 files.
- The production copy build completed successfully.
- `git diff --check` passed.

Covered contracts include persisted hero selection, expired cache handling, exactly one assigned hero source, reduced-motion poster behavior, one-time deferred media assignment, media metadata, semantic section order, compliance copy, responsive imagery, archive index wrapping, swipe direction, dialog focus restoration, GSAP lifecycle, cleanup, and responsive/reduced-motion CSS.

## Media loading verification

Fresh local production-preview session at the top of the page:

- Hero video elements: 1.
- Selected hero: `fleet-hero-01-1080p-v2.mp4` during the recorded session.
- Hero state reached `playing`.
- Unselected hero produced no local-server request.
- Operations and archive videos initially had no `src`, no `currentSrc`, and no initialized marker.
- The operations video received its `src` only when the operations stage entered the one-viewport observer margin.
- The archive video remained source-free until its own observer threshold.
- Refresh preserved hero selection `01` through the seven-day record.
- Expired and invalid selection records are covered by deterministic automated tests.

Both new hero videos passed the media contract: 1920×1080, H.264 High, yuv420p, square pixels, 30fps, no audio, duration matched to the corresponding master, and matching 1920×1080 WebP posters.

## Browser and responsive verification

Tested successfully:

- Chrome / Chromium local production preview.
- Safari local production preview, including hero playback, operations anchor, pinned combat stage, and reverse scroll back to the operations heading.
- Desktop viewports: 2560×1440, 1920×1080, and 1280×720.
- Mobile viewports: 430×932, 390×844, and 375×812.
- No horizontal overflow at any tested viewport.
- Desktop scroll-linked stages moved forward and reversed without wheel hijacking.
- Mobile operations rendered as four normal-flow image-led sections with all four copy blocks visible.
- Archive dialog opened from keyboard-capable native buttons, advanced to the next record, closed, removed its image source, unlocked body scrolling, and restored focus to its invoking button.
- Mobile lightbox controls remained within the viewport and measured at least 42×42px.
- Console errors and warnings: none in the in-app browser session.

Microsoft Edge was not installed on this Mac, so an Edge pass was not claimed. The Chromium engine pass covers the primary engine behavior, but a real Edge smoke test remains a pre-deployment check.

## Lighthouse

Local production build, Lighthouse 12.8.2, mobile profile:

- Performance: 95
- Accessibility: 100
- Best Practices: 100
- SEO: 100
- First Contentful Paint: 1.1s
- Largest Contentful Paint: 2.9s
- Total Blocking Time: 90ms
- Cumulative Layout Shift: 0
- Speed Index: 2.0s
- Initial audit transfer: 14,774 KiB across 18 requests

The second audit improved legible text coverage to 100%, removed accessible-name mismatches, eliminated the mobile operation JPEG background requests, and raised the performance score from 90 to 95.

## Fidelity comparison

Comparison used the approved hero-master contact sheets, the complete real-gallery contact sheet, and final rendered desktop/mobile captures.

1. The hero remains video-led and retains the accepted title, motto, navigation, deep-space palette, and asymmetrical text composition.
2. The 16:9 hero crop preserves recognizable ships and environments across the reviewed opening, middle, and ending frames without stretching, AI reconstruction, or sharpening.
3. The middle page now reads as one voyage rather than a card dashboard: signal access, manifesto, operations, archive, and recruitment share one dark spatial rhythm.
4. Operations use existing fleet captures only; the visual changes slowly inside one desktop sticky stage and becomes four full vertical records on mobile.
5. The archive replaces the old orbiting planet wall with large editorial imagery followed by a regular 18-image index; every image derives from an existing real fleet screenshot.
6. The fleet-blue labels and restrained amber details remain subordinate to cool-white Chinese display typography, matching the approved deep-navy direction without copying Apple's visual identity.
7. Desktop and mobile renders preserve clear text-image separation; mobile title, motto, signal rail, archive copy, and lightbox controls remain unobstructed.

Preview evidence:

- `/Users/bindox/.codex/visualizations/2026/07/17/019f6f78-7c09-7c73-8d1f-9f80707c4453/final-preview/desktop-1920x1080.png`
- `/Users/bindox/.codex/visualizations/2026/07/17/019f6f78-7c09-7c73-8d1f-9f80707c4453/final-preview/mobile-390x844.png`
- `/Users/bindox/.codex/visualizations/2026/07/17/019f6f78-7c09-7c73-8d1f-9f80707c4453/final-preview/operations-browser-crop.png`
- `/Users/bindox/.codex/visualizations/2026/07/17/019f6f78-7c09-7c73-8d1f-9f80707c4453/final-preview/archive-browser-crop.png`
- `/Users/bindox/.codex/visualizations/2026/07/19/gvy-hero-clarity-audit/hero-performance-v4-desktop.png`
- `/Users/bindox/.codex/visualizations/2026/07/19/gvy-hero-clarity-audit/hero-performance-v4-mobile.png`

## Known pre-deployment blockers

- The active adaptive hero files are `fleet-hero-02-1080p-v4.mp4` (about 18.3 MB) and `fleet-hero-02-1440p-v4.mp4` (about 25.7 MB). Both remain below 25 MiB, and the build excludes inactive oversized hero archives while preserving them in source control.
- Hero 01 remains inactive because its official 1920×860 master cannot produce a true 16:9 high-resolution output without enlargement.
- A real Microsoft Edge smoke test is still required because Edge is not installed on this machine.

## Local preview

Build and serve without touching production:

```sh
npm run verify
python3 -m http.server 8001 --directory dist
```

Open `http://127.0.0.1:8001/`.
