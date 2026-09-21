# Reader, explorer, and 3D verification

**Date:** 2026-09-22
**Worktree:** `/home/megabyte/Work/zcash/zip-tools/.worktrees/feat-reader-explorer-3d`
**Branch / tested HEAD:** `feat/reader-explorer-3d` / `f4b0a14af19dc444c50639a3eb45e1e44af0b53d`
**Target:** production Next.js build at `http://127.0.0.1:3100`
**Outcome:** **PASS WITH ONE LOW-SEVERITY CONCERN**

## Executive summary

The merged production build passes browser, reader, explorer, graph, keyboard, responsive, and overflow acceptance. The required single complete Playwright invocation finished with **53 passed, 0 failed, 2 skipped**. The two skips are production-expected development-observer tests; no failed or focused run is folded into these totals.

All previously reported High and Medium defects are resolved in the merged result:

- ZIP 317 formula overflow is contained at both 390 px and 1280 px.
- The skip link moves focus to `main#main-content`, whose `tabindex="-1"` does not add it to ordinary tab order.
- Explorer Back during a pending reader transition restores the exact filtered results entry and remains stable after the delayed transition settles.
- Closed generated summaries no longer make the optional AI request, and the required-route run recorded no unexpected console or page errors.

One Low visual/accessibility concern remains: the graph is real and interactive, but its initial full-graph view is difficult to read because nodes and edges are tiny, the cluster occupies a small fraction of the available canvas, and dark statuses and edges have weak contrast.

| Severity | Open | Resolved from prior report |
|---|---:|---:|
| Critical | 0 | 0 |
| High | 0 | 1 |
| Medium | 0 | 3 |
| Low | 1 | 0 |

## Remaining concern

### Low: initial graph overview remains difficult to read

- **Routes:** `/` and `/graph`
- **Observed in all graph captures:** Real nodes and connecting edges are visible, but the main cluster is compact relative to the canvas, nodes are only a few pixels wide, individual edges are difficult to trace, dark status nodes nearly blend into the background, and no static node labels are visible before interaction. At 768 px the legend wraps `Reserved`; at 390 px it wraps over three rows. The canvas itself fits and is not clipped.
- **Behavioral counter-evidence:** The production tests prove a live, non-lost WebGL canvas; non-uniform rendered pixels; 126 nodes and 443 citations; visible camera changes for zoom, reset, and rotation; successful focus and no-match states; NU filtering; assigned-node canvas navigation; context-loss fallback and retry; initialization-failure retry; empty filtering; home activation/deactivation; Escape; and mobile page scrolling outside an inactive graph.
- **Code-confirmed rendering inputs, not a claimed root cause:** `ForceGraph3D.tsx` uses canvas background `#141613`, edge color `rgba(244, 241, 232, 0.38)`, edge width `0.8`, node relative size `5`, and interaction-only `nodeLabel`. `statusColor.ts` maps `Obsolete` to `#1c1e19` and `Reserved` to `#141613`, the same value as the graph background. These values confirm the low-contrast dark categories and thin edges. The visually loose initial fit is observed in captures; no implementation cause for that fit is asserted.

## Required route and behavior matrix

The generated index was parsed before testing rather than guessing examples. It identifies ZIP 48 as Markdown (`sourcePath: zips/zip-0048.md`, `bodyKind: md`), `draft-arya-dairaemma-disable-addition-of-transparent-chain-value` as a draft, and `nu6.3` in the generated NU list. ZIP 48 is the reader route used consistently for the 390, 768, and 1440 captures.

