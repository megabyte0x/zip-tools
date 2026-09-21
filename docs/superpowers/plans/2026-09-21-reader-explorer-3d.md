# ZIP.tools Reader, Explorer, and 3D Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For the parallel wave also load `parallel-plan-implementation`; its file-disjoint worktree rules govern dispatch.

**Goal:** Ship readable in-app ZIPs, responsive discovery, and a visibly working eip.tools-style 3D citation graph by reusing the existing workbench branch.

**Architecture:** Extend `feat/zip-tools-workbench` at `3f6c913`, not the older main implementation. Build content from the pinned corpus, prepare safe article/TOC data server-side, and keep reader/explorer/navigation/graph components independently owned. A serial foundation freezes contracts; five parallel agents implement disjoint modules; a coordinator integrates and verifies real browser behavior.

**Tech Stack:** Existing Next.js 15 / React 18 / TypeScript / pnpm, CSS modules, existing shadcn/Tailwind gold theme, ReactMarkdown/KaTeX, react-force-graph-3d/three, node:test/tsx. Add DOM-processing/sanitization and Playwright testing dependencies centrally only if absent.

**Spec:** `docs/superpowers/specs/2026-09-21-reader-explorer-3d-design.md`

## Global Constraints

- No login, new backend deployment, analytics expansion, or AI expansion.
- Preserve existing optional features; missing Cloudflare bindings must not block core routes.
- Proposal bodies come from the snapshot pin, not request-time GitHub fetching.
- The official site is a supporting link, not a substitute for in-app proposal text.
- Citation copy is Cites / Cited by, never Requires.
- Preserve source identifiers, revision statuses, incomplete dates, and pinned provenance.
- Keep shadcn/Tailwind already on the reusable branch; do not rebuild the app around another framework.
- No implementation on main. No commit, merge to main, push, branch reset, or server replacement without user authorization. Commit checkpoints below apply only when implementation commits are authorized; otherwise deliver file-scoped patches for coordinator integration.
- The coordinator exclusively owns `app/**`, global CSS/tokens, both type files, manifests, lockfile, shared contracts/fixtures, and CI. Parallel agents must not edit them.
- Root verification commands are `pnpm run test` and `pnpm run build`. The root build regenerates the snapshot before the web build.

## 0. Evidence, reusable work, and what has NOT been verified

Inspection date: 2026-09-21. Main HEAD: `0d49bf0`; clean before planning. Existing feature worktree: `/home/megabyte/Work/zcash/zip-tools/.worktrees/feat-zip-tools-workbench`, HEAD `3f6c913`, clean when inspected. No remote configured in inspected checkout.

Reusable commits:

| Area | Commits | Existing implementation to retain |
|---|---|---|
| URL/search helpers | `17842d4`, `b649054` | zipHref, kind filters, searchSuggestions, parseZipsQuery |
| Header | `41b1049` | SiteHeader, HeaderSearch, headerModel |
| Reading list | `5e91127` | readingList, ReadingListButton, /list |
| TOC / reader | `2bf8df2`, `2f8b66f`, `685adac`, `441fc4f` | toc helpers, ReaderShell, TocNav, prevNext |
| Discovery | `fb0ded0` | ZipRail, Featured, ZipOfTheDay |
| 3D graph | `cfa1e6c`, `0686158`, `9e7f98a` | ForceGraph3D, fallback, status legend, route sizing |
| Body preservation | `78877b9` | source retained on pandoc failure, rstSourceToMarkdown |
| Visual styling | `93664fd`, `3f6c913` | reader rhythm, shadcn/Tailwind and gold tokens |

Use the whole branch as a foundation, not these commits as an unordered cherry-pick list. The branch includes optional Cloudflare code; retaining it avoids unnecessary surgery, but that code is not a reason to add deployment scope.

Verified here: `pnpm run test` passes 20 index tests and 81 web tests on the existing feature branch. Not verified here: feature-branch production build, actual 3D rendering, or feature-branch mobile layouts. Prior screenshots show main, not proof that this branch's graph is broken.

