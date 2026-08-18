# Navigation local-preview design QA

- Source visual truth: `/Users/bindox/Desktop/IMG_8447.PNG`
- Rendered implementation: `/Users/bindox/.codex/visualizations/2026/08/18/gvy-nav-preview/mobile-operations-blue-underline.png`
- Full comparison: `/Users/bindox/.codex/visualizations/2026/08/18/gvy-nav-preview/comparison-mobile-full.png`
- Focused navigation comparison: `/Users/bindox/.codex/visualizations/2026/08/18/gvy-nav-preview/comparison-mobile-nav-focused.png`
- Additional behavior evidence: `/Users/bindox/.codex/visualizations/2026/08/18/gvy-nav-preview/mobile-later-tools-horizontal-scroll.png`
- Desktop evidence: `/Users/bindox/.codex/visualizations/2026/08/18/gvy-nav-preview/desktop-blue-underline.png`
- Viewports: mobile `390 × 844` CSS px; desktop `1440 × 900` CSS px
- Density normalization: source `1170 × 2532` px was normalized from `3×` to `390 × 844`; implementation was captured at `390 × 844` px and device scale `1`. The focused source navigation crop `1170 × 192` was normalized to `390 × 64` and compared with the implementation's `390 × 64` header crop.
- State: `选择航向` active for the source/implementation comparison; `加入舰队` active for forward-follow and horizontal-scroll evidence.

## Full-view comparison evidence

The source and local implementation retain the same fleet header hierarchy, icon-and-caption navigation, transparent black navigation surface, and cyan active underline. The source includes mobile browser chrome while the implementation capture starts at the webpage viewport; this expected framing difference was excluded from navigation fidelity judgment. Differences in the operation media frame are scroll-timeline content state and are outside this navigation-only change.

## Focused navigation comparison evidence

The same-state focused crop shows no filled active tile, the cyan underline beneath `选择航向`, consistent icon scale, two-line captions, spacing, and header height. No actionable visual mismatch remains in the requested navigation region.

## Required fidelity surfaces

- Fonts and typography: existing GVY Sans/PingFang fallback, weights, line heights, tracking, and caption hierarchy remain unchanged.
- Spacing and layout rhythm: the original navigation padding and item gaps are preserved; the new overflow rules do not alter vertical header geometry.
- Colors and visual tokens: active state continues to use `--route-blue`; item background remains transparent.
- Image quality and asset fidelity: existing logo and Phosphor navigation assets are unchanged; no asset was recreated or replaced.
- Copy and content: all six existing navigation destinations and their captions are unchanged and remain in order.

## Interaction and responsive checks

- Active section changes from `选择航向` to `团建图册` to `加入舰队` and advances the mobile rail horizontally only when the active item needs to be revealed.
- Horizontal input changed the rail by `120px` while page vertical position changed by `0px`.
- Mobile rail computed styles: `touch-action: pan-x`, `overflow-y: hidden`.
- Manual horizontal movement reveals `加入舰队`, `蓝图查询`, and `维科洛查询` together.
- Desktop has no page-level horizontal overflow at `1440 × 900`.
- Browser console errors checked: none.
- Automated verification: final `npm run verify` passed after the visual-direction adjustment (103 site tests, JavaScript syntax check, site build, 28 publisher tests, and publisher build).

## Findings

- No actionable P0, P1, or P2 findings.

## Comparison history

- Initial local direction used a dark-blue active panel. The user changed the visual direction to the site's original cyan underline before handoff.
- The active panel was removed, the original underline behavior was restored, and the mobile forward-follow plus horizontal gesture lock were retained.
- Post-fix evidence is recorded in both comparison images above.

final result: passed