| Area | Route or behavior | Result |
|---|---|---|
| Required pages | `/`, `/zips`, `/zips?kind=draft`, `/graph`, `/zip/32`, `/zip/312`, `/zip/317`, `/zip/48`, `/draft/draft-arya-dairaemma-disable-addition-of-transparent-chain-value`, `/nu/nu6.3`, `/list`, `/zip/999999` | All expected pages rendered; the missing ZIP returned 404 with `No ZIP matches`; no required page had document-level horizontal overflow. |
| Reader body and TOC | `/zip/48`, `/zip/312` | In-app proposal body is nonempty; ZIP 48 body exceeded 1,000 characters; TOC hashes resolve to matching heading IDs and preserve hash history. |
| Source and citations | `/zip/48` | GitHub source is pinned to a 40-character snapshot SHA; an internal `/zip/...` citation is present. |
| Revisions and dates | `/zip/317`, `/zip/312` | ZIP 317 exposes `[Revision 0] Active, [Revision 1: NU6.3] Draft, [Revision 2] Draft`; incomplete date `2022-08-dd` remains preserved. |
| Adjacent navigation and bookmark | `/zip/48` | Previous and next ZIP controls are present; bookmark state survives reload. |
| Markdown / draft / NU samples | `/zip/48`, `/draft/draft-arya-dairaemma-disable-addition-of-transparent-chain-value`, `/nu/nu6.3` | Generated-index-selected samples render successfully. |
| RST environment | `/zip/32`, `/zip/312`, `/zip/317` | `pandoc` is absent. The degraded RST path is clearly labeled `Limited conversion`, remains readable, and does not expose sampled raw `.. raw::` directive clutter. Only full-converter output inspection is environment-specific and unverified. |
| Explorer filters and history | `/zips` | Counts, search, kind/status/NU/category filters, owner search, sorting, draft selection, empty-state clearing, reload restoration, client navigation, and mobile table semantics pass. |
| Exact pending-Back sequence | reader → `/zips?q=317&kind=numbered` → pending `/zip/317` → Back | The filtered explorer restores while the transition is pending; after the delayed request settles, URL, search `317`, kind `numbered`, idle state, and absent reader heading remain exact. Forward does not create a duplicate reader history entry; subsequent Back reaches `/zips?q=317`, then `/zip/312`. |
| Real WebGL nodes and edges | `/`, `/graph` | Live non-lost WebGL and non-uniform pixels pass. Captures visibly show nodes and connecting edges; the graph reports 126 nodes and 443 citations. The production scene-observer test is intentionally skipped because that test-only observer is development-only. |
| Graph interaction | `/graph` | Rotate, zoom, reset, focus, no-match, NU filter, assigned-node navigation, empty state, context loss, retry, and initialization-failure retry pass. |
| Home graph interaction | `/` | Preview reaches ready state; mobile page scroll works outside the inactive graph; Activate and Escape/deactivate pass. |
| Keyboard | `/zip/48` and shared header | Skip link receives focus and moves focus to `main#main-content`; ordinary tab order continues to the logo; visible focus and keyboard search-to-reader flow pass. |
| Effective 200% zoom | `/`, `/zips`, `/zip/48`, `/graph` | Tested at a 720 × 450 CSS viewport; no document-level horizontal overflow. |
| Technical overflow | `/zip/32`, `/zip/317`, `/zip/48` | Wide code/table/formula content is contained with horizontal scrolling. ZIP 317 passes at 390 px and 1280 px. Live ZIP 48 measurement found page width equal to client width and all wider `pre` elements using `overflow-x: auto`. |
| Contrast | `/zip/48` | Computed body and article paragraph contrast both meet the suite's WCAG-AA threshold of 4.5:1. The separate graph-mark concern remains above. |
| Console | Required-route flow and behavior tests | No unexpected browser console errors or page errors. The missing page's expected 404 resource message is excluded from the unexpected-error assertion. |

## Visual evidence

All 12 captures were freshly produced by the single complete Playwright invocation and then individually opened with vision analysis.

Directory: `docs/superpowers/reports/2026-09-21-reader-explorer-3d-screenshots/`

| Width | Home | Explorer | Reader (`/zip/48`) | Graph |
|---:|---|---|---|---|
| 390 | `home-390.png` | `explorer-390.png` | `reader-390.png` | `graph-390.png` |
| 768 | `home-768.png` | `explorer-768.png` | `reader-768.png` | `graph-768.png` |
| 1440 | `home-1440.png` | `explorer-1440.png` | `reader-1440.png` | `graph-1440.png` |

Visual findings:

- **Home:** Headings, cards, upgrade summaries, search, and graph controls are readable and fit. The featured rail deliberately exposes a partial next card at 390 and 1440 without a strong visible scroll affordance. At 768 and 1440, only the upper part of the home graph canvas is above the 900 px fold.
- **Explorer:** 390 px uses stacked filters and cards; 768 and 1440 use a table. All controls and columns fit without horizontal clipping. Small uppercase labels and placeholders are subdued but legible.
- **Reader:** The title and prose remain readable at all widths; desktop uses a comfortable central measure. At 390 and 768, long monospaced metadata lines appear clipped in the static viewport, but live measurement confirms they are inside `overflow-x: auto` containers and do not widen the document. The 1440 capture shows the TOC, body, source metadata, adjacent controls, links, and bookmark without clipping.
- **Graph:** Every graph capture visibly contains non-uniform nodes and connecting edges. The canvas and controls fit at all widths. The remaining Low concern is the tiny clustered initial fit, faint edges, dark status colors, and lack of static labels.

## Commands, exits, and exact totals

| Command | Exit / output |
|---|---|
| `pnpm run build` | **0**. Index rebuilt, Next.js production compilation/type checks/static generation completed. Next warned that multiple lockfiles caused workspace-root inference. |
| `pnpm --filter @zip-tools/web start --hostname 127.0.0.1 --port 3100` | Ready at `http://127.0.0.1:3100` in **253 ms**. Port 3000 was not used. The server was terminated after acceptance. |
| `ZIP_TEST_BASE_URL=http://127.0.0.1:3100 pnpm --filter @zip-tools/web exec playwright test --workers=1` | **0**. Single complete invocation: **55 total, 53 passed, 0 failed, 2 skipped**, one worker, 1.1 minutes. The skipped tests are the development-only camera and scene observers intentionally absent from production builds. |
| `pnpm run test` | **0**. Index **26/26** and web **114/114** passed: **140 passed, 0 failed, 0 skipped** total. |
| `pnpm run build` | **0**. Final production build completed after report/screenshots were finalized; the same multiple-lockfile workspace-root warning remained. |
| `git diff --check` | **0**. Run as the final gate after all tracked evidence edits and cleanup. |

No focused Playwright invocation was run or added to the totals.

## Cleanup and handoff

- Exact install/build/start handoff: `pnpm install --frozen-lockfile`; `pnpm run build`; `pnpm --filter @zip-tools/web start --hostname 127.0.0.1 --port 3100`.
- Production server termination, generated Playwright artifact cleanup, final root test/build, final `git diff --check`, and final commit are recorded in the final-run report and commit metadata.
- No production source or browser test source was edited. No push, merge, reset, subagent dispatch, or port 3000 use occurred.