Known hardening targets from code inspection: RST fallback converts only basic headings, reader mode infers HTML from a leading `<`, RST drafts are labeled draft, prepared HTML uses dangerouslySetInnerHTML without a demonstrated sanitizer, explorer URL parser only supports q/kind, graph probes WebGL during render. Test these paths rather than assuming existing green tests prove them.

## 1. Ownership and execution graph

```
T0 reusable baseline + shared contracts + dependency/test gate (serial)
                   |
       +-----------+-----------+-----------+-----------+
       A content   B reader    C explorer  D chrome    E 3D graph
       +-----------+-----------+-----------+-----------+
                   |
T6 route integration + real snapshot + build (serial coordinator)
                   |
T7 browser/visual acceptance + regression report
```

Five implementers get separate worktrees cut from the reviewed T0 HEAD. No nested delegation. A task may read any repository file but write only its ownership set. Shared-file requests go to the coordinator and wait until the next serial gate. Review each task's diff against the wave base before integrating. Run combined tests after integration.

Exclusive ownership (paths relative to repository root; paired `*.test.ts` below means only the explicitly named helper's test file):

| Owner | Writable files |
|---|---|
| A | `packages/index/src/renderBody.ts`, `packages/index/test/renderBody.test.ts`, new `packages/index/test/bodyCoverage.test.ts`; new `packages/web/lib/prepareReader.ts`, `prepareReader.test.ts`, `readerLinks.ts`, `readerLinks.test.ts`; existing `packages/web/lib/readerMode.ts`, `readerMode.test.ts`, `rstSource.ts`, `rstSource.test.ts`, `toc.ts`, `toc.test.ts` |
| B | `packages/web/components/ReaderShell.tsx`, `ReaderShell.module.css`, `ReaderBody.tsx`, `ReaderBody.module.css`, `TocNav.tsx`, `ZipMeta.tsx`, `ZipMeta.module.css`; new `packages/web/tests/reader.spec.ts` |
| C | `packages/web/components/ZipExplorer.tsx`, new `ZipExplorer.module.css`, `SearchBand.tsx`, `SearchBand.module.css`, `ZipTable.tsx`, `ZipTable.module.css`; `packages/web/lib/filter.ts`, `filter.test.ts`, `zipsQuery.ts`, `zipsQuery.test.ts`; new `packages/web/tests/explorer.spec.ts` |
| D | `packages/web/components/SiteHeader.tsx`, `SiteHeader.module.css`, `HeaderSearch.tsx`, `HeaderSearch.module.css`, `ZipRail.tsx`, `ZipRail.module.css`, `ZipOfTheDay.tsx`, `ZipOfTheDay.module.css`; `packages/web/lib/headerModel.ts`, `headerModel.test.ts`, `searchSuggest.ts`, `searchSuggest.test.ts`; new `packages/web/tests/navigation.spec.ts` |
| E | `packages/web/components/ForceGraph3D.tsx`, `ForceGraph3D.module.css`; `packages/web/lib/graphFallback.ts`, `graphFallback.test.ts`, `statusColor.ts`, `statusColor.test.ts`; new `packages/web/lib/graphSearch.ts`, `graphSearch.test.ts`; new `packages/web/tests/graph.spec.ts` |
| Coordinator | Everything else, including new `packages/web/lib/workbenchContracts.ts`, `readerFixtures.ts`, `tests/acceptance.spec.ts`, `playwright.config.ts`, `lib/contract.test.ts`, plus all `app/**`, types, dependencies, tokens, docs, CI |

### Task 0: Verify reused baseline and freeze shared contracts

**Owner:** coordinator, serial. **Files:** `packages/web/package.json`, `packages/index/package.json`, `pnpm-lock.yaml`, `packages/web/lib/types.ts`, `packages/index/src/types.ts`, `packages/web/lib/workbenchContracts.ts`, `packages/web/lib/readerFixtures.ts`, `packages/web/lib/contract.test.ts`, `packages/web/playwright.config.ts`, `packages/web/app/globals.css`, `packages/web/lib/tokens.css`, `packages/web/app/layout.module.css`, `.github/workflows/ci.yml` only if test tooling needs it.

- [ ] Recheck source worktree status and HEAD; preserve uncommitted user changes if any. Create a fresh feature worktree from `3f6c913` with an authorized branch name. Copy these new plan/spec documents into it; they are not in that older commit. Do not switch or stop localhost:3000.
- [ ] Run `pnpm install --frozen-lockfile`, `pnpm run test`, and `pnpm run build` in the new tree. Capture output and fix baseline blockers centrally before dispatch. Never run a build concurrently with a dev server using the same `.next` directory.
- [ ] Launch the isolated baseline on a free alternate port and verify it with HTTP plus browser screenshots. Inspect home, reader, and /graph; distinguish wrong-checkout/stale-snapshot symptoms from real feature-branch bugs. Keep the user's port 3000 unchanged.
- [ ] Add shared contracts below, and optional `bodyFormat?: BodyFormat` to both ZipRecord declarations (define BodyFormat locally in each package; do not import web code into index). No dummy production renderer is needed: Task B accepts prepared data as an optional prop until coordinator wiring.

```ts
// packages/web/lib/workbenchContracts.ts
import type { ZipRecord } from './types';
export type BodyFormat = 'html' | 'markdown' | 'rst-source' | 'none';
export type ReaderHeading = { id: string; text: string; level: 2 | 3 };
export type PreparedReader = {
  html: string;
  toc: ReaderHeading[];
  mode: 'full' | 'degraded' | 'missing';
  warnings: string[];
};
export type ExplorerQuery = {
  text: string;
  kind: '' | 'draft' | 'numbered';
  status: string;
  nuId: string;
  category: string;
  sort: 'number' | 'title';
};
export type GraphInput = {
  zips: ZipRecord[]; // caller supplies body:null; never serialize article bodies
  dangling: number[];
  variant: 'home' | 'graph';
};
```

- [ ] Centralize full/degraded/missing PreparedReader fixtures in `readerFixtures.ts` (exports `fullReaderFixture`, `degradedReaderFixture`, `missingReaderFixture`). Full fixture: headings intro and security, paragraph, table, code block; degraded fixture: same headings plus a conversion warning; missing fixture: empty HTML/TOC. Add compile/runtime contract test:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fullReaderFixture } from './readerFixtures';
test('reader fixture anchors and TOC agree', () => {
  for (const h of fullReaderFixture.toc) {
    assert.ok(fullReaderFixture.html.includes(`id="${h.id}"`));
  }
  assert.equal(fullReaderFixture.mode, 'full');
});
```

- [ ] Add direct dependencies needed by A centrally: unified, remark-parse, remark-rehype, rehype-parse, rehype-stringify, rehype-sanitize, unist-util-visit; reuse existing remark-math, remark-gfm and rehype-katex. Do not rely on transitive imports. Document/install pandoc for full-fidelity builds; failure mode still works without it. Add @playwright/test for browser tests. Run package compatibility/type/build checks after lockfile changes.
- [ ] Define `test:e2e` as `playwright test`; browser baseURL reads `ZIP_TEST_BASE_URL` with default `http://127.0.0.1:3100`. Tests attach to a separately started server, not a competing auto-start process. Install Chromium with `pnpm --filter @zip-tools/web exec playwright install chromium`.
- [ ] Set token/spacing/focus defaults once: prose measure 65ch, app 16px, prose 18px desktop/16px narrow, prose line-height 1.7, control height 44px. Use min-width:0 and width:100% on layout/grid children and controls. Preserve existing theme compatibility.
- [ ] Run tests/build again; record reviewed wave-base SHA (or equivalent authorized patch baseline). Dispatch A–E together only after contracts and dependencies are available in every worktree.

