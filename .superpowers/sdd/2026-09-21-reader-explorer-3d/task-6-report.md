# Task 6 report — coordinator integration

## Status

Complete on `feat/reader-explorer-3d`; the complete production browser gate is green.

Integration commit: `4b6387cfdef49da1169f6e5ffd8975d764d01de2` (`feat(web): integrate reader explorer workbench`).

Production-gate fix commit: `test(web): stabilize integrated production browser suite`; its immutable SHA is recorded in the final Task 6 handoff because a Git commit cannot contain its own hash.

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
- `packages/web/tests/graph.spec.ts` (production-gate fix)
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
- Complete production Playwright invocation on `127.0.0.1:3100`: PASS — 34 discovered, 32 passed, 2 intentionally skipped development-observer tests, 0 failed; exit 0. All four browser files ran in one command.
- Development-only graph observer assertions: PASS, 2/2 against the development server (actual renderer camera movement/reset and actual visible scene-link objects).
- Production graph coverage verifies loading → ready, a live non-lost real-WebGL canvas, node pixels, camera pixel change/reset/rotation, both failure/retry paths, focus feedback, empty filtering, and canvas navigation without production test hooks.
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
- Camera and renderer-scene object observers remain intentionally development-only. Production assertions use only user-visible behavior and the real canvas; the two observer-specific tests are reported as intentional skips in production and pass against a development server.
- Next continues to warn that multiple lockfiles make workspace-root inference ambiguous; it does not affect compilation, type checking, route generation, or production startup.

## Production E2E gate fix evidence

### RED

- Complete pre-fix production invocation: 31 discovered, 27 passed, 4 failed, 0 skipped; exit 1.
- Failures were the two page-wide graph status collisions, the page-wide NU collision, and the unconditional production camera-observer assertion. The status collision in the final canvas-navigation test masked the additional missing production scene-observer failure.

### Corrections

- Scoped graph Search, Focus, and status selectors to `graph-surface`, and scoped the NU combobox to the accessible Citation graph region. No product accessibility or route code changed.
- Split camera and scene-link internals into explicitly development-only tests enabled with `ZIP_TEST_GRAPH_OBSERVERS=development`.
- Kept production coverage hook-free and renderer-visible: state-transition observation is injected only by Playwright, while assertions inspect the real non-lost WebGL context, canvas pixels, controls, recovery UI, and navigation.

### GREEN

- `pnpm run test`: PASS — 140/140 unit tests (26 index + 114 web), 0 failed.
- `pnpm run build`: PASS — optimized production build compiled, type-checked, generated 8/8 static pages, and collected traces.
- Development observer command: PASS — 2/2, 0 skipped, 0 failed.
- Complete post-build production command: `ZIP_TEST_BASE_URL=http://127.0.0.1:3100 pnpm exec playwright test --reporter=line` from `packages/web`.
- Final production aggregate: **34 discovered; 32 passed; 2 intentionally skipped; 0 failed; exit 0**. The skipped tests are exactly the development-only camera and visible-scene-link observers.

### Fix files and self-review

- Modified `packages/web/tests/graph.spec.ts` and this report only; no Task E hook or product code change was necessary.
- Confirmed development hooks remain absent from production and both observer tests pass when explicitly run against the development artifact.
- Confirmed selector scoping follows the integrated graph subtree rather than weakening header or graph accessibility.
- Confirmed the production run includes `reader.spec.ts`, `explorer.spec.ts`, `navigation.spec.ts`, and `graph.spec.ts` in one invocation.
- Added no credentials, debug logging, product test hooks, route changes, or unrelated refactors.
