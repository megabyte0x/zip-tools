# ZIP.tools Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn v1 ZIP.tools into an eip.tools-like workbench: sticky chrome, 3D citation graph, readable ZIP pages, local reading list, ZIP of the day, anonymous most-viewed, and labeled generated summaries.

**Architecture:** Keep the Next.js App Router app and the build-time `zip-index.json`. Put every new rule in pure `packages/web/lib/*` functions tested with `tsx --test`. Cloudflare (OpenNext, D1, KV, Analytics Engine, Workers AI) is a late task; handlers are exported functions with a fake `env` so unit tests never need a live account. No login.

**Tech Stack:** Next.js 15 App Router, CSS modules + `lib/tokens.css`, `react-force-graph-3d` + `three`, OpenNext on Cloudflare Workers, D1, KV, Analytics Engine, Workers AI. No Chakra, no Tailwind, no OAuth.

**Spec:** `docs/superpowers/specs/2026-09-18-zip-tools-workbench-design.md`

## Global Constraints

- Complement zips.z.cash; always keep Official + GitHub links.
- Citation UI copy is **Cites / Cited by**, never Requires, unless a real `Requires` header produced that edge.
- No accounts, cookies for identity, OAuth, Farcaster, or Mongo.
- One UI system: CSS modules + tokens. Zcash gold accent, not Ethereum blue.
- Runtime proposal text comes only from the snapshot index.
- Conventional Commits on every commit: `type(scope): lowercase imperative`, no trailing period.
- Do not `git push` unless the human explicitly asks.
- Web tests stay `pnpm --filter @zip-tools/web test` (`tsx --test lib/*.test.ts`). If a task adds `lib/foo.test.ts`, the existing glob already picks it up — do not edit `package.json` `test` script except in the OpenNext task if a second test command is required.
- Do not invent reserved ZIP stubs. Drafts are `number === null`.

---

## File structure

```
packages/web/lib/test-zip.ts              # shared makeZip for tests
packages/web/lib/filter.ts                # add kind
packages/web/lib/searchSuggest.ts
packages/web/lib/headerModel.ts
packages/web/lib/readingList.ts
packages/web/lib/toc.ts
packages/web/lib/neighbors.ts
packages/web/lib/featured.ts
packages/web/lib/zipOfTheDay.ts
packages/web/lib/zipHref.ts
packages/web/lib/statusColor.ts
packages/web/lib/graphFallback.ts
packages/web/lib/views.ts
packages/web/lib/summary.ts
packages/web/components/SiteHeader.tsx
packages/web/components/HeaderSearch.tsx
packages/web/components/ReadingListButton.tsx
packages/web/components/ZipRail.tsx
packages/web/components/ZipOfTheDay.tsx
packages/web/components/ForceGraph3D.tsx
packages/web/components/GeneratedSummary.tsx
packages/web/components/ReaderShell.tsx
packages/web/app/list/page.tsx
packages/web/app/api/views/route.ts
packages/web/app/api/trending/route.ts
packages/web/app/api/summary/[id]/route.ts
packages/web/wrangler.jsonc
packages/web/open-next.config.ts
packages/web/migrations/0001_view_daily.sql
```

Modify: `app/layout.tsx`, `app/page.tsx`, `app/zips/page.tsx`, `app/graph/page.tsx`, `app/zip/[id]/page.tsx`, `app/draft/[slug]/page.tsx`, `components/ZipExplorer.tsx`, `components/ReaderBody.tsx`, `components/ZipMeta.tsx`, `lib/tokens.css`, `lib/filter.ts`, web `package.json` (deps only when a task needs them), root `package.json` only if a new workspace script is required in Task 9.

---

### Task 1: Shared test ZIP + `kind` filter + href helper

**Files:**
- Create: `packages/web/lib/test-zip.ts`
- Create: `packages/web/lib/zipHref.ts`
- Create: `packages/web/lib/zipHref.test.ts`
- Modify: `packages/web/lib/filter.ts`
- Modify: `packages/web/lib/filter.test.ts`

**Interfaces:**
- Consumes: `ZipRecord` from `lib/types.ts`
- Produces:
  - `makeZip(overrides?: Partial<ZipRecord>): ZipRecord`
  - `zipHref(zip: Pick<ZipRecord, "number" | "slug">): string` → `/zip/{number}` or `/draft/{slug}`
  - `ZipFilterQuery.kind?: "draft" | "numbered"`
  - `filterZips` drops drafts when `kind === "numbered"`, drops numbered when `kind === "draft"`

- [ ] **Step 1: Write the failing tests**

