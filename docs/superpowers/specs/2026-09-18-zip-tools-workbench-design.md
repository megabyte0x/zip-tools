# ZIP.tools workbench design

Date: 2026-09-18
Status: approved in chat (architecture, chrome, home, reader, data/errors/testing)
Supersedes in part: `docs/superpowers/specs/2026-09-18-zip-tools-design.md`

## Goal

Give ZIP.tools the workbench capabilities of [eip.tools](https://eip.tools) without cloning its chrome, stack, or Ethereum identity: search, browse, read, bookmark locally, map citations in 3D, show a daily ZIP, show anonymous most-viewed, and offer a generated summary.

This is a v1 follow-on. The indexer, snapshot pin, NU overlay, official/GitHub links, and Cites / Cited by labeling stay as in the v1 spec.

## What this supersedes

v1 non-goals that this spec **reopens**:

- Generated summaries (ZIP-GPT analogue)
- View counts and a most-viewed rail
- Reading list (local only)

v1 non-goals that this spec **keeps**:

- No accounts, no login, no OAuth, no Farcaster/Neynar
- No MongoDB
- No forking EIPTools/eip-tools
- No pixel-parity with eip.tools
- No live GitHub or HTML scrape on the proposal-text path
- MCP still v2
- Copy for citation edges remains **Cites / Cited by**, never Requires, unless a real `Requires` header produced that edge

## Product shape

ZIP.tools remains a dark, dense Zcash-adjacent workbench (existing tokens: near-black canvas, gold accent). One UI system: CSS modules + `packages/web/lib/tokens.css`. No Chakra, no Tailwind.

Deploy the existing Next.js App Router app with OpenNext on Cloudflare Workers. Runtime proposal bodies still come only from the build-time index.

## Architecture

```
zcash/zips pin
    → zip-index build
    → zip-index.json + rendered bodies
    → Next.js (OpenNext on Cloudflare Workers)
         ├─ KV          summary cache (zip id + snapshot SHA)
         ├─ D1          daily view rollups only
         ├─ Analytics Engine  anonymous view events
         └─ Workers AI  on-demand ZIP summary
```

No users table. No session cookies. No GitHub OAuth.

Local/dev: `wrangler dev` with local D1/KV. Summaries may use remote Workers AI or a stub that returns a fixed string. The site without Cloudflare bindings still renders reader, graph, search, NU boards, ZIP of the day, and localStorage reading list. Auth is absent by design. Trending and GPT degrade (hidden rail / accordion error).

## Site chrome

Sticky header on every page.

- Wordmark `ZIP.tools` → `/`
- Reading List → `/list` (count badge from localStorage)
- ZIPs (count of numbered records) → `/zips`
- Drafts (count of `number === null`) → `/zips?kind=draft`
- Graph → `/graph`
- NU ids from the overlay as compact text links → `/nu/:id`
- Header search: compact at rest; suggestions of number/title/owner (max 8) while typing. Enter or choosing a hit navigates to `/zip/:id` or `/draft/:slug`. No hit → `/zips?q=`

On `/zips` and home explorer, the existing SearchBand (status / NU / category) stays below the header. On reader pages, only header search is shown.

Footer unchanged: `zcash/zips` short SHA, commit date, link to that commit. No login chrome. No social clone of eip.tools.

## Routes (additive)

| Path | Purpose |
|---|---|
| `/` | Featured, NU boards, most-viewed (if data), 3D graph preview, ZIP of the day, explorer |
| `/zips` | Filterable table; honors `q` and `kind=draft` |
| `/list` | Local reading list |
| `/graph` | Full-viewport 3D citation graph |
| `/zip/:id` | Reader |
| `/draft/:slug` | Draft reader |
| `/nu/:id` | NU board (unchanged) |
| `/api/views` | POST anonymous view |
| `/api/summary/:id` | GET generated summary |
| `/api/trending` | GET last-7-day rollup |

## Home page

Order:

1. Header
2. **Featured** — horizontal rail. Source: union of NU `kind === "candidate"` ZIP numbers plus the 12 most recently `created` numbered ZIPs in the snapshot (dedupe, stable sort by created desc then number desc). Card: number, title, status chip (label always present). Click → reader. Not view-count based.
3. **Network upgrades** — existing NU boards.
4. **Most viewed (7 days)** — from D1 rollups via `/api/trending`. Hide the whole rail when the list is empty (fresh deploy). Cards same shape as Featured. This is the eip.tools trending analogue without identity.
5. **Citation graph** — 3D preview (see Graph). Heading “Citation graph” with a control that goes to `/graph`. Helper text: `Left-click: rotate, Mouse-wheel: zoom, Right-click: pan`. Status color legend with text labels. In-graph search, zoom +/-, reset.
6. **ZIP of the day** — deterministic: among numbered ZIPs sorted by number, index = `SHA-256("zip-of-the-day:" + YYYY-MM-DD) mod count` in UTC. Show title, status, category, owners, created, discussions. **Random ZIP** is a client-side pick of a different numbered ZIP (not the daily one if count > 1).
7. **Explorer** — existing SearchBand + table. Empty query shows the full list.

## Graph

Library: `react-force-graph-3d` + `three`. Nodes = ZIP records plus dangling Unassigned numbers. Edges = citations. Node color by primary status label (first `status[].label`), with a legend. Click assigned node → `/zip/:id`. Unassigned: not a link.

Home: height-capped preview of the full corpus. `/graph`: same component, full viewport height, plus the existing NU filter.

If WebGL or canvas init throws: contain the error in the graph surface. Show Cites / Cited by lists for a depth-1 merge of the (optionally NU-filtered) corpus, plus **Try again** and **Browse ZIPs**. On `/graph` also offer **Home**. Metadata and the rest of the page stay.

Keep the existing 2D SVG neighborhood (lists + diagram, depth 1/2) on the ZIP reader. Do not put the 3D globe on the reader.

## Reader

Routes `/zip/:id` and `/draft/:slug`.

Wide (≥ 1100px): left TOC, center prose with max-width 65ch, right sticky ZipMeta.
Narrow: ZipMeta above the body; TOC is a collapsed “Contents” disclosure.

Body: existing MD/HTML/fallback. Heading scale and tables/code overflow inside the column. Official / GitHub / Discussions stay in ZipMeta. Status chips always include the text label.

TOC: h2 and h3 in the rendered body. Stable ids (slug from heading text; suffix `-2`, `-3` on collision). Scroll-spy. Desktop TOC pins in the left gutter after the header scrolls away and must not overlap the footer. Mobile TOC does not pin.

Prev/next: among numbered ZIPs sorted by number. Icon controls; tooltip is `ZIP {n}: {title}`. Drafts have no prev/next.

Bookmark: toggles the local reading list. Visual selected/unselected state. No server.

ZIP-GPT analogue: accordion **Generated summary** below ZipMeta and above the body. Always labeled generated. `GET /api/summary/:id`. KV cache key `{snapshotSha}:{id}`. Miss → Workers AI with the ZIP title + body text (truncate body to 12_000 characters). Failure: error copy + Retry; body and meta unchanged. If `body` is null, do not call the model; accordion states that a summary needs an in-app body and keeps **Open on zips.z.cash**.

Neighborhood graph remains under the body.

## Reading list

`localStorage` key `zip-tools.reading-list`. Value: JSON array of `{ id: string, title: string, href: string }` (id is ZIP id or draft slug). Max 200 entries; adding past the cap drops the oldest. `/list` renders the array; empty state explains bookmarks are local to this browser. Share is copy-as-URL-list (newline-separated absolute paths on this origin), not a hosted list.

## Cloudflare data

**Analytics Engine**  
After a successful reader paint, `POST /api/views` with `{ id }`. Worker writes a point: blob zip id, index 1. No cookies. Failures are dropped; the page still renders. Dedup is best-effort: ignore a second POST for the same `{id}` from the same client within 30 minutes via a KV key `view:{id}:{ip-hash}` TTL 1800s. IP is used only for that hash and is not stored in D1.

**D1**  
Table `view_daily (zip_id TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (zip_id, day))`.

Scheduled Worker hourly: query Analytics Engine for the last 7 UTC days, group by zip id and UTC day, upsert each group into `view_daily`. `/api/trending` sums `count` for `day >= today-6` UTC, returns top 12 `{ id, count }` joined to index titles in the Next app. Empty → hide rail.

**KV**  
Summary cache only (plus the short-lived view-dedup keys). Purge summaries by writing a new snapshot SHA in the key; old keys expire after 30 days.

**Workers AI**  
Binding `AI`. Model from wrangler var `SUMMARY_MODEL`, default `@cf/meta/llama-3.1-8b-instruct`. Prompt: summarize this ZIP for a protocol reader in ≤ 120 words; do not invent status or NU membership. Output is never treated as canonical ZIP text.

**Secrets**  
None required for v1 of this workbench (no OAuth). If AI Gateway is pointed at a BYO key later, that key is `wrangler secret`, never committed.

## Errors (normative)

| Case | Behavior |
|---|---|
| Graph WebGL/canvas throw | Graph surface lists + Try again + Browse ZIPs; `/graph` also Home |
| Summary model/KV fail | Accordion error + Retry; body stays |
| `body` null | No model call; fallback CTA unchanged |
| View ingest fail | Drop event |
| D1 empty | Hide most-viewed rail |
| Unknown `/zip/:id` | Existing 404 |
| Header search no hits | `/zips?q=` |
| localStorage unavailable | Bookmark no-ops; `/list` empty state says storage is unavailable |

## Testing

Web unit tests (`tsx --test` in `packages/web`) cover:

- Header destinations and counts
- Search suggestions and `/zips?q=` / `kind=draft`
- TOC ids, collision suffix, hash targets
- Reading list add/remove/cap/share lines
- ZIP of the day stable for a fixed UTC date and numbered-ZIP list
- Graph error-boundary copy
- Featured rail membership rules
- Prev/next neighbors

Worker tests (`vitest` + `@cloudflare/vitest-pool-workers`) cover:

- `POST /api/views` writes a point; second POST within TTL does not double-count
- Summary: cache hit, model fail, null-body ZIP skipped
- Trending rollup: N events → D1 count → `/api/trending` order

CI: existing indexer + web tests, plus worker tests. OpenNext build is part of `pnpm run build` once wired. Do not require a live Cloudflare account for unit tests.

## Implementation order (for the plan)

1. Header, search suggestions, query-param filters
2. Reading list (localStorage + `/list`)
3. Reader layout, TOC, prev/next, bookmark
4. ZIP of the day + Random + Featured rail
5. 3D graph on `/` and `/graph` with error boundary
6. OpenNext + wrangler bindings (local stubs)
7. Views + D1 rollup + most-viewed rail
8. Summary API + reader accordion
9. CI / build wiring

## Open decisions closed by this spec

- Envelope: eip.tools workbench features, not a visual clone
- No login of any kind
- Reading list is localStorage only
- Backend is Cloudflare (OpenNext + D1 + KV + Analytics Engine + Workers AI)
- 3D graph on home and `/graph`; reader keeps 2D neighborhood
- Most-viewed uses anonymous views; Featured does not
- Generated summaries are optional, labeled, cached, and must not block reading