### Task A: Preserve and safely prepare complete article content

**Consumes:** ZipRecord (optional bodyFormat), shared PreparedReader/ReaderHeading.
**Produces:** `prepareReader(zip: ZipRecord): Promise<PreparedReader>` in `prepareReader.ts`; `readerAssetUrl(zip: ZipRecord, href: string): string` and `readerProposalHref(href: string): string` in `readerLinks.ts`. Keep `renderBody(sourcePath, text)` public API; add `bodyFormat` to its result.

- [ ] Write failing deterministic tests for converter absence, nonzero exit, timeout, successful HTML, Markdown, and RST drafts. Inject the converter function as an optional third argument to renderBody instead of depending on the machine's PATH. Define it as `(source: string) => { body: string | null; warning?: string }`, with existing spawn-based conversion as default. On null/error return the original source, `bodyFormat:'rst-source'`, and warning.

```ts
const source = 'Intro\n=====\n\nActual proposal text.';
const r = renderBody('zips/draft-test.rst', source,
  () => ({ body: null, warning: 'pandoc not found' }));
assert.equal(r.body, source);
assert.equal(r.bodyFormat, 'rst-source');
assert.equal(r.bodyKind, 'draft');
```

- [ ] Run `pnpm --filter @zip-tools/index test` and capture the expected failure before implementation. Implement converter-result discrimination and source retention; empty converter output also falls back rather than silently losing content. T6 owns copying bodyFormat into build.ts records.
- [ ] Implement readerMode compatibility for old snapshots, honoring explicit bodyFormat first; never infer draft format solely from bodyKind. Retain existing exported names and update their tests.
- [ ] Write failing preparation tests: sanitized HTML removes script/onerror/javascript URLs; preserves safe code/math; repeated headings and existing IDs stay unique; markdown links/images/code produce identical visible heading text and IDs; RST fallback includes actual prose and degraded mode.

