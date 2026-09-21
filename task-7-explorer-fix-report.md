# Task 7 Explorer Fix Report

## Round 3 — duplicate-free transactional navigation

### Root cause

The prior workaround pushed a second history entry for the current explorer URL and asked the result link to replace it. That consumed a pending Back, but the duplicate remained traversable with Forward and repeated activation could create more duplicates. Next App Router already discards an in-flight navigation when a newer navigate/restore action is dispatched; the missing piece was restoring or canceling the browser traversal without staging another entry.

### Implementation

- Result links retain native `Link` semantics for modified clicks and descendant `preventDefault`, but their accepted `onNavigate` is routed through one transaction owner in `ZipExplorer`.
- The owner starts exactly one `router.push` inside `useTransition`; repeated pointer or Enter activation is ignored while the transaction is active.
- A cancelable Navigation API traverse is prevented and superseded with `router.replace(sourceUrl)`, canceling the older App Router action without changing history depth.
- The `popstate` fallback forwards to the already-existing explorer entry. The resulting App Router restore action supersedes the pending reader action; no same-URL entry is created.
- Cleanup is explicit: commit and hard-navigation failure unmount the explorer; a Back-winning cancellation returns the transaction to idle; listener/ref cleanup runs on unmount. `aria-busy` exposes deterministic settlement.
- Normal committed reader navigation is a client-side push and adds exactly one history entry.

### Deterministic RED evidence

Before the implementation, the new focused set produced 4 failures and 1 pass:

- pending Back lacked an observable settled state;
- failed RSC navigation retained staging residue;
- rapid double pointer activation retained a duplicate explorer entry;
- repeated Enter retained a duplicate explorer entry.

The ordinary client-navigation check passed under the old staging implementation, demonstrating that the new failures specifically detected the duplicate/race behavior.

### GREEN evidence

- Mandatory focused scenarios: **7/7 passed** (pending Back/Forward/settlement, failed RSC fallback cleanup, double pointer, repeated Enter, descendant preventDefault, modified click, ordinary/keyboard client navigation).
- Race/idempotency repeat: **20/20 passed** across 5 repeats.
- Full explorer suite: **12/12 passed**, including debounce replace, discrete push, and popstate control restoration.
- Root unit suites: **140/140 passed** (26 index + 114 web).
- `pnpm build`: passed; Next production compile, type validation, static generation, and route build completed.
- `git diff --check`: passed.

The acceptance history flow was changed to enter the explorer through a real App Router client navigation and to await the committed reader URL rather than relying on a fixed sleep. Its URL/control history assertions passed. Running the whole acceptance file against plain `next dev` still reports pre-existing `/api/summary/*` 503 console errors because that server has no Cloudflare AI/KV bindings; this is unrelated to the explorer transaction.

## Round 5 — explicit released-route settlement

### Finding and implementation

The pending-Back gate awaited `route.continue().catch(() => {})`, so a protocol or interception failure could be mistaken for normal stale-request cancellation. The harness now classifies terminal settlement explicitly: successful continuation records `continued`; only the exact Playwright handled/cancelled-route messages `route.continue: Route is already handled!` and `route.continue: Target page, context or browser has been closed` record `cancelled`. Every other rejection is rethrown and also rejects the awaited settlement promise. The gated test asserts the classified result before the source URL, idle state, no-late-commit, and history-depth checks.

### RED evidence

Injecting `Error("injected unexpected route failure")` at the released continuation made the gated test fail with that exact error. The retained focused helper assertion also verifies that the classifier rejects the same injected unexpected failure rather than treating it as cancellation.

### GREEN evidence

- Observed pending-Back outcome with Playwright 1.63.0: **`continued`**; the released `route.continue()` fulfilled normally.
- Focused classifier plus pending-Back gate: **2/2 passed**.
- Pending-Back gate repeated serially: **10/10 passed** with no fixed sleeps.
- Full explorer suite: **13/13 passed**.
- Root unit suites: **140/140 passed** (26 index + 114 web).
- `pnpm build`: passed; Next production compile, type validation, static generation, and route build completed.
- `git diff --check`: passed.
- Production code was not changed.
