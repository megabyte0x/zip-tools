# zip-tools

Local ZIP explorer: index a zips.org snapshot, then browse, search, and follow citations.

```
git submodule update --init --recursive
pnpm install
pnpm index
pnpm --filter @zip-tools/web dev
```

## Public agent access

The Cloudflare Worker serves public reference pages as Markdown when requested with
`Accept: text/markdown`. Appending `.md` works without a special header, for example
`/zip/32.md` or `/zips.md`; the home page is `/index.md`. Normal HTML and Next.js
navigation keep their existing representations. Long proposals link every document
part through `?part=N`; follow all parts for the complete source text. Citation links
between parts preserve their target anchors. Reading lists remain browser-local.

`/llms.txt`, `/sitemap.xml`, `/robots.txt`, and `/docs` describe discovery, retrieval,
and the pinned snapshot's limitations. `/openapi.json` documents the existing
supporting APIs, with discovery at `/.well-known/api-catalog`. API version 1 is the
default, and can be selected explicitly with `X-API-Version: 1`. Unsupported versions
return 400. API failures use RFC 9457 problem details while retaining existing error
codes; successful response bodies remain unchanged. No account or payment is needed
for reference access. Generated summaries are currently disabled.

The Worker implements Markdown negotiation and API response handling. Deploying only
the Next.js server does not provide these Worker endpoints. Build the index before
running the corpus tests, and package the Next.js build with OpenNext for Cloudflare.

## GitHub issue-body snapshots

Some ZIP source files contain only metadata and an explicit `Discussions-To` link to a
supported `zcash/zips` GitHub issue. `packages/index/issue-snapshots.json` stores the
opening description for those issues so readers and normal builds remain offline. Issue
comments are not imported. When a ZIP source has substantive proposal text, that
repository text takes precedence over any linked issue snapshot.

Each saved issue has two independent timestamps: `updatedAt` is the issue-description
revision time reported by GitHub, while `fetchedAt` records when this repository captured
that revision. Review both fields and the `contentHash`, title, URL, and body in
`packages/index/issue-snapshots.json` before accepting an update.

To refresh captures deliberately:

```
pnpm issues:refresh
```

`GITHUB_TOKEN` and `GH_TOKEN` are optional environment-variable names for the refresh
command. Do not put credentials in the snapshot or repository configuration. A refresh
can complete only partially: it exits nonzero if any issue failed, but retains each
last-good capture instead of deleting it. Inspect the snapshot file and the command's
per-issue failures before deciding whether to retry.

Normal builds do not refresh GitHub data and can run offline. After reviewing a snapshot
update, regenerate the local index and production artifact:

```
pnpm index
pnpm build
```
