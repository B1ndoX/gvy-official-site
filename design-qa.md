# Mobile six-up navigation local-preview design QA

- Source visual truth: `/Users/bindox/Desktop/IMG_8448.PNG`
- Rendered implementation: `/Users/bindox/.codex/visualizations/2026/08/19/gvy-mobile-six-up-preview/mobile-390-recruit-nav-final-r2.png`
- Full comparison: `/Users/bindox/.codex/visualizations/2026/08/19/gvy-mobile-six-up-preview/full-before-after.png`
- Focused navigation comparison: `/Users/bindox/.codex/visualizations/2026/08/19/gvy-mobile-six-up-preview/nav-before-after.png`
- Viewport: mobile `390 × 844` CSS px; additional responsive checks at `320 × 720`, `430 × 932`, and desktop `1440 × 900`.
- Density normalization: source `1170 × 2532` px is a `3×` capture normalized to `390 × 844`; implementation is `390 × 844` at device scale `1`. The focused comparison uses the source webpage crop beginning below its 91px normalized browser chrome and the implementation's 106px navigation region.
- State: `加入舰队` active in the final mobile implementation; the source also shows the recruit section.

## Full-view comparison evidence

The existing fleet identity, black translucent navigation surface, cyan active rule, recruit imagery, typography, buttons, and copy remain visually consistent. The source contains 91 CSS px of mobile browser chrome that is not part of the website; the implementation capture begins at the website viewport. The requested intentional change is confined to the website header: the fleet brand occupies a compact first row and all six destinations occupy one equal-width second row.

## Focused navigation comparison evidence

The combined header crop confirms that all six items—舰队定位、选择航向、团建图册、加入舰队、蓝图查询、维科洛查询—are simultaneously visible at 390px. The existing Phosphor icons and cyan active underline are preserved. Mobile captions are intentionally hidden to keep labels readable without horizontal scrolling; this is the approved compact direction, not fidelity drift.

## Required fidelity surfaces

- Fonts and typography: existing site fonts and weights are retained. Mobile primary labels render at 9.165px at 390px and 8px at 320px; all titles remain on one line without truncation.
- Spacing and layout rhythm: mobile header is `106px` high with a 50px brand row and 56px navigation row. Six equal columns measure about 64px each at 390px and 52px each at 320px; every touch target remains 55px high.
- Colors and visual tokens: black navigation surface and `--route-blue` active underline are unchanged; no filled active tile was introduced.
- Image quality and asset fidelity: the supplied GVY logo and existing local Phosphor navigation assets are reused unchanged; no placeholder or replacement asset was created.
- Copy and content: all six destinations retain their original titles, order, hrefs, and desktop captions. Only mobile captions are visually hidden.

## Interaction and responsive checks

- Clicking `团建图册` at 430px navigates to `#archive` and updates the active underline.
- At 320px and 430px, all six navigation items are inside the viewport and `scrollWidth === clientWidth`.
- At 1440px, the original one-row desktop navigation remains `75px` high and all six captions remain visible.
- Page-level horizontal overflow: none at all tested widths.
- Browser console warning/error check: none.
- Automated verification: full `npm run verify` passed with 103 site tests, JavaScript syntax checks, production build, 28 publisher tests, and publisher build. A final site-only retest also passed 103/103 after the 320px font floor adjustment.

## Findings

- No actionable P0, P1, or P2 findings.

## Comparison history

- Initial compact pass fit six items at all target widths. The 320px override rendered labels at 7.68px, recorded as a readability polish issue.
- The minimum 320px label size was raised to 8px without changing column fit or creating overflow.
- Post-fix evidence confirms all six items remain visible and interactive.

final result: passed