```ts
const doc = await prepareReader({ ...makeZip(), bodyKind: 'rst',
  bodyFormat: 'html', body: '<h2>Intro</h2><script>alert(1)</script><p>Text</p>' });
assert.equal(doc.mode, 'full');
assert.ok(!doc.html.includes('<script'));
assert.ok(doc.html.includes(`id="${doc.toc[0].id}"`));
```

`makeZip` is the existing `lib/test-zip.ts` export; inspect its argument signature before composing fixtures.

- [ ] Build one unified preparation pipeline for Markdown and HTML, sanitize with explicit allowlists, allocate heading IDs on the prepared tree, then derive TOC from that same tree. Allow safe KaTeX tags/classes/attributes deliberately; do not disable sanitization globally. Source fallback uses existing rstSource helpers, preserves text and warns about unsupported syntax; do not claim full RST fidelity from regex conversion.
- [ ] Normalize local zip-NNNN references to `/zip/N`, draft references to `/draft/slug`, preserving fragments; preserve safe external URLs. Resolve relative assets from zip.githubUrl's pinned repository path using URL/path parsing. Test nested paths, fragments, unsafe schemes, and malformed links. Do not fetch remote content during unit tests.
- [ ] Add real-source coverage test iterating source-backed records and asserting retained nonempty body under forced conversion failure; counts are computed, not hard-coded to 132 forever. Run index and web tests. Provide converter/full-fidelity versus fallback limitations in the task report.

### Task B: Build a readable reader surface using prepared content

**Consumes:** `PreparedReader` fixtures; existing ReaderShell zip/prev/next/children props, TocNav, ReadingListButton.
**Produces:** backwards-compatible optional `document?: PreparedReader` prop on ReaderShell and ReaderBody. When supplied, both use its same html/toc; existing props remain valid until T6 integration. No new content preparation implementation in this task.

- [ ] Write `tests/reader.spec.ts` failing checks against the baseline: ZIP identity and title, visible article paragraphs, width bound, mobile metadata disclosure, TOC target existence, and accessible previous/next names. Tests requiring A's actual output are marked in the task report as integration-pending, not passed.

```ts
import { test, expect } from '@playwright/test';
test('ZIP 312 reads in app', async ({ page }) => {
  await page.goto('/zip/312');
  const body = page.getByTestId('reader-body');
  await expect(body).toBeVisible();
  expect((await body.innerText()).trim().length).toBeGreaterThan(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('FROST');
});
```

