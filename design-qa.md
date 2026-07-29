# GVY 相册苹果节点交互 v64 Design QA

- Reference: [Apple homepage](https://www.apple.com/) and its official `endless-entertainment-gallery.built.js` runtime.
- User source screenshot: `/var/folders/rd/5vqxbv0522j_08nn62qj_bhr0000gn/T/TemporaryItems/NSIRD_screencaptureui_nMC89o/截屏2026-07-29 22.35.03.png`
- Implementation URL: `http://127.0.0.1:4179/preview/`
- Apple live-state screenshot: `/tmp/apple-gallery-click-v64.png` (`1030 × 720`)
- GVY desktop screenshot: `/tmp/gvy-gallery-apple-behavior-v64.png` (`1030 × 720`)
- GVY mobile screenshot: `/tmp/gvy-gallery-mobile-v64.png` (`390 × 844`)
- Same-viewport side-by-side comparison: `/tmp/apple-gvy-gallery-comparison-v64.png`

## Selected behavior

- Every deployed photo keeps one exact navigation node. Clicking a node jumps to that exact photo.
- The current node expands from a circle into a pill and surrounding nodes shift naturally.
- The node window is bounded and internally scrollable. Desktop exposes about seven positions and the 390px layout exposes about five without shrinking the markers.
- Per the user's explicit correction, the active pill is **not centered**. If it is already visible, the node window does not move. If it crosses an edge, the window moves only far enough to reveal it with a 12px inset.
- Hovering the node window suspends automatic gallery movement. Leaving it resumes only the automatic mode; it does not overwrite the user's manual pause state.

## Visual comparison

The Apple and GVY screenshots use the same browser raster. Both show a bounded rounded node surface, fixed circular markers, one elongated current marker, and a separate circular playback control. GVY preserves its existing dark visual tokens, larger playback glyph, border/focus treatment, gallery geometry, and real fleet photos.

No `NEW`/“最新” copy, photo numbering, count label, scrubber, page-width expansion, or new graphic asset was introduced.

## Interaction evidence

- 38 deployed photos produced 38 exact node buttons.
- Clicking node 1 produced gallery `scrollLeft 0`, active node 1, and node-window `scrollLeft 0`.
- Clicking visible node 4 produced gallery `scrollLeft 1132`, active node 4, while node-window `scrollLeft` remained `0`. This directly proves that the active pill is not forced to center.
- Clicking edge node 8 produced node-window `scrollLeft 34`; the calculated center position was `122`. The implementation therefore used the required minimal edge reveal.
- Active node width remained `54px`; inactive node width remained `30px`. Neighbor offsets changed with the active pill.
- A real gallery drag moved `scrollLeft 2641 → 2821` without opening the lightbox.
- A short click still opened the optimized `team-09-1280.webp` lightbox.
- A real node-window drag moved its `scrollLeft 34 → 144` without changing active photo 8, gallery position, or dialog state.
- The manual pause button reported `aria-pressed="true"` and retained the paused state during exact-node navigation.
- `shouldAdvanceCarousel` is covered for automatic, manual-pause, direct-touch, page-scroll, visibility, hidden-page, and node-hover states. The in-app browser's coordinate mouse backend did not expose CSS `:hover`, so the native hover transition could not be visually sampled there; the runtime listener wiring and advance gate are covered by source-contract and unit tests.

## Responsive evidence

At `390 × 844`, the node surface measured `220 × 50px`, the inner window measured `218px`, all 38 nodes remained present, active/inactive widths stayed `54/30px`, and document overflow was `0`. The node control did not collapse into tiny dots or expand with the photo count.

## Verification

- `git diff --check`: passed.
- Focused carousel and homepage-contract tests: 37/37 passed.
- `npm run verify`: 115/115 tests passed; 27 JavaScript files passed syntax checks; production site and gallery publisher builds completed.
- The formal comparison found no actionable P0/P1/P2 visual mismatch.

## Findings

- No actionable P0/P1/P2 findings.

## Final result

final result: passed
