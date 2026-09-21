# Reader, explorer, and 3D verification

**Date:** 2026-09-21  
**Worktree:** `/home/megabyte/Work/zcash/zip-tools/.worktrees/feat-reader-explorer-3d`  
**Branch/base:** `feat/reader-explorer-3d` / `1e671aa50d8c1ce747988dc62262c408b89a62f8`  
**Target:** production Next.js build at `http://127.0.0.1:3100`  
**Outcome:** **DONE_WITH_CONCERNS** — unit and build gates pass; production E2E acceptance is red on documented product defects.

## Executive summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 1 |
| Medium | 3 |
| Low | 1 |
| **Total** | **5** |

The app renders real WebGL 3D nodes and edges and the core reader/explorer routes work. The production Playwright suite finished with **34 passed, 4 failed, 2 skipped**. The custom acceptance suite's final run finished with **3 passed, 3 failed**. Failures are preserved rather than weakened.

## Issues

### 1. ZIP 317 equation creates document-level horizontal overflow

- **Severity/category:** High — Functional / Visual / Accessibility
- **Route:** `/zip/317`
- **Observed:** At the 1280 CSS-pixel browser viewport, `documentElement.scrollWidth` is 1293 while `clientWidth` is 1265. The widest MathML expression is 1124.44 px and extends to x=1436.23. Its piecewise formula is hidden under the metadata rail and cut at the viewport edge; no contained horizontal-scroll affordance is visible.
- **Impact:** The exact technical definition cannot be read normally.
- **Repro:** Open `/zip/317`; navigate to “Recommended algorithm for block template construction”; inspect the `unpaid_actions(tx)` formula.
- **Evidence:** `docs/superpowers/reports/2026-09-21-reader-explorer-3d-screenshots/issue-zip317-overflow-1280.png`
- **Code-confirmed owner:** reader styling / prepared technical markup, principally `packages/web/components/ReaderBody.module.css` and reader layout containment. The rendered MathML has visible overflow and no containing scroll boundary.

### 2. Skip link changes the hash but does not move focus to main

- **Severity/category:** Medium — Accessibility
- **Routes:** sampled on `/zip/48`
- **Observed:** Keyboard Tab correctly focuses “Skip to content”; Enter leaves `document.activeElement` on `BODY`, not `main#main-content`. The target has no `tabindex`.
- **Expected:** Skip-link activation moves keyboard focus to the main content target.
- **Code-confirmed owner:** shared layout/header skip-link target (`packages/web/app/layout.tsx` and associated navigation styles).

### 3. Explorer back history can skip the filtered results entry

- **Severity/category:** Medium — Functional / UX
- **Repro:** In one browser session, visit a reader, then `/zips?q=317&kind=numbered`, open revision details, immediately open “Proportional Transfer Fee Mechanism,” and invoke Back.
- **Observed:** Back returned to the earlier `/zip/312` history entry instead of filtered explorer results. The focused acceptance assertion expected `/zips?q=317&kind=numbered` and failed consistently in the combined reader flow. The isolated existing explorer history test passed, so the defect is sequence-dependent.
- **Owner:** `packages/web/components/ZipExplorer.tsx` URL synchronization/history replacement behavior and reader transition integration.

### 4. Optional generated-summary request emits a production console error

- **Severity/category:** Medium — Console / UX
- **Routes:** reader routes, including `/zip/48` and `/zip/32`
- **Observed console error:** `Failed to load resource: the server responded with a status of 503 (Service Unavailable)`.
- **Behavior:** Reading remains available (fail-open), but routine production browsing does not have a clean console when optional AI bindings are absent.
- **Owner:** `packages/web/components/GeneratedSummary.tsx` and `/api/summary/[id]` unavailable-binding response handling.
- **Note:** The missing-ZIP document's expected 404 was recorded but excluded from the unexpected-console assertion.

### 5. Graph data is real but difficult to read at its initial fit

- **Severity/category:** Low — Visual / Accessibility
- **Routes:** `/` and `/graph`; all three required widths
- **Observed:** Real node and citation-edge pixels are visible and interactive, but the initial fit leaves large empty areas while compressing the main cluster. Many edges and the darkest nodes/legend swatches are nearly indistinguishable from the background. No visible labels are shown until interaction.
- **Measured/automated evidence:** body and article text pass the custom WCAG-AA contrast assertion (>= 4.5:1); the issue is graph-mark contrast and initial fit, confirmed in all graph captures by visual inspection.
- **Owner:** `packages/web/components/ForceGraph3D.tsx`, `ForceGraph3D.module.css`, and graph status colors.

## Required route and behavior matrix