- [ ] Render document.html only from the trusted prepared result in ReaderBody; add `data-testid="reader-body"`. Degraded mode shows a small conversion notice; missing mode retains the official fallback once. Never sanitize independently in B; A owns the trust boundary.
- [ ] Implement >=1280px Contents/article/metadata layout, 65ch prose, sticky offsets below header, and mobile stacked layout. Keep article tables/code/math in local overflow containers; hide no content to solve overflow. Add section-link focus and scroll-margin-top.
- [ ] ReaderShell consumes document.toc when provided. TocNav highlights current headings without covering footer, hash navigation works with browser Back, and mobile Contents is a disclosure. Ensure duplicate desktop/mobile navigation does not create duplicate element IDs.
- [ ] Place compact identity/status above prose, metadata disclosure on narrow screens, source links in metadata, and existing bookmarks accessible. Preserve revision details and literal incomplete dates. Label previous/next buttons with ZIP number/title via aria-label, not tooltip only.
- [ ] Keep generated summary closed and secondary; never pass the full body to a client summary component solely to decide whether it is available (coordinator handles any cross-owner prop change). Preserve existing 2D neighborhood below article children.
- [ ] Run web unit tests and browser tests against available local server; record which content-dependent tests await integration. Use fixtures for render/TOC behavior without importing A's unfinished implementation.

### Task C: Responsive, URL-driven exploration

**Consumes:** ExplorerQuery contract, existing ZipRecord, zipHref.
**Produces:** `parseZipsQuery(search: string): ExplorerQuery`; `serializeZipsQuery(query: ExplorerQuery, existing?: string): string`; optional `initialQuery?: ExplorerQuery` on ZipExplorer, retaining existing initialText/initialKind compatibility until T6.

- [ ] Write failing tests for q/kind/status/nu/category/sort roundtrip, invalid sort/kind defaults, exact NU/status filtering, stable number/title ordering, drafts, unrelated-parameter preservation, and empty results.

```ts
const q = parseZipsQuery('?q=Orchard&nu=nu6.3&sort=title');
assert.equal(q.nuId, 'nu6.3');
assert.equal(q.sort, 'title');
assert.deepEqual(parseZipsQuery(serializeZipsQuery(q)), q);
```

- [ ] Run web tests to establish red, then implement URL parsing/serialization and filtering. Match selected statuses to parsed status labels, retaining full revision-specific source text in the row. Do not treat nu6.3 as a substring wildcard.
- [ ] Add result count, removable active chips, Clear filters and sort control. Debounce text URL replacement; push discrete filter changes; subscribe to browser back/forward and restore state without update loops. Preserve fragment and unrelated parameters.
- [ ] Make titles and identifiers proper internal links. Desktop number column approximately 6rem; title absorbs remaining space; allow full titles to wrap. Draft slugs cannot size columns. Show revision status detail through a keyboard-accessible disclosure.
- [ ] Implement stacked mobile results at <=767px, plus min-width:0 on controls/grids; show identity/title/status/category/NU. Keep one accessible results representation. Empty state offers clearing filters.
- [ ] Browser test search Orchard, apply NU filter, open result, back, reload and compare controls/URL. Test owner matches, Drafts, no-results, clear, sort, and 390px overflow:

```ts
expect(await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth
)).toBe(true);
```

- [ ] Run unit tests and `pnpm --filter @zip-tools/web exec playwright test tests/explorer.spec.ts`. Supply a patch limited to C's files.

### Task D: Navigation and compact discovery

**Consumes:** existing headerModel/searchSuggestions and current SiteHeader props; retain existing exported component signatures.
**Produces:** responsive SiteHeader/HeaderSearch and refined existing discovery components; no app route edits.

- [ ] Write failing navigation tests for wordmark home link, Browse, Drafts, Graph, reading list, keyboard search selection/Escape, no-hit browse URL, and 390px menu access. Unit-test suggestion limit and numbered/draft destinations.

```ts
await page.goto('/zip/312');
await page.getByRole('link', { name: 'Browse', exact: true }).click();
await expect(page).toHaveURL(/\/zips/);
```

- [ ] Preserve existing search API; implement appropriate combobox/listbox semantics, aria-expanded, highlighted option, Enter and Escape. Announce no matches without trapping focus. Header navigation identifies active destination.
- [ ] Make small-screen header/search/menu usable without overflowing; keep 44px targets. Add a skip link targeting coordinator-provided `#main-content`. Search works on reader and graph routes as well as home.
- [ ] Refine ZipRail/ZipOfTheDay typography, title links, status details, card sizing, and horizontal scrolling without a page-width leak. Do not add new identity or backend calls. Do not reorder home sections here; T6 owns route composition.
- [ ] Run existing header/search/reading-list tests and new navigation browser suite. Check a complete keyboard path from header through a search result into a reader.

