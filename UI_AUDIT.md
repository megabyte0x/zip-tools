# ZIP.tools visual UI audit

Reviewed the [live site](https://zip-tools-web.harpocrates.workers.dev/) on 2026-09-30 at 1440 × 900, 803 × 854, and 390 × 844. Routes and states inspected: home, browse and empty search results, a numbered ZIP, a draft, NU6.3, the citation graph, the empty and populated reading list, mobile navigation, search suggestions, and an unknown ZIP. This is a visual and interaction audit, not a source-data correctness review.

## Validation with Taste Skill

Rechecked the audit with the installed [Taste Skill](https://github.com/Leonxlnx/taste-skill/tree/main/skills/taste-skill), applying its redesign protocol and layout, typography, state, and consistency checks. Its own scope excludes dense data tables, so its marketing-page rules are not treated as requirements for the ZIP catalog or technical reader.

**Design read:** Preserve-brand redesign of a technical proposal library for readers and researchers. The existing visual language is restrained and editorial; a useful target is low motion, moderate variation, and fairly high information density (`DESIGN_VARIANCE 4`, `MOTION_INTENSITY 2`, `VISUAL_DENSITY 6`).

**Baseline to preserve:** The ZIP.tools wordmark, dark surfaces (`#0a0b0a` and `#121410`), warm gold accent (`#c4a35a`), IBM Plex Serif/Sans/Mono roles, search-first navigation, status semantics, ZIP routes and anchors, keyboard focus styling, and source links. Current base muted text has about 6.3:1 contrast on the surface token, so this review does not call for a wholesale palette change. Existing page titles and descriptions should remain intact through visual changes; search ranking was not assessed.

**Validation result:**

| Finding | Evidence status | Review note |
| --- | --- | --- |
| 1 | Confirmed defect | At 390 px, the document is 491 px wide; draft row 129 accounts for the overflow. |
| 2 | Confirmed defect and inconsistency | The first rail card renders `ZIP 2008Sep 24, 2026`; its status styling differs from the table. |
| 3 | Confirmed visual issue | The loaded mobile graph has a small central cluster while labels are enabled. Exact framing varies as the force layout settles. |
| 4 | Confirmed defect | The live Status menu contains `[Revision 0: Canopy` and other unprocessed revision labels. |
| 5 | Confirmed gap on NU6.3; design recommendation | The page has only stage and count text before its nine rows. Other upgrades may have source notes, so the recommendation applies where context is absent. |
| 6 | Confirmed defect | The unknown-ZIP page has no heading and only bare text links. |
| 7 | Confirmed density issue; solution requires design choice | The 390 px browse page renders 135 rows and is about 31,737 px tall. Pagination is one option, not a prerequisite. |
| 8 | Confirmed layout issue | At 803 px, Sort occupies a third filter row by itself. |
| 9 | Confirmed layout observation; solution is a preference | Mobile reader controls and disclosures stack before the article; compact grouping should preserve access to metadata and contents. |
| 10 | Confirmed sparse populated state | The saved list shows a title, Share, and Remove without ZIP identity or an explanation of Share. |
| 11 | Confirmed wrapping; design recommendation | At 390 px, two hero shortcuts sit on one line and Citation graph sits alone below. |
| 12 | Confirmed missing cue | Home upgrade previews omit status even where a listed ZIP is Withdrawn. |
| 13 | Confirmed copy mismatch at narrow width | The mobile-width graph still says “right-drag”; actual touch gesture behavior was not tested. |

The skill's generic advice to add photography, switch icon libraries, or replace a data table does not fit this content-first reference site. Use real proposal content and the graph as visual material instead of adding decorative imagery or changing libraries solely for style.

## Direction for the redesign

Keep the dark, editorial look and warm gold accent. Make the information easier to scan by using one consistent type and spacing scale, clearer primary actions, concise page introductions, and status styling that means the same thing everywhere. Treat 390 px mobile as a first-class layout, especially for long proposal names and dense lists.

## P0 — fix the visible layout defect

### 1. Browse page scrolls horizontally on mobile

- **Where:** `/zips`, 390 px viewport, near the draft rows at the end of the list.
- **Observed:** The document is 491 px wide in a 390 px viewport. The long `draft-arya-dairaemma-disable-addition-of-transparent-chain-value` identifier expands a result row beyond its card.
- **Address:** Constrain the identity cell and link to the card width, allow the slug to break, and ensure the visually hidden table header cannot contribute to overflow. Check draft rows with the longest IDs, not just the first screen of numbered ZIPs.
- **Done when:** `document.documentElement.scrollWidth <= innerWidth` at 320, 375, and 390 px; the full draft ID remains readable inside its card.
- **Likely files:** `packages/web/components/ZipTable.module.css`, `packages/web/components/ZipTable.tsx`.

## P1 — biggest improvements to clarity and polish

### 2. Separate proposal identity from date in the “Newest proposals” cards

- **Where:** Home, especially the mobile carousel.
- **Observed:** The label renders like `ZIP 2008Sep 24, 2026`; number and date touch. The card's generic outline status badge also differs from the colored status pills used in browse and reader views.
- **Address:** Put identity and date in a real metadata row with a visible gap or a two-line mobile layout. Reuse the same status component and colors across cards, tables, upgrade pages, and the reader.
- **Done when:** Identity, date, title, and status are distinct at 320–1440 px, including long draft identities.
- **Likely files:** `packages/web/components/ZipRail.tsx`, `packages/web/components/ZipRail.module.css`, `packages/web/components/StatusPill.tsx`.

### 3. Make the citation graph useful at its initial zoom

- **Where:** Home graph preview and `/graph` at desktop and mobile widths.
- **Observed:** Most nodes form a tiny cluster inside a large, nearly empty canvas; outliers extend far from the cluster. “Show labels” starts checked, yet labels are too small to read in the default view. The legend and several controls take space before the graph on mobile.
- **Address:** Fit the useful cluster at initial load, provide a clear “Fit graph” control, increase effective node and label legibility, and show labels selectively at wide zoom levels. Keep the full graph available for exploration. On the home page, consider a smaller preview that points clearly to the full graph.
- **Done when:** The initial view makes the main cluster and a few labels recognizable without zooming, and users can recover the complete view with one action.
- **Likely files:** `packages/web/components/ForceGraph3D.tsx`, `packages/web/components/ForceGraph3D.module.css`.

### 4. Replace raw status strings in the browse filter

- **Where:** `/zips` → Status dropdown.
- **Observed:** Options include raw revision strings such as `[Revision 0: Canopy` and `[Revision 0] Active, [Revision 1] Withdrawn, [Revision 2] Draft`. These are much harder to scan than the simple statuses beside them and make the control look unfinished.
- **Address:** Offer normalized statuses in the main filter. If revision-specific filtering is needed, place it in a separate, clearly labeled control or detail panel. Keep raw revision text in proposal details where it can be explained.
- **Done when:** Every primary Status option is short, human-readable, and visually consistent with status badges.
- **Likely files:** `packages/index/src/parseStatus.ts`, `packages/web/components/ZipExplorer.tsx`, `packages/web/components/SearchBand.tsx`.

### 5. Give network-upgrade pages a real overview

- **Where:** `/nu/nu6.3`, and other `/nu/*` pages when their source notes are absent.
- **Observed:** NU6.3 has a small “Candidate upgrade” label, large name, count, and a list as the entire page. There is no short explanation of the upgrade, grouping of proposal roles, or context for why some listed ZIPs are Final or Reserved.
- **Address:** Add a brief introductory summary and a compact overview row (stage, number of ZIPs, key deployment ZIP). Group or annotate the list by role/status if the underlying data supports it. Keep the table simple and avoid inventing release dates.
- **Done when:** Someone landing directly on an upgrade page can understand what the list represents before opening a ZIP.
- **Likely files:** `packages/web/app/nu/[id]/page.tsx`, `packages/web/app/nu/[id]/page.module.css`.

### 6. Design the unknown-ZIP page as a proper empty state

- **Where:** `/zip/999999` or another unknown proposal URL.
- **Observed:** The page shows small, bare “No ZIP matches” text and two links in the top-left of a mostly empty canvas; it has no heading or clear primary action.
- **Address:** Use a heading, one-sentence explanation, a prominent “Browse ZIPs” action, and the same card spacing and typography as the other empty states. Preserve the link to the official ZIP site as a secondary path.
- **Done when:** The page clearly communicates the missing result and the next useful action on desktop and mobile.
- **Likely file:** `packages/web/app/not-found.tsx`.

## P2 — improve scanability and consistency

### 7. Shorten the initial mobile browse journey

- **Where:** `/zips`, 390 px viewport.
- **Observed:** Six full-width filter controls come before the first result. All 135 results render as cards; the page is roughly 31,600 px tall in the observed mobile state. It is hard to regain context after scrolling deeply.
- **Address:** Keep search and one high-value filter visible and move the remaining filters into a clear filter panel. Test pagination or progressive loading with an explicit result range before choosing one. Preserve active filter chips and the result count.
- **Done when:** A user can reach the first result quickly, understand the current range, and move through the catalog without one extremely long page.
- **Likely files:** `packages/web/app/zips/page.tsx`, `packages/web/components/ZipExplorer.tsx`, `packages/web/components/ZipTable.tsx`.

### 8. Avoid the orphaned filter row at tablet widths

- **Where:** `/zips`, around 803 px.
- **Observed:** Search and Kind occupy row one, Status/NU/Category occupy row two, and Sort sits alone on row three, creating uneven whitespace before results.
- **Address:** Use a deliberate two-row grid at medium widths and align labels and control heights. Place Sort with the result count or at the end of the second row.
- **Done when:** The filter block reads as one balanced group from tablet through desktop widths.
- **Likely files:** `packages/web/components/SearchBand.module.css`, `packages/web/app/zips/page.module.css`.

### 9. Clarify mobile proposal navigation before the article

- **Where:** `/zip/229` and `/draft/draft-arya-jvff-p2p-quic-transport` on mobile.
- **Observed:** Adjacent ZIP controls are icon-only; “Proposal metadata,” Bookmark, Contents, and Preamble create a long stack before the first paragraph. Draft slugs appear as tiny all-caps text above the title.
- **Address:** Give previous/next controls short visible labels or a compact “ZIP 228 / ZIP 230” treatment. Group metadata and bookmark, tighten the spacing, and wrap or shorten the slug presentation without hiding its full value. Keep Contents easy to reach for long documents.
- **Done when:** The title, status, navigation, and first article heading have a clear order at 390 px, and long slugs remain legible.
- **Likely files:** `packages/web/components/ReaderShell.tsx`, `packages/web/components/ReaderShell.module.css`.

### 10. Add context to the saved reading list

- **Where:** `/list` after bookmarking a proposal.
- **Observed:** A saved row shows only the title and Remove button. The standalone “Share” button does not indicate that it copies links. The empty state is more visually complete than the populated state.
- **Address:** Show ZIP number or draft identity, status, and title for each saved item. Label the action “Copy list links” (or equivalent), add a short explanation, and make copied feedback obvious. Keep remove secondary.
- **Done when:** The populated list is scannable without opening every item and the share action's result is predictable.
- **Likely files:** `packages/web/app/list/page.tsx`, `packages/web/app/list/page.module.css`, `packages/web/lib/readingList.ts`.

### 11. Refine home-page hierarchy on small screens

- **Where:** Home at 390 px.
- **Observed:** Two hero shortcut chips fit on one line while “Citation graph” sits by itself below. The “ZIP of the day” description wraps beside the Random ZIP button. The graph preview takes substantial vertical space near the end of the page.
- **Address:** Use an intentional shortcut layout, keep the daily heading/description/action in a clear stack, and reduce the home graph's visual weight while retaining a strong route to `/graph`.
- **Done when:** Each section reads as a distinct, balanced block at 320–390 px, without single orphaned controls or competing headings/actions.
- **Likely files:** `packages/web/app/page.module.css`, `packages/web/components/ZipOfTheDay.module.css`, `packages/web/components/ForceGraph3D.module.css`.

### 12. Show proposal status on home upgrade previews

- **Where:** Home → Network upgrades cards.
- **Observed:** The cards list titles only, including “Withdrawn Version 6 Transaction Format” under the NU7 candidate card. Readers need to open the upgrade page to see status pills.
- **Address:** Add a compact status treatment or a clear state cue to each preview row. Keep the ZIP number and title aligned when titles wrap.
- **Done when:** A withdrawn, reserved, or final proposal is visually distinguishable in the preview without relying on its title wording.
- **Likely files:** `packages/web/app/page.tsx`, `packages/web/app/page.module.css`.

### 13. Improve graph help for touch users

- **Where:** `/graph` and home graph preview on mobile.
- **Observed:** The same instructions mention “right-drag to pan” at 390 px, while the legend wraps into several rows above the canvas. Touch gesture behavior was not tested.
- **Address:** Show touch-specific gestures where appropriate and collapse or reorganize the status legend on narrow screens. Keep search, zoom, reset, and the legend discoverable.
- **Done when:** Instructions match the current input type and the graph remains the visual focus on mobile.
- **Likely files:** `packages/web/components/ForceGraph3D.tsx`, `packages/web/components/ForceGraph3D.module.css`.

## Suggested implementation order

1. Fix mobile overflow, card metadata spacing, and the raw Status filter options.
2. Improve graph framing and mobile browse density.
3. Add context to upgrade, reading-list, and unknown-ZIP pages.
4. Apply the shared status, typography, and spacing refinements across home and reader views.

After each group, compare 320, 390, 803, and 1440 px views for overflow, title wrapping, control alignment, and consistent status colors. Use both a numbered ZIP and a long draft title in the comparison.
