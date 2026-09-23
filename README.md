# zip-tools

Local ZIP explorer: index a zips.org snapshot, then browse, search, and follow citations.

```
git submodule update --init --recursive
pnpm install
pnpm index
pnpm --filter @zip-tools/web dev
```

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