### Task E: Prove and harden the actual 3D graph

**Consumes/produces:** retain `ForceGraph3D({ zips, dangling, variant })`; add `findGraphNode(nodes, query)` in graphSearch.ts with GraphRecordNode[] and string arguments returning GraphRecordNode | undefined. Preserve graphRecords/statusColor exports.

- [ ] First inspect the existing graph in a real browser on the isolated feature server. Do not replace it merely because main showed only SVG. Record whether failure is load, size, WebGL context, render, or interaction; test before modifying.
- [ ] Write failing unit tests for exact ZIP-number/title focus search, no match, filtered dangling membership and empty graph. Add browser tests for home and /graph canvas size, loading completion, visible fallback suppression in a supported browser, and search feedback.

```ts
assert.equal(findGraphNode([{ id: 32, title: 'Wallets', status: 'Final',
  unassigned: false }], 'ZIP 32')?.id, 32);
assert.equal(findGraphNode([], '32'), undefined);
```

Inspect GraphRecordNode in graphFallback.ts and include any additional required fields in the fixture.

- [ ] Move repeated assertWebGl work out of render; prefer catching the real renderer's initialization and context loss rather than allocating probe contexts on every state update. Preserve dynamic SSR-disabled import, retry/error boundary, and clean event listeners/ResizeObserver on unmount.
- [ ] Provide explicit loading, empty, ready, and failed states; add data-testid `graph-surface`. Maintain sensible node/edge visibility, labels, status legend, camera zoom/reset/focus. Show no-match feedback. Clone immutable graph input before the library mutates node positions/link endpoints.
- [ ] Fix graphRecords' current second pass: it creates an Unassigned node for every absent citation target, including assigned ZIPs excluded by a NU filter. Only retain an edge when its target is a selected assigned node or belongs to the supplied true dangling set; otherwise omit the edge. Test a selected ZIP citing an excluded assigned ZIP separately from a genuinely unassigned reference. Assigned clicks navigate; true unassigned nodes are visibly non-navigable. Fallback lists include titles and direction context, not just numbers. Provide an accessible node-list view even when WebGL works.
- [ ] Add touch activation/deactivation and Escape exit so a home graph does not hijack page scrolling. Respect reduced motion; suspend offscreen animation; preserve responsive height cap and expanded flex layout.
- [ ] Test synthetic `webglcontextlost` on the actual canvas, retry, initialization failure, and empty NU-filter results. A canvas-exists assertion alone is insufficient: capture visible nodes/edges, perform rotate/zoom/reset and verify changed camera/pixels, then focus/click an assigned node to reach its reader. Use stable test-only camera observation if needed, never a mocked renderer as release proof.
- [ ] Run graph unit/browser tests and provide real visual evidence. If the tool browser lacks WebGL, report that as blocked evidence and verify using a hardware-capable local browser; do not count fallback success as 3D success.

### Task 6: Integrate routes, regenerate content, and verify combined build

**Owner:** coordinator, after A–E review. **Files:** `packages/index/src/build.ts`; `packages/web/app/layout.tsx`, `layout.module.css`, `globals.css`, `page.tsx`, `page.module.css`, `zips/page.tsx`, `zip/[id]/page.tsx`, `draft/[slug]/page.tsx`, `graph/page.tsx`, `graph/page.module.css`, `nu/[id]/page.tsx` and its CSS only as needed; `components/AppShell.tsx`; `components/GeneratedSummary.tsx` only if removing serialized body; manifests/CI only centrally.

- [ ] Review each task's exclusive-file diff, tests and report; reject cross-owner edits or Important unresolved findings. Integrate reviewed patches/commits without discarding shared type/dependency changes. Run combined unit tests immediately.
- [ ] Copy renderBody.bodyFormat into index records in build.ts. Regenerate via `pnpm index`; check all source-backed records for nonempty body and explicit format. Verify old snapshot compatibility separately.
- [ ] In numbered and draft routes prepare once, then pass the same result to shell and body:

