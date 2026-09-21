# ZIP.tools reader, explorer, and 3D graph design

Date: 2026-09-21
Status: scope requested by user; implementation not authorized by this document.
Companion plan: `../plans/2026-09-21-reader-explorer-3d.md`

## Intent and relationship to previous work

Make ZIP.tools a readable in-app proposal library and an explorable citation workbench. Deliver actual proposal bodies, a responsive explorer, useful navigation, and an interactive 3D graph on home and `/graph`. Keep the reader's local 2D citation neighborhood below the document.

This is a reuse-and-hardening iteration of `2026-09-18-zip-tools-workbench-design.md`, not a greenfield rebuild. It overrides that document's no-Tailwind constraint because the existing reusable feature branch already introduced shadcn/Tailwind. Do not introduce another component framework. Preserve its optional backend functionality without expanding it; no analytics/AI deployment or new credentials are required here.

## Evidence and baseline

Live browser inspection covered `/`, `/zip/32`, `/zip/317`, `/zip/312`, and `/graph`; fresh visual screenshots covered home and ZIP 312 at 1440px desktop and 390px mobile. Main's generated index contained 132 records: 99 RST records with null bodies, 27 Markdown records with bodies, and 6 drafts with bodies. ZIP 32 and ZIP 317 reported `pandoc not found`. Main's renderer discards RST content on conversion failure. Its only graph implementation is SVG.

Observed UI problems: identifier column takes disproportionate width; long titles/statuses wrap; draft slugs influence column sizing; titles are not links; no result count or reset; header contains only branding; mobile filters exceed the viewport; reader metadata dominates an otherwise missing reading surface.

Local branch discovery found:
- `main`: `0d49bf0`.
- `feat/zip-tools-workbench`: `3f6c913`, checked out at `.worktrees/feat-zip-tools-workbench`, clean when inspected.
- No configured remote was returned by `git remote -v`; this is a local branch inventory, not proof about inaccessible remote repositories.
- Feature branch already implements `ForceGraph3D`, `ReaderShell`, `TocNav`, source retention, header search, bookmarks, and a shadcn gold theme.
- Feature branch `pnpm run test`: 20 index tests and 81 web tests pass. Its current production build and browser rendering have NOT been verified in this planning session. Existing code is a reuse candidate, not a release acceptance result.

## Reuse decision

Create the implementation feature worktree from `3f6c913`, not main. Do not reset main, merge the old branch, or switch the user's running server during planning. Preserve the source branch as-is. The old feature branch already contains interdependent reader, graph, styling, and optional backend changes; a whole-branch foundation is less fragile than cherry-picking selected component files without their helpers or lockfile.

Retain existing local reading lists, featured/daily features, and fail-open backend APIs. Keep generated summaries closed and secondary; proposal rendering must not await them. No new login, database, analytics, AI, or deployment work.

## Design system and navigation

Retain near-black surfaces, warm off-white text, and gold accents. Reuse existing shadcn primitives where useful; retain CSS modules for article, layout, and graph styling. Centralize semantic colors, spacing, header height, focus ring, and readable measure; do not create competing token sets.

Use 16px application text, 18px desktop prose / 16px narrow prose, line height 1.7 for prose, max-width 65ch. Body and labels meet WCAG AA contrast; keyboard focus is visible and non-color cues distinguish links and statuses. Controls target at least 44px touch height.

Sticky header: linked ZIP.tools wordmark, Browse, Drafts, Graph, existing Reading List, compact search, and an overflow-safe mobile navigation. NU destinations remain available without crowding the header. Add a skip link and active navigation indication. Header search supports keyboard selection, Escape, Enter, and empty results. Every numbered and draft result opens its internal reader.

## Home and explorer

Keep the established home rhythm: compact Featured, network upgrades, existing Most viewed only when populated, height-capped 3D graph, daily ZIP, explorer. Put a concise page introduction and direct Browse ZIPs jump near the top so exploration is not hidden below discovery modules. The graph is a real visible home feature, not a link-only placeholder. Do not add a large promotional hero.

Desktop explorer: compact ZIP identifier, flexible primary linked title, bounded status, category, and NU columns. Numbered entries say ZIP N; draft entries say Draft with a readable title, not a long slug in the identifier column. Do not truncate proposal titles without an accessible way to read them. Revision statuses remain available with their original context; a single badge must not misrepresent a multi-revision ZIP.

Narrow explorer: stacked rows/cards containing title, identifier, status and secondary category/NU metadata. Only one representation should be exposed to assistive technology at a time. No document-level horizontal scroll.

