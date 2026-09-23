# GitHub Issue Body Fallback — Task 7 Verification

## Status

**VERIFIED after Fix 3.** Plain Node `next start` completes the focused production generated-summary browser gate without attempting Cloudflare remote setup, while non-bypass Cloudflare context-loader failures again degrade to empty bindings. The earlier full Task 7 acceptance results below remain historical; Fix 3 reran only its focused helper and production-browser gates.

No Task 7 GitHub refresh was run.

## Production-context regression and minimal guard

The RED reproduction used the unguarded artifact exactly as a plain production server:

```sh
pnpm --filter @zip-tools/web start --port 3119
ZIP_TEST_BASE_URL=http://127.0.0.1:3119 \
  pnpm --filter @zip-tools/web exec playwright test tests/reader.spec.ts \
  --grep 'generated summary fetches only after opening and retries without serializing the body' \
  --workers=1
```

It exited `1`: the test timed out waiting for `Summary is unavailable.` at `reader.spec.ts:245`. The server log emitted `Establishing remote connection...` twice.

`packages/web/lib/cloudflareEnv.ts` is the focused correction. It returns empty bindings immediately only when all three conditions hold: `NODE_ENV=production`, `NEXT_RUNTIME=nodejs`, and `Symbol.for("__cloudflare-context__")` is absent. Otherwise it invokes `getCloudflareContext({ async: true })` and returns the deployed context’s `env`; loader, import, or context failures in that post-bypass path also degrade to empty bindings. The existing home, views, trending, and summary `loadEnv` consumers now delegate to this helper. The summary route continues to forward `bodySource` to `handleSummaryGet`.

Focused helper tests now pass (`4/4`): plain Node start bypasses the loader, a present Cloudflare symbol preserves deployed bindings, a rejecting non-bypass loader degrades to empty bindings, and non-production Node still loads bindings. Fix 3 rebuilt the web artifact and reran the same summary browser test on plain `next start --port 3119`: exit `0`, `1 passed` (842 ms), with no remote-connection message in the server log.

## Saved snapshot and offline proof

The saved #1302 record was parsed from `packages/index/issue-snapshots.json` and its bytes were re-hashed:

| Field | Observed value |
| --- | --- |
| URL | `https://github.com/zcash/zips/issues/1302` |
| Title | `[ZIP 2007] Quantum recoverability of a subset of the transparent protocol` |
| SHA-256 content hash | `9ea2ea64db5e51301ca9198b9b78e67147524ee5e1c48189810580b531d3c729` |
| Recomputed SHA-256 | matched stored hash |
| `updatedAt` | `2026-07-05T21:00:43Z` |
| `fetchedAt` | `2026-09-23T08:36:06.462Z` |

`pnpm --filter @zip-tools/index exec tsx --test test/issueFallback.test.ts` exited `0`: **12 passed**. This includes the committed-snapshot gate, the throwing-`fetch` child CLI build with `GITHUB_TOKEN` and `GH_TOKEN` removed, and the precise TypeScript AST/call-graph guard. The guard rejects refresh reachability, network-client imports/calls, dynamic imports, `fetch`, `require`, `eval`, WebSocket, external runtime modules, and unapproved child-process calls. It explicitly permits and observed only the local build subprocesses:

- `pandoc -f rst -t html` in `src/renderBody.ts`;
- `git -C $sourceDir log -1 --format=%cI` and `git -C $sourceDir rev-parse HEAD` in `src/snapshot.ts`.

Thus the normal build graph excludes the refresh/network path while accounting for required local `pandoc` and `git` operations.

## Browser acceptance

After the final token-free build, the production artifact was served only with the plan command:

```sh
pnpm --filter @zip-tools/web start --port 3120
curl --fail --silent --output /dev/null http://127.0.0.1:3120/zip/2007
```

The exact health check returned HTTP 200. A focused browser run passed all three `issueFallback.spec.ts` cases: saved-snapshot reader, normal Markdown/RST readers, and the existing missing-reader fixture. Its expectations read title, URL, `updatedAt`, and `fetchedAt` from `issue-snapshots.json`; no mutable snapshot metadata is copied into literals.

One all-files production invocation then ran against that same checked artifact:

```sh
ZIP_EVIDENCE_RUN_ID=task7-fix2-production-20260923T105616Z-4013621 \
ZIP_TEST_BASE_URL=http://127.0.0.1:3120 \
pnpm --filter @zip-tools/web exec playwright test --reporter=json
```

Exit `0`. Parsed JSON totals: **60 discovered, 58 passed, 2 skipped, 0 failed, 0 flaky**. The only production skips were deliberately development-only:

- `development observer tracks the actual camera through zoom and reset`
- `development scene observer finds actual visible citation-link objects`

The saved-snapshot test aborts every `github.com` and `api.github.com` request, collects console errors and page errors, and passed with empty request/error arrays. It also proves desktop/mobile TOC targeting, no document overflow, and final-column geometry. The separate development observer run was healthy:

```sh
ZIP_TEST_BASE_URL=http://127.0.0.1:3121 \
ZIP_TEST_GRAPH_OBSERVERS=development \
pnpm --filter @zip-tools/web exec playwright test tests/graph.spec.ts \
  --grep 'development observer|development scene observer' --workers=1
```

After its `/zip/2007` HTTP-200 health check, it exited `0`: **2 passed** (6.3 s).

## Tests and build

| Command | Exit | Observed result |
| --- | ---: | --- |
| `pnpm --filter @zip-tools/web exec tsx --test lib/cloudflareEnv.test.ts` | 0 | 4 passed (Fix 3) |
| `pnpm --filter @zip-tools/index exec tsx --test test/issueFallback.test.ts` | 0 | 12 passed |
| `pnpm run test` | 0 | index 61 passed; web 125 passed; 186 total |
| `pnpm --filter @zip-tools/web exec tsc --noEmit` | 0 | clean |
| `env -u GITHUB_TOKEN -u GH_TOKEN pnpm index` | 0 | snapshot-driven index build completed |
| `env -u GITHUB_TOKEN -u GH_TOKEN pnpm run build` | 0 | index and `next build` completed |

## Visual evidence

The final production run wrote exactly eight PNGs in the unique directory:

`docs/superpowers/reports/2026-09-23-github-issue-body-fallback-screenshots/task7-fix2-production-20260923T105616Z-4013621/`

- `zip-2007-desktop-top.png`
- `zip-2007-desktop-table.png`
- `zip-2007-desktop-table-scroll-end.png`
- `zip-2007-desktop-math.png`
- `zip-2007-mobile-top.png`
- `zip-2007-mobile-table.png`
- `zip-2007-mobile-table-scroll-end.png`
- `zip-2007-mobile-math.png`

Direct review confirmed the notice precedes readable issue text on desktop and mobile. Both math captures visibly show `ZKPoK{(privkey) : PubKeyHash = Hash160(PubKeyOf(privkey))}`. At the horizontal end, desktop and 390 px mobile captures show the readable `Recoverable?` final column and its right border inside the table scrollport; long mobile cells wrap in place.

## Hygiene and scope

This round changed only the Cloudflare-context helper/test, the four specified existing environment-consumer substitutions, this verification report, the Task 7 fix-2 report, and run-specific evidence. No dependency, lockfile, upstream/submodule, snapshot-body, manual generated-data, GitHub refresh, stage, commit, or push action occurred.

After production tests re-created `2026-09-21-reader-explorer-3d-screenshots` test pollution, the affected tracked screenshots were restored and the untracked `issue-zip317-overflow-1280.png` was removed. Fix 3 also removed the task-owned `packages/web/test-results/` Playwright `.last-run.json` output after its focused browser run; scoped `git status` is empty for that directory. Task-owned port 3119 was stopped and confirmed free. An unrelated pre-existing `next dev --port 3000` process was observed and left untouched.

## Fix 3 focused execution record

### RED

After adding the rejecting-loader regression test and before changing the helper:

```sh
pnpm --filter @zip-tools/web exec tsx --test lib/cloudflareEnv.test.ts
```

Exit `1`: **3 passed, 1 failed**. The new non-bypass loader test failed with the expected propagated `Error: injected-context-failure` from `cloudflareEnv.ts:24`.

### GREEN

The helper retains the narrow plain-Node return before a post-bypass `try/catch`; the catch returns `{}` for a rejected loader, dynamic import failure, or invalid context access. The same focused test command exited `0`: **4 passed, 0 failed** (87.5 ms).

```sh
pnpm --filter @zip-tools/web build
pnpm --filter @zip-tools/web start --port 3119
curl --fail --silent --output /dev/null http://127.0.0.1:3119/zip/48
ZIP_TEST_BASE_URL=http://127.0.0.1:3119 \
  pnpm --filter @zip-tools/web exec playwright test tests/reader.spec.ts \
  --grep 'generated summary fetches only after opening and retries without serializing the body' \
  --workers=1
```

The web build exited `0`; the exact health check exited `0`; and the focused browser command exited `0`: **1 passed** (842 ms). The plain `next start` log contained only startup/ready output and no `Establishing remote connection` text. The server was stopped, and port 3119 is free.