```tsx
const document = await prepareReader(zip);
return (
  <ReaderShell zip={zip} prev={prev} next={next} document={document}>
    <ReaderBody body={zip.body} bodyKind={zip.bodyKind}
      officialUrl={zip.officialUrl} document={document} />
    {/* Keep the existing neighborhood component here, after the body. */}
  </ReaderShell>
);
```

Use existing prevNext for numbered routes; drafts receive null prev/next. Keep actual existing neighborhood expressions rather than replacing them with the explanatory comment.

- [ ] Ensure summary clients receive `hasBody: boolean`, not entire article text; change ReaderShell/GeneratedSummary together now after the parallel wave if necessary. Optional features fail open without bindings.
- [ ] Wire full ExplorerQuery from route searchParams; do not reset client state on unrelated renders. Give main the `main-content` target. Keep home Featured → NU → optional Most viewed → 3D preview → daily → explorer, with a top Browse link/jump. Both graph mounts receive body-free records.
- [ ] Integrate graph-only viewport handling through AppShell and shared header sizing. No hidden root overflow hack that clips mobile content; `/graph` canvas gets remaining height after toolbar/header.
- [ ] Run `pnpm run test`, then `pnpm run build`. Inspect no-binding API behavior and body payload serialization. Start the production artifact separately and health-check before browser verification. Do not mark a compile-only build as rendering proof.

### Task 7: Browser, visual and accessibility acceptance

**Owner:** coordinator or read-only reviewer; fixes routed to file owners. **Files:** new `packages/web/tests/acceptance.spec.ts`, final `docs/superpowers/reports/2026-09-21-reader-explorer-3d-verification.md` and screenshot directory chosen at execution time.

- [ ] Run browser tests with `ZIP_TEST_BASE_URL=http://127.0.0.1:3100 pnpm --filter @zip-tools/web exec playwright test` against the built app. Record actual port if changed.
- [ ] Check `/`, `/zips`, `/zips?kind=draft`, `/graph`, `/zip/32`, `/zip/312`, `/zip/317`, one actual Markdown reader, one actual draft, a NU page, `/list`, and a missing ZIP. Select Markdown/draft examples from the generated index rather than guessing their formats.
- [ ] At widths 390, 768 and 1440 capture home, explorer, reader and graph screenshots. Inspect them visually with vision tools; check real content, contrast, focus, table proportions, touch controls, and unclipped code/math. Count every required route/viewport check in the report.
- [ ] Verify in-app prose plus matching TOC anchors, source links pinned to snapshot, internal citations, revision status details, preserved incomplete dates, next/previous, bookmarks and back-navigation filter state. Fallback RST clearly labels degraded rendering; full-converter output has no raw directive clutter in sampled technical sections.
- [ ] Exercise real 3D node/edge rendering, rotate, zoom, reset, focus, no-match, node navigation, NU filtering, context loss and retry. Confirm home graph remains visible as a preview and full graph fits its viewport. Test mobile scroll outside graph and escape/deactivate inside it.
- [ ] Measure label/body contrast, verify keyboard-only navigation and 200% zoom. Check all required pages for document-level overflow with scrollWidth/clientWidth. Ensure contained table/code scroll remains possible.
- [ ] Final root tests/build and `git diff --check`; record exact commands, exit codes, browser console errors, screenshots, and any remaining blockers. No completion if 3D merely mounts a blank canvas or readers still send users outside to read.
- [ ] Handoff includes feature branch/worktree path and exact install/start commands. Do not switch localhost:3000 or merge/push unless separately requested.

## Review and execution notes

This plan deliberately reuses working implementations rather than pretending the features are absent everywhere. The remaining work is baseline verification, technical content fidelity/safety, responsive UX, graph interaction proof, and integration. Green existing unit tests establish a starting point, not acceptance.

Recommended dispatch: serial T0, parallel A–E from the same reviewed baseline, serial T6, then T7. If A changes a contract, stop affected consumers and publish a coordinator-owned contract gate; do not let agents independently invent incompatible props.

Planning self-review coverage: content = A/T6/T7; reader = B/T6/T7; explorer = C/T6/T7; header/discovery = D/T6/T7; 3D = E/T6/T7; shared design/dependencies = T0; branch reuse = T0. No production code or existing branches were modified while writing this plan.