`packages/web/lib/zipHref.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { zipHref } from "./zipHref.ts";
import { makeZip } from "./test-zip.ts";

test("zipHref uses /zip/{number} for numbered ZIPs", () => {
  assert.equal(zipHref(makeZip({ number: 32, slug: "zip-0032" })), "/zip/32");
});

test("zipHref uses /draft/{slug} when number is null", () => {
  assert.equal(zipHref(makeZip({ number: null, slug: "draft-foo" })), "/draft/draft-foo");
});
```

Add to `packages/web/lib/filter.test.ts` (keep existing tests):

```ts
test("filterZips kind draft keeps only number === null", () => {
  const result = filterZips(zips, { kind: "draft" });
  assert.deepEqual(result.map((z) => z.id), ["draft-foo"]);
});

test("filterZips kind numbered drops drafts", () => {
  const result = filterZips(zips, { kind: "numbered" });
  assert.equal(result.some((z) => z.number === null), false);
});
```

Extract `makeZip` from `filter.test.ts` into `test-zip.ts` in the same change so both files import it. Do not leave two copies.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — `zipHref.ts` / `test-zip.ts` missing, `kind` ignored.

- [ ] **Step 3: Implement**

`zipHref.ts`:

```ts
import type { ZipRecord } from "./types";

export function zipHref(zip: Pick<ZipRecord, "number" | "slug">): string {
  return zip.number != null ? `/zip/${zip.number}` : `/draft/${zip.slug}`;
}
```

In `filter.ts` add `kind?: "draft" | "numbered"` to `ZipFilterQuery`. Inside the filter:

```ts
if (q.kind === "draft" && zip.number !== null) return false;
if (q.kind === "numbered" && zip.number === null) return false;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/test-zip.ts packages/web/lib/zipHref.ts packages/web/lib/zipHref.test.ts packages/web/lib/filter.ts packages/web/lib/filter.test.ts
git commit -m "feat(web): add zip href helper and draft kind filter"
```

---

### Task 2: Search suggestions and zips query parsing

**Files:**
- Create: `packages/web/lib/searchSuggest.ts`
- Create: `packages/web/lib/searchSuggest.test.ts`
- Create: `packages/web/lib/zipsQuery.ts`
- Create: `packages/web/lib/zipsQuery.test.ts`
- Modify: `packages/web/components/ZipExplorer.tsx`
- Modify: `packages/web/app/zips/page.tsx`

**Interfaces:**
- Consumes: `filterZips`, `zipHref`
- Produces:
  - `searchSuggestions(zips: ZipRecord[], text: string, limit = 8): { id: string; href: string; label: string }[]`
  - `parseZipsQuery(search: string): { text: string; kind: "draft" | "numbered" | "" }`
    - `q` → text
    - `kind=draft` → `"draft"`
    - anything else for kind → `""`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchSuggestions } from "./searchSuggest.ts";
import { parseZipsQuery } from "./zipsQuery.ts";
import { makeZip } from "./test-zip.ts";

const zips = [
  makeZip({ id: "32", number: 32, slug: "zip-0032", title: "Shielded HD Wallets" }),
  makeZip({ id: "317", number: 317, slug: "zip-0317", title: "Proportional Transfer Fee Mechanism" }),
  makeZip({ id: "draft-foo", number: null, slug: "draft-foo", title: "Draft Something" }),
];

test("searchSuggestions matches title and returns href plus label", () => {
  const hits = searchSuggestions(zips, "shielded");
  assert.deepEqual(hits, [
    { id: "32", href: "/zip/32", label: "32 — Shielded HD Wallets" },
  ]);
});

test("searchSuggestions caps at 8", () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    makeZip({ id: String(i + 1), number: i + 1, slug: `zip-${i + 1}`, title: `Alpha ${i}` }),
  );
  assert.equal(searchSuggestions(many, "alpha").length, 8);
});

test("searchSuggestions empty text returns []", () => {
  assert.deepEqual(searchSuggestions(zips, "  "), []);
});

test("parseZipsQuery reads q and kind=draft", () => {
  assert.deepEqual(parseZipsQuery("?q=32&kind=draft"), { text: "32", kind: "draft" });
});