| Area | Routes / evidence | Result |
|---|---|---|
| Required pages | `/`, `/zips`, `/zips?kind=draft`, `/graph`, `/zip/32`, `/zip/312`, `/zip/317`, `/zip/48`, `/draft/draft-arya-dairaemma-disable-addition-of-transparent-chain-value`, `/nu/nu6.3`, `/list`, `/zip/999999` | Rendered; missing ZIP returns 404 and “No ZIP matches.” ZIP 317 overflow is blocking. |
| Generated-index selection | Markdown: ZIP 48; draft: `draft-arya-dairaemma-disable-addition-of-transparent-chain-value`; NU: `nu6.3` | Selected by parsing `packages/web/data/zip-index.json`, not guessed. |
| Reader prose/TOC | ZIP 48 and ZIP 312 | Nonempty in-app body; TOC href/heading IDs match; hash history passed existing suite. |
| Sources/citations | ZIP 48 | GitHub URL pinned to 40-character snapshot SHA; in-app `/zip/...` citation found. |
| Dates/revisions | ZIP 312, ZIP 317 | `2022-08-dd` preserved; ZIP 317 revision detail text rendered. |
| Adjacent/bookmark | ZIP 48 | Previous/next present; bookmark persists reload. |
| RST degraded mode | ZIP 32/312/317 | Explicit “Limited conversion. pandoc not found” label present. Build environment did not exercise full-converter output. Fallback remains readable but exposes RST citation syntax such as `[#FROST]_` and source editorial text; this is a content-fidelity concern, not claimed full conversion. |
| Explorer | `/zips`, draft filter | Counts, filters, sorting, owner search, empty-state clearing, mobile table semantics pass existing tests. Sequence-dependent Back failure remains. |
| Real 3D | `/`, `/graph` | Live non-lost WebGL context, non-uniform node pixels, node/citation counts, camera pixel changes, rotate, zoom, reset, focus/no-match, NU filter, assigned-node canvas navigation, context loss, retry, initialization failure, and empty state exercised. Five repeated focused graph runs passed. |
| Mobile graph | `/` at 390 | Inactive graph allows page scrolling. Existing production graph suite passes Activate → Escape/deactivate. |
| Expanded graph | `/graph` at 390/768/1440 | Canvas and accessible-node disclosure fit without document overflow. |
| Keyboard/zoom | ZIP 48 and required top-level pages | Header/search keyboard tests pass; visible focus assertion passes after ordinary Tab. Skip-link target focus fails. Effective 200% checks used a 720×450 CSS viewport and passed `/`, `/zips`, `/zip/48`, `/graph` overflow assertions. |
| Code/table containment | ZIP 32 | Sampled `pre`/table surfaces; any content wider than its box had `overflow-x: auto|scroll`. ZIP 317 MathML is not contained. |

## Visual evidence

All 12 required captures were opened with visual analysis. One additional defect capture documents ZIP 317.

| Width | Home | Explorer | Reader | Graph |
|---:|---|---|---|---|
| 390 | `home-390.png` | `explorer-390.png` | `reader-390.png` | `graph-390.png` |
| 768 | `home-768.png` | `explorer-768.png` | `reader-768.png` | `graph-768.png` |
| 1440 | `home-1440.png` | `explorer-1440.png` | `reader-1440.png` | `graph-1440.png` |

Directory: `docs/superpowers/reports/2026-09-21-reader-explorer-3d-screenshots/`

Visual observations:

- Explorer layouts fit all three widths without page-level horizontal overflow; 390 stacks filters/cards and 768/1440 retain the table.
- Reader has a sound 65ch-class desktop measure; at 390/768 the raw metadata preamble visibly clips long email/URL strings inside its box, though the document itself stays contained. Metadata duplication pushes prose downward at 768/1440.
- Home's featured rail intentionally/visibly leaves a partial next card at 390 and 1440 without a strong scroll affordance. At 768/1440 the graph section is present but most actual canvas content starts below the initial 900px fold.
- Graph captures at every width visibly contain nodes and edges. Controls fit, but mouse-only help remains on the mobile layout, legend rows wrap, and edge/dark-node contrast is weak.
- Visual observations are separated from confirmed defects above; no implementation proposal was tested because Task 7 is evidence-only.

## Commands and gates

| Command | Exit/result |
|---|---|
| `pnpm run build` (before server) | 0; production build generated all required app routes. Warning: Next inferred workspace root due multiple lockfiles. |
| `pnpm --filter @zip-tools/web start --hostname 127.0.0.1 --port 3100` | Ready in 251 ms; intentionally terminated after browser work (exit 143). No use of port 3000. |
| `ZIP_TEST_BASE_URL=http://127.0.0.1:3100 pnpm --filter @zip-tools/web exec playwright test --workers=1` | 1; 34 passed, 4 failed, 2 skipped. Failures: ZIP 317 overflow, unexpected 503 console response, sequence-dependent Back state, skip-link focus; the custom mobile duplicate also failed in this complete run, while the existing production graph interaction test passed. |
| `ZIP_TEST_BASE_URL=http://127.0.0.1:3100 pnpm --filter @zip-tools/web exec playwright test tests/acceptance.spec.ts --workers=1` | 1; final focused run 3 passed, 3 failed. Failures preserved for overflow/503, combined-history Back behavior, skip-link focus/503. |
| `... playwright test tests/acceptance.spec.ts --grep 'real 3D graph supports' --repeat-each=5` | 0; 5/5 passed. |
| `pnpm run test` | 0; index 26/26 and web 114/114 passed (140 total). |
| `pnpm run build && git diff --check` | 0; build passed and diff check clean. |

## Blockers and handoff

- Acceptance is blocked by issues 1–4. Issue 1 is the release-significant blocker because required technical content is unreadable.
- Full-fidelity RST output was not testable because `pandoc` is absent. The explicitly degraded path was tested instead; full-converter cleanliness remains unverified.
- Suggested owner routing: reader/layout owner for issues 1–2 and fallback fidelity; explorer owner for issue 3; optional backend/navigation owner for issue 4; graph owner for issue 5.
- Install/start handoff: `pnpm install --frozen-lockfile`; `pnpm run build`; `pnpm --filter @zip-tools/web start --hostname 127.0.0.1 --port 3100`.
- Server stopped and `packages/web/test-results` removed before commit. No push, merge, reset, or implementation-file changes were made.
