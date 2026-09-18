# ZIP.tools design

Date: 2026-09-18
Status: draft, awaiting human review
Board: kanban `t_279ef3c6`

## Goal

ZIP.tools is a public Zcash analogue of [eip.tools](https://eip.tools): a workbench to search, read, and map Zcash Improvement Proposals. It complements [zips.z.cash](https://zips.z.cash); it does not replace the official renderer.

Website ships first. An MCP server over the same index ships after website v1.

Primary actions: find a ZIP, read it in-app (or jump to the official page), see which network upgrade it belongs to, and see citation relationships.

## Non-goals (v1)

- Forking or retargeting [EIPTools/eip-tools](https://github.com/EIPTools/eip-tools)
- Replacing zips.z.cash as the canonical renderer
- MongoDB, OpenAI / “ZIP-GPT” summaries, Farcaster/Neynar, accounts, reading lists, view counts
- Live GitHub or HTML scrape on the request path
- Full-text search of `protocol/protocol.pdf`
- MCP package (explicitly v2)
- Pixel-parity with eip.tools chrome

## Product shape

- Greenfield app (approach 1), not an eip-tools fork, not a static-only site.
- Content: checked-in git submodule of [zcash/zips](https://github.com/zcash/zips) plus a rebuild script.
- Freshness = submodule pin. Footer always shows the pin SHA and date.
- Reading: in-app body when conversion succeeded; always offer official + GitHub links.

## v1 website capabilities

1. Search and filterable ZIP lists (number, title, status, NU).
2. Network-upgrade boards (settled NUs and candidate NUs such as NU6.3 / NU7).
3. In-app reader with metadata (status, authors/owners, discussions, official/source links).
4. Requires / related-ZIP graph from citations.

## Repository layout

```
zip-tools/
  submodule/zips/          # git submodule → zcash/zips
  packages/index/          # zip-index CLI
    nu.json                # editorial NU overlay (committed)
  packages/web/            # Next.js App Router
  packages/mcp/            # v2 only; directory may be absent in v1
  docs/superpowers/specs/
```

pnpm workspace. Website depends on the index package. No database.

## Architecture

```
zcash/zips (pinned SHA)
        │
        ▼
  zip-index build
        │
        ├─ zip-index.json          (committed? no — produced in CI / local build)
        └─ rendered/{id}.html      (not committed)
        │
        ▼
  packages/web (Next.js)
        │
        ▼  (v2)
  packages/mcp  (stdio tools over the same JSON)
```

Runtime path never talks to GitHub. Rebuild when the submodule pin moves.

CI rebuilds the index from the pin on each deploy/build so Git does not store rendered HTML. `nu.json` and the submodule pin are committed. `zip-index.json` may be generated into `packages/web/data/` as a build artifact, gitignored.

## Indexer

Command: `zip-index build --source submodule/zips --out packages/web/data`

### Inputs

- `zips/zip-*.rst`, `zips/zip-*.md`
- `zips/draft-*.md` (and `.rst` if present)
- Skip assets (`*.svg`, images) as ZIP records; keep them as files the reader can resolve relative to the snapshot
- `packages/index/nu.json`

### Header parse

ZIPs use an RFC-822-ish header, not EIP YAML frontmatter.

- RST: a `::` block at the top of the file (see ZIP 0).
- Markdown: an indented header block before the first ATX heading (see ZIP 229).

Required-if-present fields (missing fields are warnings, not build failures):

| Field | Index key | Notes |
|---|---|---|
| ZIP | `number` or `null` for drafts | integer |
| Title | `title` | |
| Owners | `owners[]` | name + optional email |
| Original-Authors, Credits | `credits[]` | optional |
| Status | `status[]` | see below |
| Category | `category` | free string (Process, Consensus, …) |
| Created | `created` | ISO date if parseable |
| License | `license` | |
| Discussions-To | `discussionsTo` | URL |

Drafts without a ZIP number use `slug` from the filename (`draft-arya-deploy-nu7`). v1 indexes only files in the snapshot (`zip-*` and `draft-*`). Do not invent reserved-but-missing ZIP stubs from ZIP-0 tables.

### Status

Status is not a single EIP enum. Values observed: Draft, Proposed, Active, Final, Withdrawn, Rejected, Obsolete, Reserved, plus per-revision strings such as `Revision 0 Active, Revision 2 Draft`.

Store `status[]` of `{ label, revision?, nuHint? }`. Filters match any label. Display the raw status string as well.

### Citations (graph edges)

ZIPs usually have no `Requires:` header. Edges come from the body:

- RST: `[#zip-0200]_`, `zip-0200`, links to `zip-NNNN`
- MD: `[^zip-0224]`, `[ZIP 224](...)`, `zip-0224`

Rules:

- Normalize to integer ZIP numbers.
- Drop self-citations.
- Drop `zip-guide`, `zip-template`, and protocol-spec-only refs.
- Unknown numbers become dangling nodes labeled Unassigned; do not drop them.
- Invert to `citedBy`.

This is “related / cites”, not a formal Requires graph. UI copy must say Cites / Cited by, not Requires, unless a real Requires header appears (then use it as a typed edge).

### RST / Markdown bodies

- Markdown: stored as source; web renders with `react-markdown` + GFM + math.
- RST: converted at index time with pandoc (preferred) or docutils to HTML snippet. The web app does not ship a live RST toolchain.
- Images: copied or referenced from the snapshot path; reader resolves relative URLs against `/snapshot/...` or inlined rendered output.
- Conversion failure: `body = null`, `parseWarnings` includes the error; build continues.

### Output record (normative)

```
{
  id: "32" | "draft-arya-deploy-nu7",
  number: 32 | null,
  slug: "zip-0032" | "draft-arya-deploy-nu7",
  title: string,
  status: [{ label: string, revision?: string, nuHint?: string }],
  statusRaw: string,
  category: string | null,
  owners: [{ name: string, email?: string }],
  created: string | null,
  license: string | null,
  discussionsTo: string | null,
  nuIds: string[],
  citations: number[],
  citedBy: number[],
  sourcePath: string,
  officialUrl: "https://zips.z.cash/zip-0032",
  githubUrl: string,          // blob URL at the pinned SHA
  bodyKind: "md" | "rst" | "draft" | "none",
  body: string | null,        // rendered HTML path or inline; null on failure
  parseWarnings: string[]
}
```

Official URL rule: numbered ZIPs → `https://zips.z.cash/zip-{NNNN}` zero-padded to 4 digits as used by the official site (`zip-0032`, `zip-0000`). Drafts → `https://zips.z.cash/{filename-without-ext}` matching zips.z.cash.

### Build failure policy

Fail the build only if:

- snapshot directory is empty / submodule not initialized, or
- `zip-index.json` cannot be written.

Soft-fail: missing headers, RST errors, overlay ZIPs absent from snapshot (warn and still emit).

## NU overlay

File: `packages/index/nu.json` (committed, editorial).

Candidate NUs on zips.z.cash are curated lists, not a ZIP header. Do not infer NU membership from citations.

Shape:

```
{
  "nus": [
    {
      "id": "nu6.2",
      "title": "NU6.2",
      "kind": "settled" | "candidate",
      "deploymentZip": 257,
      "zips": [257, ...],
      "notes": "optional"
    }
  ]
}
```

Indexer sets `nuIds` on each ZIP in `zips`. Missing snapshot files: NU board still lists the number as “not in snapshot”.

v1 seed: copy the lists from the current zips.z.cash homepage (settled NU6.2, NU6.3 candidates, NU7 candidates). Update the overlay when those lists change; this is a content edit, not a code change.

## Website

Stack: Next.js App Router, TypeScript. Dark, dense workbench, Zcash-adjacent palette (not an Ethereum-blue clone of eip.tools). One UI system only: CSS modules plus a small token file (bg/surface/fg/muted/accent). No Chakra, no Tailwind in v1.

### Routes

| Path | Purpose |
|---|---|
| `/` | Search band, NU boards, status snapshot |
| `/zips` | Filterable table: number, title, status, category, NU. No per-row “updated” column (that would need per-file git log). Snapshot age lives in the footer. |
| `/nu/:id` | Upgrade board |
| `/zip/:id` | Reader (`32`, `032`, `zip-0032` all resolve to ZIP 32) |
| `/graph` | Global citation graph |
| `/draft/:slug` | Draft reader |

### Search

Client-side over `zip-index.json`. The corpus is small enough; no Elasticsearch.

Filters: text (number, title, owner), status label, NU id, category.

Empty query on `/`: show NU boards and the full list, not an error. No hits: empty state + link to zips.z.cash.

### Reader

1. Metadata chips: ZIP number, status labels, category, owners, created, license.
2. Links: zips.z.cash, GitHub blob at pin, Discussions-To.
3. Body: rendered HTML/MD, or fallback panel if `body` is null.
4. Local graph: depth-1 Cites / Cited by. Depth 2 optional toggle.
5. If graph WebGL/canvas fails: citation lists only; metadata and body stay.

Fallback copy: “Open on zips.z.cash”. Reload may retry client render; it cannot rebuild RST at runtime.

### Graph

Nodes = ZIP records (and dangling Unassigned numbers). Edges = citations.

Default neighborhood: depth 1. Global `/graph` may need clustering or filter-by-NU so the page stays usable.

UI labels: Cites / Cited by. Do not label edges Requires unless a Requires header produced that edge.

### Snapshot age

Footer on every page: `zcash/zips` SHA (short) + commit date + link to that commit.

## Error handling (normative)

| Case | Behavior |
|---|---|
| Missing header fields | List ZIP, `parseWarnings`, still show |
| RST conversion fail | Metadata + official/GitHub CTAs, no body |
| Dangling citation | Unassigned node |
| Overlay ZIP missing | Board row “not in snapshot” |
| Unknown `/zip/:id` | 404 + search hint |
| Graph renderer fail | List fallback |
| Empty snapshot | Build fails |

## MCP (v2, not built now)

Same `zip-index.json`. Stdio tools:

- `zip_get` (number or slug)
- `zip_search` (text, status, nu, category)
- `zip_nu` (id)
- `zip_graph` (number, depth)

No extra database. Website v1 must not block on this; keep the index JSON stable so MCP can consume it later.

## Testing

### Indexer (fixtures, no network)

Tiny fake `zips/` tree, not the full submodule:

- RST header (ZIP 0 style `::` block)
- Markdown indented header (ZIP 229 style)
- Multi-revision status strings
- Citation extraction and self/template ignore
- NU overlay merge + missing-ZIP warning

### Web

- Search filters: number, title, status, NU
- `/zip/:n` 200 for fixture, 404 for unknown
- Reader fallback CTA when `body` is null
- Graph neighborhood depth 1 from fixture edges

### CI smoke (real submodule)

- `git submodule update --init`
- `zip-index build` exits 0
- Index contains ZIP 0, 32, 317 and at least one `draft-*`
- Every `nu.json` id produces a board payload

Not in v1: visual regression, MCP tests, live GitHub, OpenAI.

## Implementation order (for the later plan, not this spec’s job)

Recorded so the plan does not reorder product intent:

1. Repo scaffold + submodule pin
2. Indexer + fixtures
3. `nu.json` seed from zips.z.cash
4. Web lists/search
5. Reader
6. NU boards
7. Graph
8. CI smoke
9. MCP (after website v1 accepted)

## Open decisions closed by this spec

- Product: web + later MCP; website first.
- Relation to official site: complement, in-app read allowed.
- Content: submodule snapshot, not live API, not scrape.
- Build: greenfield, not eip-tools fork.
- Graph: citations, labeled Cites/Cited by.
- Rendered HTML: not committed; CI/local rebuild from pin.
- No GPT, accounts, or protocol PDF search in v1.