test("parseZipsQuery unknown kind is empty", () => {
  assert.deepEqual(parseZipsQuery("?kind=nope"), { text: "", kind: "" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`searchSuggestions`: trim text; if empty return `[]`; `filterZips(zips, { text }).slice(0, limit)` mapped to `{ id, href: zipHref(zip), label: zip.number != null ? `${zip.number} — ${zip.title}` : zip.title }`.

`parseZipsQuery`: `const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)`; `kind` only if exactly `"draft"` or `"numbered"`.

Wire `ZipExplorer` to accept optional `initialText` and `initialKind`. `app/zips/page.tsx` is a server component: read `searchParams`, pass them in. Keep the component a client for live filtering; seed state from those props.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/searchSuggest.ts packages/web/lib/searchSuggest.test.ts packages/web/lib/zipsQuery.ts packages/web/lib/zipsQuery.test.ts packages/web/components/ZipExplorer.tsx packages/web/app/zips/page.tsx
git commit -m "feat(web): parse zips query and search suggestions"
```

---

### Task 3: Header model and sticky site chrome

**Files:**
- Create: `packages/web/lib/headerModel.ts`
- Create: `packages/web/lib/headerModel.test.ts`
- Create: `packages/web/components/SiteHeader.tsx`
- Create: `packages/web/components/SiteHeader.module.css`
- Create: `packages/web/components/HeaderSearch.tsx`
- Create: `packages/web/components/HeaderSearch.module.css`
- Modify: `packages/web/app/layout.tsx`
- Modify: `packages/web/app/layout.module.css`

**Interfaces:**
- Consumes: `searchSuggestions`, `headerModel`
- Produces:
  - `headerModel(index: { zips: ZipRecord[]; nus: NuEntry[] }): { zipCount: number; draftCount: number; nus: { id: string; href: string }[] }`
  - `zipCount` = zips with `number != null`
  - `draftCount` = zips with `number === null`
  - `nus` sorted by `id`, `href` = `/nu/${id}`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { headerModel } from "./headerModel.ts";
import { makeZip } from "./test-zip.ts";

test("headerModel counts numbered vs draft and lists NU hrefs", () => {
  const model = headerModel({
    zips: [
      makeZip({ number: 32 }),
      makeZip({ id: "d", number: null, slug: "draft-foo" }),
    ],
    nus: [
      { id: "nu7", title: "NU7", kind: "candidate", deploymentZip: null, zips: [] },
      { id: "nu6.2", title: "NU6.2", kind: "settled", deploymentZip: 257, zips: [257] },
    ],
  });
  assert.equal(model.zipCount, 1);
  assert.equal(model.draftCount, 1);
  assert.deepEqual(model.nus, [
    { id: "nu6.2", href: "/nu/nu6.2" },
    { id: "nu7", href: "/nu/nu7" },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — `headerModel.ts` missing.

- [ ] **Step 3: Implement header + layout**

Replace the text-only `<header>ZIP.tools</header>` with `SiteHeader`:

- sticky, existing surface/border tokens
- wordmark link `/`
- Reading List → `/list` (badge wired in Task 4; for now render `0` or omit badge)
- `ZIPs {zipCount}` → `/zips`
- `Drafts {draftCount}` → `/zips?kind=draft`
- `Graph` → `/graph`
- NU links from `model.nus`
- `HeaderSearch` client: input, suggestions list, Enter → first hit or `/zips?q=`

Pass slim zips (no `body`) into `HeaderSearch` from `layout.tsx` via `loadIndex()`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/headerModel.ts packages/web/lib/headerModel.test.ts packages/web/components/SiteHeader.tsx packages/web/components/SiteHeader.module.css packages/web/components/HeaderSearch.tsx packages/web/components/HeaderSearch.module.css packages/web/app/layout.tsx packages/web/app/layout.module.css
git commit -m "feat(web): add sticky workbench header"
```

---

### Task 4: Local reading list

**Files:**
- Create: `packages/web/lib/readingList.ts`
- Create: `packages/web/lib/readingList.test.ts`
- Create: `packages/web/components/ReadingListButton.tsx`
- Create: `packages/web/app/list/page.tsx`
- Create: `packages/web/app/list/page.module.css`
- Modify: `packages/web/components/SiteHeader.tsx` (badge)

**Interfaces:**
- Consumes: `zipHref`
- Produces:
  - `READING_LIST_KEY = "zip-tools.reading-list"`
  - `ReadingListItem = { id: string; title: string; href: string }`
  - `parseReadingList(raw: string | null): ReadingListItem[]` — invalid JSON → `[]`
  - `addToReadingList(items, item, max = 200)` — if id exists, move to front; if over max, drop oldest (end)
  - `removeFromReadingList(items, id)`
  - `shareReadingList(origin: string, items: ReadingListItem[]): string` — newline-separated `origin + href`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseReadingList,
  addToReadingList,
  removeFromReadingList,
  shareReadingList,
} from "./readingList.ts";

test("parseReadingList returns [] for null or invalid JSON", () => {
  assert.deepEqual(parseReadingList(null), []);
  assert.deepEqual(parseReadingList("{"), []);
});

test("addToReadingList prepends and drops oldest past 200", () => {
  const existing = Array.from({ length: 200 }, (_, i) => ({
    id: String(i),
    title: `t${i}`,
    href: `/zip/${i}`,
  }));
  const next = addToReadingList(existing, { id: "x", title: "X", href: "/zip/9" }, 200);
  assert.equal(next.length, 200);
  assert.equal(next[0].id, "x");
  assert.equal(next[199].id, "198");
});

test("shareReadingList joins absolute URLs", () => {
  assert.equal(
    shareReadingList("https://zip.tools", [{ id: "32", title: "HD", href: "/zip/32" }]),
    "https://zip.tools/zip/32",
  );
});
```

Also test `removeFromReadingList` and duplicate-id move-to-front.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement lib + `/list` + bookmark button**

`/list` is a client page: read localStorage, list links, empty copy exactly: `Bookmarks stay in this browser.` If `localStorage` throws, same empty state plus `Storage is unavailable.`

Share button copies `shareReadingList(location.origin, items)`.

`ReadingListButton` used later on the reader; header badge reads list length on mount.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/readingList.ts packages/web/lib/readingList.test.ts packages/web/components/ReadingListButton.tsx packages/web/app/list packages/web/components/SiteHeader.tsx
git commit -m "feat(web): add localStorage reading list"
```

---

### Task 5: TOC from HTML and Markdown

**Files:**
- Create: `packages/web/lib/toc.ts`
- Create: `packages/web/lib/toc.test.ts`
- Modify: `packages/web/components/ReaderBody.tsx`
- Modify: `packages/web/components/ReaderBody.module.css`

**Interfaces:**
- Consumes: reader `body` / `bodyKind`
- Produces:
  - `TocEntry = { id: string; text: string; level: 2 | 3 }`
  - `slugifyHeading(text: string): string` — lowercase, keep `[a-z0-9]`, hyphens for gaps, collapse repeats
  - `tocFromHtml(html: string): { html: string; toc: TocEntry[] }` — inject `id` on h2/h3 if missing; collisions get `-2`, `-3`
  - `tocFromMarkdown(md: string): TocEntry[]` — ATX `##` / `###` only
  - Ignore h1 and h4+

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugifyHeading, tocFromHtml, tocFromMarkdown } from "./toc.ts";

test("slugifyHeading lowercases and hyphenates", () => {
  assert.equal(slugifyHeading("Abstract (ZIP 32)"), "abstract-zip-32");
});

test("tocFromHtml injects ids and suffixes collisions", () => {
  const { html, toc } = tocFromHtml("<h2>Intro</h2><p>x</p><h2>Intro</h2><h3>Details</h3>");
  assert.deepEqual(toc.map((e) => e.id), ["intro", "intro-2", "details"]);
  assert.match(html, /id="intro"/);
  assert.match(html, /id="intro-2"/);
});

test("tocFromMarkdown reads ATX h2 and h3", () => {
  const toc = tocFromMarkdown("## Motivation\n\ntext\n\n### Why\n");
  assert.deepEqual(toc, [
    { id: "motivation", text: "Motivation", level: 2 },
    { id: "why", text: "Why", level: 3 },
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — `toc.ts` missing.

- [ ] **Step 3: Implement toc + ReaderBody ids**

For HTML mode, run `tocFromHtml` and set `dangerouslySetInnerHTML` to the rewritten HTML. For markdown mode, compute `tocFromMarkdown` for the sidebar (Task 6); add a `rehype` plugin or map headings in `ReactMarkdown` `components` to set `id={slugifyHeading(...)}` with the same collision map.

Do not invent a second slug algorithm.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/toc.ts packages/web/lib/toc.test.ts packages/web/components/ReaderBody.tsx packages/web/components/ReaderBody.module.css
git commit -m "feat(web): derive heading ids and toc entries"
```

---

### Task 6: Reader shell, prev/next, bookmark

**Files:**
- Create: `packages/web/lib/neighbors.ts`
- Create: `packages/web/lib/neighbors.test.ts`
- Create: `packages/web/components/ReaderShell.tsx`
- Create: `packages/web/components/ReaderShell.module.css`
- Modify: `packages/web/app/zip/[id]/page.tsx`
- Modify: `packages/web/app/draft/[slug]/page.tsx`
- Modify: `packages/web/components/ZipMeta.module.css`
- Modify: `packages/web/lib/tokens.css` (status chip vars if needed)

**Interfaces:**
- Consumes: `tocFromHtml` / `tocFromMarkdown`, `readingList`, `zipHref`
- Produces:
  - `prevNext(zips: ZipRecord[], number: number): { prev: ZipRecord | null; next: ZipRecord | null }`
  - numbered zips only, sorted by `number` ascending
  - drafts: caller does not invoke `prevNext`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { prevNext } from "./neighbors.ts";
import { makeZip } from "./test-zip.ts";

const zips = [
  makeZip({ number: 1, title: "A" }),
  makeZip({ number: null, slug: "draft-x" }),
  makeZip({ number: 3, title: "C" }),
  makeZip({ number: 2, title: "B" }),
];

test("prevNext skips drafts and uses numeric order", () => {
  const { prev, next } = prevNext(zips, 2);
  assert.equal(prev?.number, 1);
  assert.equal(next?.number, 3);
});

test("prevNext at ends returns null", () => {
  assert.equal(prevNext(zips, 1).prev, null);
  assert.equal(prevNext(zips, 3).next, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — `neighbors.ts` missing.

- [ ] **Step 3: Implement ReaderShell**

Wide layout (`min-width: 1100px`): CSS grid `toc | article | meta`. Article `max-width: 65ch`. Meta `position: sticky; top: 4.5rem`. TOC sticky in its column; `max-height: calc(100vh - 6rem); overflow: auto`. Below `1100px`: meta first, TOC as `<details><summary>Contents</summary>`.

Prev/next: icon buttons, `title={`ZIP ${n}: ${title}`}`. Drafts omit them.

Place `ReadingListButton` in the meta column.

Keep `CitationGraph` under the body.

ReaderBody: `line-height: 1.6`; `pre, table { overflow-x: auto; }`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/neighbors.ts packages/web/lib/neighbors.test.ts packages/web/components/ReaderShell.tsx packages/web/components/ReaderShell.module.css packages/web/app/zip/[id]/page.tsx packages/web/app/draft/[slug]/page.tsx packages/web/components/ZipMeta.module.css packages/web/lib/tokens.css
git commit -m "feat(web): add reader toc column prev-next and bookmark"
```

---

### Task 7: Featured rail and ZIP of the day

**Files:**
- Create: `packages/web/lib/featured.ts`
- Create: `packages/web/lib/featured.test.ts`
- Create: `packages/web/lib/zipOfTheDay.ts`
- Create: `packages/web/lib/zipOfTheDay.test.ts`
- Create: `packages/web/components/ZipRail.tsx`
- Create: `packages/web/components/ZipRail.module.css`
- Create: `packages/web/components/ZipOfTheDay.tsx`
- Create: `packages/web/components/ZipOfTheDay.module.css`
- Modify: `packages/web/app/page.tsx`
- Modify: `packages/web/app/page.module.css`

**Interfaces:**
- Consumes: `ZipIndexFile`, `zipHref`
- Produces:
  - `featuredZips(index: ZipIndexFile, recentLimit = 12): ZipRecord[]`
    - candidate NU numbers ∪ 12 numbered zips with latest `created` (null created sort last)
    - dedupe by number, sort `created` desc then number desc
  - `zipOfTheDay(zips: ZipRecord[], utcDate: string): ZipRecord | null`
    - numbered only, sort by number
    - index = `SHA-256("zip-of-the-day:" + utcDate)` as bigint `mod count`
    - empty numbered list → `null`
  - `utcDate` format `YYYY-MM-DD`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { featuredZips } from "./featured.ts";
import { zipOfTheDay } from "./zipOfTheDay.ts";
import { makeZip } from "./test-zip.ts";

test("featuredZips unions candidate NU zips with recent created", () => {
  const index = {
    snapshot: { sha: "abc", date: "2026-01-01", url: "" },
    dangling: [],
    nus: [{ id: "nu7", title: "NU7", kind: "candidate" as const, deploymentZip: null, zips: [2] }],
    zips: [
      makeZip({ id: "1", number: 1, created: "2020-01-01", title: "Old" }),
      makeZip({ id: "2", number: 2, created: "2019-01-01", title: "Candidate" }),
      makeZip({ id: "3", number: 3, created: "2024-06-01", title: "New" }),
      makeZip({ id: "d", number: null, slug: "draft-x" }),
    ],
  };
  const featured = featuredZips(index, 1);
  assert.deepEqual(featured.map((z) => z.number), [3, 2]);
});

test("zipOfTheDay is stable for a fixed UTC date", () => {
  const zips = [1, 2, 3, 4, 5].map((n) => makeZip({ id: String(n), number: n, title: `Z${n}` }));
  const a = zipOfTheDay(zips, "2026-09-18");
  const b = zipOfTheDay(zips, "2026-09-18");
  assert.equal(a?.number, b?.number);
  assert.equal(zipOfTheDay([], "2026-09-18"), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

Use `crypto.createHash("sha256")` in `zipOfTheDay.ts` (Node/OpenNext). Do not use `Math.random` for the daily pick.

Home order after this task (graph/trending come later): Featured, existing NU boards, ZIP of the day, explorer.

ZIP of the day: metadata table (status, category, owners, created, discussions). Random ZIP is a client button that `useRouter().push` to a numbered ZIP other than the daily one when `count > 1`.

ZipRail: horizontal scroll, card = number, title, status label.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/featured.ts packages/web/lib/featured.test.ts packages/web/lib/zipOfTheDay.ts packages/web/lib/zipOfTheDay.test.ts packages/web/components/ZipRail.tsx packages/web/components/ZipRail.module.css packages/web/components/ZipOfTheDay.tsx packages/web/components/ZipOfTheDay.module.css packages/web/app/page.tsx packages/web/app/page.module.css
git commit -m "feat(web): add featured rail and zip of the day"
```

---

### Task 8: 3D citation graph on home and `/graph`

**Files:**
- Create: `packages/web/lib/statusColor.ts`
- Create: `packages/web/lib/statusColor.test.ts`
- Create: `packages/web/lib/graphFallback.ts`
- Create: `packages/web/lib/graphFallback.test.ts`
- Create: `packages/web/components/ForceGraph3D.tsx`
- Create: `packages/web/components/ForceGraph3D.module.css`
- Modify: `packages/web/app/page.tsx`
- Modify: `packages/web/app/graph/page.tsx`
- Modify: `packages/web/package.json` (add `three`, `react-force-graph-3d`, `@types/three`)

**Interfaces:**
- Consumes: index zips, `neighborhood` / citations, existing `GlobalCitationGraph` lists as fallback
- Produces:
  - `statusColor(label: string): string` — map Draft/Proposed/Active/Final/Withdrawn/Rejected/Obsolete/Reserved to distinct hex from tokens; unknown → `--color-muted` hex `#a3a091`
  - `GRAPH_HELP = "Left-click: rotate, Mouse-wheel: zoom, Right-click: pan"`
  - `GRAPH_UNAVAILABLE = "Citation graph is unavailable in this browser."`
  - `graphRecords(zips: ZipRecord[], dangling: number[]): { nodes: { id: number; title: string; unassigned: boolean; status: string }[]; links: { source: number; target: number }[] }`
  - links from `zip.citations` (from → to), skip self, include dangling as unassigned nodes

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { statusColor } from "./statusColor.ts";
import { GRAPH_HELP, GRAPH_UNAVAILABLE, graphRecords } from "./graphFallback.ts";
import { makeZip } from "./test-zip.ts";

test("statusColor is stable and labeled statuses differ", () => {
  assert.notEqual(statusColor("Draft"), statusColor("Final"));
  assert.equal(statusColor("NotAStatus"), "#a3a091");
});

test("graphRecords builds cites edges and dangling nodes", () => {
  const g = graphRecords(
    [makeZip({ number: 1, citations: [2, 99], status: [{ label: "Final" }] })],
    [99],
  );
  assert.equal(g.nodes.some((n) => n.id === 99 && n.unassigned), true);
  assert.deepEqual(g.links, [{ source: 1, target: 2 }, { source: 1, target: 99 }]);
});

test("graph copy constants match spec", () => {
  assert.equal(GRAPH_HELP, "Left-click: rotate, Mouse-wheel: zoom, Right-click: pan");
  assert.equal(GRAPH_UNAVAILABLE, "Citation graph is unavailable in this browser.");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement ForceGraph3D**

Client component. Class error boundary: on throw, render `GRAPH_UNAVAILABLE`, Cites/Cited-by lists from `graphRecords` (as number lists), buttons **Try again** (reset error) and **Browse ZIPs** (`/zips`). On `/graph` also **Home**.

Happy path: `react-force-graph-3d` with `nodeLabel`, `nodeColor` from `statusColor(status)`, `onNodeClick` → `router.push(/zip/${id})` only if `!unassigned`. Controls: search input focusing/camera to node, zoom in/out, reset. Legend of status labels.

Home: section after NU boards (before ZIP of the day), height `min(70vh, 32rem)`, heading “Citation graph”, link to `/graph`. `/graph`: full viewport height, keep NU filter by filtering zips before `graphRecords`.

`pnpm --filter @zip-tools/web add three react-force-graph-3d` and `pnpm --filter @zip-tools/web add -D @types/three`.

Do not label edges Requires.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/statusColor.ts packages/web/lib/statusColor.test.ts packages/web/lib/graphFallback.ts packages/web/lib/graphFallback.test.ts packages/web/components/ForceGraph3D.tsx packages/web/components/ForceGraph3D.module.css packages/web/app/page.tsx packages/web/app/graph/page.tsx packages/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add 3d citation graph on home and graph page"
```

---

### Task 9: OpenNext + wrangler bindings (local stubs)

**Files:**
- Create: `packages/web/wrangler.jsonc`
- Create: `packages/web/open-next.config.ts`
- Create: `packages/web/migrations/0001_view_daily.sql`
- Modify: `packages/web/package.json`
- Modify: `packages/web/next.config.ts` if OpenNext requires it

**Interfaces:**
- Consumes: none of the product APIs yet
- Produces: local `wrangler dev` / OpenNext preview path; bindings named `DB`, `KV`, `AI`, `VIEWS` (Analytics Engine)

- [ ] **Step 1: Write a failing config test**

Create `packages/web/lib/cloudflareBindings.test.ts` that reads `wrangler.jsonc` (strip `//` comments or use a tiny parser) and asserts:

- `d1_databases[0].binding === "DB"`
- `kv_namespaces[0].binding === "KV"`
- `ai.binding === "AI"`
- `vars.SUMMARY_MODEL === "@cf/meta/llama-3.1-8b-instruct"`
- `triggers.crons` includes `"0 * * * *"`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — wrangler file missing.

- [ ] **Step 3: Implement**

`migrations/0001_view_daily.sql`:

```sql
CREATE TABLE IF NOT EXISTS view_daily (
  zip_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (zip_id, day)
);
```

Add `@opennextjs/cloudflare` and `wrangler` as devDependencies. Scripts:

- `"preview": "opennextjs-cloudflare build && wrangler dev"`
- keep `"dev": "next dev"` for UI work without bindings

Document in `packages/web` README only if one already exists; otherwise skip README (YAGNI).

Site without bindings must still `next build`. Do not put secrets in wrangler.jsonc.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/wrangler.jsonc packages/web/open-next.config.ts packages/web/migrations/0001_view_daily.sql packages/web/lib/cloudflareBindings.test.ts packages/web/package.json pnpm-lock.yaml packages/web/next.config.ts
git commit -m "build(web): add opennext wrangler bindings and view schema"
```

---

### Task 10: Anonymous views, rollup, most-viewed rail

**Files:**
- Create: `packages/web/lib/views.ts`
- Create: `packages/web/lib/views.test.ts`
- Create: `packages/web/app/api/views/route.ts`
- Create: `packages/web/app/api/trending/route.ts`
- Create: `packages/web/components/ViewBeacon.tsx`
- Modify: `packages/web/app/page.tsx`
- Modify: `packages/web/app/zip/[id]/page.tsx`
- Modify: `packages/web/app/draft/[slug]/page.tsx`

**Interfaces:**
- Consumes: D1 `view_daily`, KV dedup, Analytics Engine write
- Produces:
  - `viewDedupKey(id: string, ipHash: string): string` → `view:${id}:${ipHash}`
  - `hashIp(ip: string): Promise<string>` SHA-256 hex, first 16 chars
  - `rollupEvents(events: { zipId: string; day: string }[]): { zip_id: string; day: string; count: number }[]`
  - `trendingFromDaily(rows: { zip_id: string; day: string; count: number }[], todayUtc: string, limit = 12): { id: string; count: number }[]`
    - include days `todayUtc` back through `today-6`
  - `handleViewsPost(request, env, nowMs): Promise<Response>`
  - `handleTrendingGet(env, todayUtc): Promise<Response>`
  - `handleScheduledRollup(env, events): Promise<void>` — upserts D1

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { rollupEvents, trendingFromDaily, viewDedupKey } from "./views.ts";

test("viewDedupKey format", () => {
  assert.equal(viewDedupKey("32", "abcd"), "view:32:abcd");
});

test("rollupEvents groups by zip and day", () => {
  const rows = rollupEvents([
    { zipId: "32", day: "2026-09-18" },
    { zipId: "32", day: "2026-09-18" },
    { zipId: "1", day: "2026-09-17" },
  ]);
  assert.deepEqual(
    rows.sort((a, b) => a.zip_id.localeCompare(b.zip_id)),
    [
      { zip_id: "1", day: "2026-09-17", count: 1 },
      { zip_id: "32", day: "2026-09-18", count: 2 },
    ],
  );
});

test("trendingFromDaily sums last 7 UTC days and caps at 12", () => {
  const top = trendingFromDaily(
    [
      { zip_id: "32", day: "2026-09-18", count: 3 },
      { zip_id: "32", day: "2026-09-12", count: 9 },
      { zip_id: "1", day: "2026-09-17", count: 4 },
    ],
    "2026-09-18",
    12,
  );
  assert.deepEqual(top, [
    { id: "1", count: 4 },
    { id: "32", count: 3 },
  ]);
});
```

Add a fake-env test for `handleViewsPost`: first call writes; second call with same id and ip within 1800s returns 204 without a second write. Missing id → 400.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — `views.ts` missing.

- [ ] **Step 3: Implement**

`POST /api/views` body `{ id: string }`. On CF, write Analytics Engine point and set KV TTL 1800. On missing bindings, return 204 (page still works). Never store raw IP.

`GET /api/trending` reads D1; empty array → `{ items: [] }`.

`ViewBeacon` client: `useEffect` POST once per mount. Reader pages render it.

Home: if trending items nonempty, ZipRail titled `Most viewed (7 days)` after NU boards, before the graph. Hide the section when empty.

Scheduled: wrangler cron calls `handleScheduledRollup`. For unit tests, pass synthetic `events` rather than querying Analytics Engine.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/views.ts packages/web/lib/views.test.ts packages/web/app/api/views/route.ts packages/web/app/api/trending/route.ts packages/web/components/ViewBeacon.tsx packages/web/app/page.tsx packages/web/app/zip/[id]/page.tsx packages/web/app/draft/[slug]/page.tsx
git commit -m "feat(web): record anonymous views and most-viewed rail"
```

---

### Task 11: Generated summary API and accordion

**Files:**
- Create: `packages/web/lib/summary.ts`
- Create: `packages/web/lib/summary.test.ts`
- Create: `packages/web/app/api/summary/[id]/route.ts`
- Create: `packages/web/components/GeneratedSummary.tsx`
- Create: `packages/web/components/GeneratedSummary.module.css`
- Modify: `packages/web/components/ReaderShell.tsx`

**Interfaces:**
- Consumes: index body, KV, Workers AI
- Produces:
  - `summaryCacheKey(snapshotSha: string, id: string): string` → `{sha}:{id}`
  - `buildSummaryPrompt(title: string, body: string): string` — includes “≤ 120 words” and “do not invent status or NU membership”; body truncated to 12_000 chars
  - `handleSummaryGet(id, env, loadZip): Promise<Response>`
    - unknown id → 404
    - `body == null` → 422 `{ error: "needs-body" }`
    - KV hit → 200 `{ text, generated: true, cached: true }`
    - model fail → 503 `{ error: "unavailable" }`
    - success → 200 `{ text, generated: true, cached: false }` and KV put with 30-day expiration

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { summaryCacheKey, buildSummaryPrompt } from "./summary.ts";

test("summaryCacheKey joins sha and id", () => {
  assert.equal(summaryCacheKey("abc", "32"), "abc:32");
});

test("buildSummaryPrompt truncates body to 12000 and forbids invented status", () => {
  const prompt = buildSummaryPrompt("Title", "x".repeat(13000));
  assert.ok(prompt.includes("do not invent status or NU membership"));
  assert.ok(prompt.includes("120 words"));
  assert.ok(!prompt.includes("x".repeat(12001)));
});
```

Fake-env: null body → 422; KV hit skips AI; AI throw → 503.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @zip-tools/web test`
Expected: FAIL — `summary.ts` missing.

- [ ] **Step 3: Implement accordion**

Visible title: `Generated summary`. Always include the word `generated`. Failure copy: `Summary is unavailable.` + Retry. `needs-body`: `A summary needs an in-app body.` plus the existing official CTA (do not duplicate a second “Open on zips.z.cash” if ReaderBody already shows it — say it in the accordion only when mode is fallback).

Place accordion below ZipMeta, above the body.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @zip-tools/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/summary.ts packages/web/lib/summary.test.ts packages/web/app/api/summary packages/web/components/GeneratedSummary.tsx packages/web/components/GeneratedSummary.module.css packages/web/components/ReaderShell.tsx
git commit -m "feat(web): add generated zip summary accordion"
```

---

### Task 12: CI and production build wiring

**Files:**
- Modify: `.github/workflows/ci.yml` only if a new command is required
- Modify: root `package.json` only if adding `"preview"`
- Modify: `packages/web/package.json` `build` if OpenNext should be the production build

**Interfaces:**
- Consumes: all previous tasks
- Produces: CI still runs indexer tests, web tests, real-snapshot index smoke, `next build` (or OpenNext build if Task 9 made that the `build` script)

- [ ] **Step 1: Run the full local gate**

Run:

```bash
pnpm test
pnpm --filter @zip-tools/web build
```

Expected: PASS. If OpenNext build is now `build`, run that instead and keep a `next build` sanity check if it still exists.

- [ ] **Step 2: Fix any failures caused by missing exports or CSS**

Do not weaken tests.

- [ ] **Step 3: Commit only if CI files or scripts changed**

```bash
git add .github/workflows/ci.yml package.json packages/web/package.json
git commit -m "ops: wire workbench tests into ci build"
```

If nothing changed, skip the commit.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Sticky header, counts, NU links, search suggestions | 3, 2 |
| `/zips?q=` and `kind=draft` | 1, 2 |
| Reading list localStorage, `/list`, cap 200, share URLs | 4 |
| Reader TOC, 65ch, sticky meta, prev/next, bookmark | 5, 6 |
| Featured rail rules | 7 |
| ZIP of the day SHA-256 UTC, Random ZIP | 7 |
| 3D graph home + `/graph`, help text, fallback copy, no Requires | 8 |
| OpenNext, D1 schema, bindings, cron | 9 |
| Anonymous views, 30 min dedup, most-viewed hide if empty | 10 |
| Generated summary cache, 12k truncate, labeled, 422 on null body | 11 |
| CI / build | 12 |
| No login | all (no auth files) |

No TBD in tasks. Types: `kind` is `"draft" | "numbered"`, cache key `{sha}:{id}`, dedup `view:{id}:{ipHash}`.
