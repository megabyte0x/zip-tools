# Task 6 report — coordinator integration

## Status

Complete on `feat/reader-explorer-3d`.

Commit: this report is included in `feat(web): integrate reader explorer workbench`; the immutable SHA is recorded in the final Task 6 handoff because a commit cannot contain its own hash.

## Files changed

- `packages/index/src/build.ts`
- `packages/web/app/draft/[slug]/page.tsx`
- `packages/web/app/globals.css`
- `packages/web/app/layout.module.css`
- `packages/web/app/page.module.css`
- `packages/web/app/page.tsx`
- `packages/web/app/zip/[id]/page.tsx`
- `packages/web/app/zips/page.tsx`
- `packages/web/components/AppShell.tsx`
- `packages/web/components/GeneratedSummary.tsx`
- `packages/web/components/ReaderShell.tsx`
- `packages/web/tests/reader.spec.ts`
- `.superpowers/sdd/2026-09-21-reader-explorer-3d/task-6-report.md`

The generated `packages/web/data/zip-index.json` was regenerated for verification and remains intentionally ignored rather than committed.

## Integration delivered

- Built records now copy `renderBody.bodyFormat` into `ZipRecord`.
- Numbered and draft readers each call `prepareReader(zip)` exactly once and pass that same prepared document to `ReaderShell` and `ReaderBody`; existing previous/next and citation-neighborhood rendering remains in place.
- `GeneratedSummary` receives only `hasBody: boolean`; the article text is not passed into that client component.
- `/zips` initializes `ZipExplorer` with the complete parsed `ExplorerQuery` and no key-based remount. Home, `/zips`, header search, and both graph mounts receive body-free records at client boundaries.
- The application main element now has `id="main-content"`.
- Home keeps Featured → Network upgrades → optional Most viewed → 3D graph → ZIP of the day → explorer, with a compact top Browse ZIPs jump.
- `/graph` uses the remaining flex viewport on desktop without a body overflow mutation; narrow layouts fail open to visible overflow instead of clipping content.
- The Google Fonts import now precedes Tailwind-generated rules, removing the production CSS import-order warning.
- Activated the existing ZIP 312 prepared-content browser assertion.

## RED evidence

- Snapshot assertion before integration: 132 source-backed records failed explicit-format validation; all had `bodyFormat: undefined`.
- Route integration assertion before changes reported numbered and draft routes missing `prepareReader` and shared `document`, `/zips` missing `initialQuery`, main missing `#main-content`, and summary props still carrying `body`.
- Home assertion before changes reported the top Browse ZIPs affordance missing.
- The first production payload scan found 132 non-null article bodies serialized on `/` through the explorer client boundary; this drove body-free explorer inputs.
- The initial production build emitted the Google Fonts `@import` ordering warning; import ordering was corrected and the final build emitted no CSS optimizer warning.
- The prior graph shell used a body-level `height: 100vh; overflow: hidden` mutation, which could clip narrow graph chrome; final mobile browser measurements verify visible overflow and no horizontal overflow.

## GREEN evidence

- Structural integration checks pass: one `prepareReader(zip)` call per reader route, the same `document` supplied twice, full `initialQuery`, no route key remount, boolean-only summary prop, `#main-content`, required home order, top Browse link, and body-free graph mounts.
- Activated ZIP 312 browser assertion passes and renders 22,841 visible characters.
- Final production payload scan: `/`, `/graph`, and `/zips` each contain 0 non-null serialized `body` props and 264 null body props (the body-free corpus crosses two client boundaries per response).
- Legacy snapshot compatibility remains covered by passing `readerMode` unit tests for missing `bodyFormat`, including legacy RST and draft inference.

## Snapshot

`pnpm index` regenerated the real pin-backed snapshot from the populated `submodule/zips` checkout.

- Total records: 132
- Source-backed records: 132
- Empty source-backed bodies: 0
- Missing/invalid explicit formats: 0
- `rst-source`: 99
- `markdown`: 33
- `html`: 0 locally because Pandoc is unavailable; source retention is the intended fallback
- `none`: 0

## Tests and build

Final commands against the completed diff:

- `pnpm run test`: PASS — 26 index tests and 114 web tests, 140 total, 0 failed.
- `pnpm run build`: PASS — regenerated the real index, compiled, type-checked, generated 8/8 static pages, and collected traces. Only Next's existing multiple-lockfile/workspace-root warning remains.
- Production Playwright on `127.0.0.1:3100`: reader + explorer + navigation suites PASS, 25/25.
- Production graph failure/recovery assertions: PASS, 2/2 (`webglcontextlost` recovery and pre-ready renderer initialization failure/retry).
- `git diff --check`: PASS.
- Added-line security scan: no hardcoded secrets, shell injection, dangerous evaluation, unsafe deserialization, or SQL interpolation.

## No-binding behavior

Against the built production artifact without Cloudflare bindings:

- `POST /api/views` → 204
- `GET /api/trending` → 200 with `{ "items": [] }`
- `GET /api/summary/312` → 503, while the reader and body continue rendering

## Production HTTP/browser evidence

- Built artifact started only after build on `127.0.0.1:3100`; health check returned HTTP 200.
- `/zip/32`: 55,529 body characters, no external-only fallback.
- `/zip/312`: 22,841 body characters, matching TOC targets, no external-only fallback.
- `/zip/317`: 25,011 body characters, no external-only fallback.
- `/zip/48` (Markdown): 11,014 body characters, no external-only fallback.
- Real draft route: 6,357 body characters, no external-only fallback.
- `/graph`: real WebGL canvas reached `ready`; final smoke check confirmed a canvas.
- 390×844 `/graph`: document width 390, canvas height 241, root bottom 844, body height 844, visible main overflow, no horizontal overflow or clipping.
- Desktop `/graph`: canvas rendered at 1230px wide in the exercised viewport.
- Production server and Playwright result artifacts were removed after verification; localhost:3000 was never touched.

## Self-review

- All project edits are within Task 6 coordinator ownership; the only test edit is the permitted activation of the existing ZIP 312 assertion.
- Reader preparation is performed once per route and does not disturb citation neighborhoods or numeric previous/next navigation.
- No article body is sent to summary, explorer, header, or graph client props.
- Home module order and optional Most viewed behavior are unchanged apart from the top Browse affordance.
- Graph layout no longer depends on a client effect mutating body overflow.
- No credentials, debug logging, commented-out code, unrelated refactor, manifest change, or generated snapshot was committed.

## Concerns

- Full RST fidelity still depends on Pandoc; this environment intentionally produced 99 explicit `rst-source` fallbacks, all with retained readable content.
- Running all four Playwright files in one production invocation produced four graph-test harness failures: three unscoped role/label selectors collide with the integrated header's accessible status/menu elements, and one camera-observation hook is intentionally development-only. Product verification remained green through 25 integrated reader/explorer/navigation tests, two production graph recovery tests, and direct production WebGL/canvas/layout checks. The graph implementation was not changed to accommodate test-only selectors.
- Next continues to warn that multiple lockfiles make workspace-root inference ambiguous; it does not affect compilation, type checking, route generation, or production startup.