Add result count, query/filter chips, Clear filters, and sort by number or title. Search covers number, title, owner; show matching owner context where helpful. Query keys: `q`, `kind`, `status`, `nu`, `category`, `sort`. Supported kind values: empty/all, numbered, draft. Sort: number or title; unknown values default to number. Apply exact selected status/NU/category semantics rather than unintended substring matches. URL updates are debounced for typing, preserve unrelated parameters and fragments, and honor browser back/forward. Empty results offer Clear filters, not an unexplained external-site link.

## Reader and content correctness

Wide layout at >=1280px: Contents rail, 65ch article, compact metadata sidebar. Intermediate width: article plus one compact rail if space permits; otherwise stacked. At <=767px: title, compact status/identity, collapsed Contents and metadata, article. ZIP number sits above the title. Metadata must not consume the first screen before content.

Preserve official, pinned GitHub, and discussion links in metadata. Unknown or incomplete dates remain source values; do not invent a missing day. Previous/next links have accessible names and skip unnumbered drafts. Keep existing bookmark capability without introducing accounts.

Build-time rendering remains authoritative. Normal release builds should use a documented RST converter for full fidelity. Missing/failed conversion retains source and a warning; the web reader shows a readable, explicitly degraded version, not null and not raw HTML injection. Reserve the external-only fallback for genuinely absent content. Source formatting fallback must not claim full RST fidelity.

Use an explicit additive `bodyFormat` discriminant (`html`, `markdown`, `rst-source`, `none`) while preserving existing `bodyKind` compatibility. Handle RST drafts as RST rather than assuming every draft is Markdown. Older snapshots without the discriminant remain readable through a compatibility adapter. Shared content preparation produces sanitized HTML and matching TOC entries, so TOC and article cannot disagree about heading IDs. Preserve existing IDs and avoid duplicates. Strip unsafe scripts, handlers, URLs, and embeds while retaining safe math/code markup. Resolve proposal links to in-app routes, preserve fragment targets, and resolve assets against the pinned source, not the moving upstream branch.

Exercise lists, code, math, references, tables, images, and footnotes against representative real source files. Tables/code/math may scroll inside the article, never widen the document. No live GitHub fetch is required to produce proposal text. The graph, summary, and optional Cloudflare bindings must not block reading.

## 3D citation graph

Reuse `ForceGraph3D` and its existing force-graph/three dependencies. Same component on home and `/graph`. Home preview capped at `min(70vh, 32rem)`; expanded route shares one viewport with header, toolbar, legend, and canvas using flex/min-height:0, not an extra 100vh below chrome.

Provide rotate/pan/zoom, focus by number/title, Zoom in/out, Reset, textual status legend, node label, and visible search-not-found feedback. Assigned node click navigates to its reader. Unassigned numbers are labeled and non-navigable. NU filtering retains assigned members and only connected dangling references; report counts. Citation direction is Cites / Cited by, never Requires.

Avoid page-scroll traps: home graph activation is explicit on touch; a visible exit/deactivate control restores page scrolling. Keyboard users get a searchable node list with equivalent links. Respect reduced motion and pause continuous animation when offscreen. Escape exits graph interaction mode, not the application.

Loading, initialization failure, late context loss, empty filtered data, and retry are distinct states. Failure shows useful titled citation lists and Browse/Retry actions. Do not continuously allocate probe WebGL contexts during React renders. A successful build or canvas element alone is not evidence of a functioning graph: browser acceptance requires visible nodes/edges and working camera/filter/navigation controls.

## Parallel delivery boundaries

A serial foundation owns shared contracts, dependencies, types, tokens, and test configuration. Then five isolated workstreams can run from the same reviewed foundation:
1. Content pipeline/preparation.
2. Reader surface.
3. Explorer.
4. Navigation/discovery components.
5. 3D graph.

The coordinator alone edits `app/**`, global styles/tokens, package manifests, lockfiles, shared contract fixtures, and CI. Workstream-owned files are disjoint. Agents build against frozen contracts and fixtures, not another agent's uncommitted files. The coordinator merges reviewed branches and integrates routes before browser acceptance.

## Acceptance

All source-backed records retain nonempty content on forced converter failure; full-converter and fallback modes are separately tested. ZIP 32, 312, and 317 read in-app; one Markdown ZIP and one actual draft also pass. TOC hash navigation, source links and technical formatting work. Browser checks cover 390, 768, and 1440px and keyboard navigation; no document overflow. Home and expanded 3D graphs render and respond, including retry/context-loss handling. Root tests and production build pass without live Cloudflare credentials. Existing reading-list and NU routes remain functional. Visual before/after screenshots and actual command output accompany the handoff.
