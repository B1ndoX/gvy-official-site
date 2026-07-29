# GVY 相册苹果风格控制器 Design QA

- Source visual truth: `/var/folders/rd/5vqxbv0522j_08nn62qj_bhr0000gn/T/TemporaryItems/NSIRD_screencaptureui_yhQuB7/截屏2026-07-29 22.03.48.png`
- Source pixels: `790 × 288`
- Implementation URL: `http://127.0.0.1:4179/preview/`
- Implementation screenshot: `/tmp/gvy-gallery-dots-v63-enlarged-play.png`
- Implementation raster: `1030 × 720`; DOM viewport reported `1280 × 720`
- Focused comparison: `/tmp/gvy-gallery-dots-v63-comparison-final.png`
- Normalization: the saved `700 × 180` reference crop and a `540 × 140` implementation control crop were each normalized to `700 × 180`, then placed side by side in one `1400 × 180` comparison image.
- State: every photo has an exact navigation node inside a fixed-width horizontal window; one elongated active indicator is visible and automatically centered as the album advances. Autoplay is running, so the independent circular control shows pause. The reference shows fewer photos and the paused/play state; these are data-driven states, not structural differences.

## Full-view comparison evidence

The implementation screenshot shows the control centered below the gallery with the existing GVY dark visual system intact. There is no `NEW` or “最新” text, no numeric position, no scrubber, no clipping, and no horizontal page overflow.

## Focused comparison evidence

The combined focused image shows the same visual grammar as the reference: one rounded navigation surface, evenly spaced nodes, one elongated current indicator, and a separate circular play/pause control. The implementation intentionally uses the website's dark translucent palette instead of copying the reference's white page background. Unlike the first segmented draft, the final control contains one exact node per photo inside a bounded, horizontally scrollable viewport.

## Required fidelity surfaces

- Fonts and typography: passed. The requested replacement contains no visible text; aria labels remain available to assistive technology.
- Spacing and layout rhythm: passed. The node surface and playback circle are separate, vertically aligned, and keep a stable gap. The node window scales from `220px` to `340px` with the page while every inactive marker remains `9px` and the active marker remains `42px`. More photos increase only the hidden scrollable content, never the visible control width.
- Colors and visual tokens: passed. The component uses the existing GVY neutral foreground, translucent dark surfaces, subtle borders, and route-blue focus indication. The dark adaptation is intentional and preserves the reference hierarchy.
- Image quality and asset fidelity: passed. No new raster asset was required. Existing project play/pause SVG icons are preserved; gallery images and their rendering were not modified.
- Copy and content: passed. Visible `NEW` and “最新” copy are removed. The publisher's internal latest-batch attribute remains non-visible and does not affect this control.

## Interaction and runtime evidence

- All 38 deployed photos rendered one-to-one navigation buttons. Clicking photo node 20 selected photo 20 exactly (`scrollLeft 7184.5`) and did not open the lightbox. After scrolling the node window, clicking node 35 selected photo 35 exactly (`scrollLeft 12844.5`) and did not open the lightbox.
- A real pointer drag moved the bounded node window from `scrollLeft 665.5` to `845.5` without changing the selected photo or opening the lightbox.
- Pause held the final gallery at `scrollLeft 40` for 500ms; resume advanced it to `76` after another 500ms.
- A real drag moved `scrollLeft` from `546` to `816` without opening the lightbox.
- A subsequent short click opened the responsive `team-48-1920.webp` lightbox.
- Browser warning/error log was empty. Full-page 0/25/50/75/100% checks found no video errors or horizontal overflow. The publisher preview's root-relative public-security icon remains its documented local-only 404; the formal site is unaffected.
- The playback button remains `50 × 50px`; the pause SVG now renders at `27.6 × 27.6px` and the play SVG at `32.4 × 32.4px`.
- `npm run verify` passed 114 tests, 27 JavaScript checks, the production site build, and the gallery publisher build.

## Comparison history

- Initial focused capture showed the correct component geometry. Automated button interaction also displayed the intentional route-blue `:focus-visible` ring; a clean reload capture was used for the default-state comparison so the accessibility state was not mistaken for baseline styling.
- The first comparison found no P0/P1/P2 visual mismatch. User review then identified a functional P1: six segment nodes could not select every photo precisely. The control was revised to one node per photo inside a fixed-width scrollable viewport.
- User review of the revised control identified undersized playback glyphs. The outer `50px` button stayed unchanged while both SVG render sizes were increased. The final side-by-side comparison confirms the larger play icon retains the reference hierarchy without crowding the circular surface.

## Findings

- No actionable P0/P1/P2 findings.

## Remaining test gap

- The in-app browser surface did not expose viewport resizing in this session. Narrow-screen behavior is enforced by the `220px` minimum window, `calc(100vw - 100px)` maximum, fixed node dimensions, and no-wrap overflow strip, but there is no fresh 390px visual screenshot in this report.

## Final result

final result: passed
