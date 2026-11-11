# Key Group responsiveness implementation spec

Status: Proposed for review. Application implementation and performance targets require the checkpoints below.

Source: [Issue #36](https://github.com/ny147/mdez/issues/36). Code reviewed at `1a2b78e` on `origin/main`.

## Intent and scope

Make Key Group page interactions feel responsive while preserving saved collaboration, draft recovery, workspace isolation, and server authorization. Deliver the epic through separate, measurable changes. Start with a baseline, ship only fixes supported by it, and remeasure before considering a larger synchronization project.

This spec details child issues 1 and 2. Child issues 3–5 remain separate follow-ups with prerequisites below. It does not claim that the reported delay has been reproduced or that a bottleneck has been measured.

Use the product terms **page**, **book**, and **Unsorted** in UI and reports. Existing API and database names `document` and `folder` remain internal. Books are flat; deleting a book moves its pages to Unsorted without deleting their content.

## Current behavior verified in source

Paths below are relative to the repository root.

| Area | Current behavior | Implication |
| --- | --- | --- |
| `src/hooks/useKeyGroupLibrary.ts` | `selectDocument` selects from the loaded array and changes local state. | No remote read is explicitly required for a loaded page switch. Verify the complete UI flow before adding a cache. |
| `src/components/mdez/MdezWorkspace.tsx` | `handleSelectDocument` selects synchronously and records browser-local resume metadata without awaiting it. `handleCreateDocument` awaits `createPage` before entering Edit. | Separate page switching from server-confirmed page creation when measuring. |
| `src/hooks/useKeyGroupLibrary.ts` | Page/book create, book rename, page move, and body/title saves apply returned rows. Page delete waits for success, then removes the row locally. | These paths already avoid an explicit full-group confirmation fetch. Preserve that behavior. |
| Same hook, `deleteBook` | After DELETE it awaits `fullRefresh`. | A full snapshot currently restores authoritative versions for pages moved to Unsorted. Removing it blindly breaks later writes. |
| Same hook, group loading | Applies the Dexie snapshot, then requests a full snapshot; readiness becomes true after the load attempt completes. | Cold open, cached group reopen, and switching loaded pages are different workloads. Cached application does not alone prove the UI becomes usable early. |
| `src/hooks/useGroupRefresh.ts` | Polls changes every 30 seconds and on window focus, coalesces in-flight refreshes, and loads a snapshot on `reset_required`. Automatic refresh skips hidden windows and blocked drafts/conflicts; manual refresh does not apply that guard. | Incremental sync already exists. Attribute background requests separately and test refresh/draft races. |
| `src/hooks/useDocumentDrafts.ts`, `src/lib/latest-save-queue.ts` | Title/body debounce is 650 ms. Separate in-memory queues serialize each field per page. Draft status is derived for the selected page. The hook stringifies all persisted titles/bodies during render and builds draft overlays. | Whole-library CPU work is a profiling candidate. Queues are not durable offline storage or a single ordering queue across title/body edits. |
| `src/lib/key-group-repository.ts` | IndexedDB stores snapshots and remembered keys; forgetting a group deletes both. Incremental `applyChanges` does not currently write the snapshot cache. | Preserve current cache boundaries; do not describe the cache as an outbox or always current. |
| `src/server/key-groups/postgres-store.ts` | Mutations lock the group, increment revisions transactionally, and append change records. Updates use expected entity versions. Book deletion increments each moved page's version/revision before deleting the book. | Retain these correctness contracts. Assess lock waits and query counts under realistic book sizes. |
| API DELETE routes and `src/lib/key-group-client.ts` | DELETE returns `{ deleted: true }`; client delete helpers return `void`. Create/update return versioned rows. | DELETE does not currently expose a complete revision or moved-row receipt. |
| `src/server/database.ts`, `authorize.ts`, `runtime.ts` | Requests use a server Postgres connection, digest-based key authorization, and mutation rate limiting. Connection pool maximum is three. | Include authorization, rate-limit queries, connection waits, and transaction time in server attribution. |

Repository SQL declares RLS enabled with access revoked from `anon` and `authenticated`. Inspect the actual runtime database role and policies before attributing latency to RLS. Migration text is not evidence of deployed configuration. The source transports and stores Markdown bodies without client-side encryption; the secret key is an access mechanism. Do not present Key Groups as end-to-end encrypted.

## Approaches

1. **Measure and optimize the existing flow — recommended.** Reuse loaded state, Dexie snapshots, versioned mutation responses, and incremental polling. This is the smallest path to a verifiable improvement and permits release before offline work.
2. **Introduce durable optimistic operations first.** This could make structural actions immediately visible but requires an IndexedDB outbox, retry idempotency, ownership across tabs, and recovery rules. It is disproportionate before identifying the delay.
3. **Replace synchronization or add real-time merging first.** This expands scope substantially and would not necessarily fix page-switch rendering. Existing change polling and saved collaboration make it a poor first step.

The user selected the profiling and targeted-fixes scope corresponding to approach 1. Detailed design choices remain proposed for review. Do not implement approaches 2 or 3 as incidental performance fixes.

## Phase A performance baseline

### Reproducible workloads

Create deterministic synthetic Local and Key libraries with equivalent books, pages, and Markdown. Proposed fixture sizes are test inputs, not observed production usage:

| Fixture | Books | Pages | Markdown payload |
| --- | --- | --- | --- |
| Small | 3 | 10 | 2 KiB per page |
| Typical | 10 | 100 | 10 KiB per page |
| Large | 20 | 1000 | 40 KiB per page |

Include plain text, tables, code blocks, and math. Add a separate 5 MiB single-page boundary case without exceeding the 50 MiB group ceiling. Record actual encoded byte counts and generator seed. Reuse equivalent content in Local and Key runs. Keep page count constant between repeated create/delete samples by resetting outside the measurement window.

Measure desktop Chromium and the existing Pixel 7 Playwright project; emulation is not a substitute for identifying the physical host. Record commit, production build, browser/OS, hardware, viewport, CPU throttling, app/database regions, database role, fixture, and network settings. Use a fixed browser-to-app network profile with 100 ms added latency and 10 Mbps throughput as a proposed repeatable comparison, plus an unthrottled control. Record actual tool settings and measured RTT rather than treating configured latency as observed latency. App-to-database timing is measured separately.

For each action/fixture/profile, collect at least 100 measured samples after five excluded warm-ups, distributed across at least three runs. Spread Key mutations below the existing rate limit; do not disable it to obtain favorable numbers. Record failures and rate limiting separately, with counts. Compute p50/p95 from raw samples using the nearest-rank method and include sample counts. Report cold samples separately, resetting caches outside their measurement window; never combine them with warm percentiles.

Actions:

- Open a group with no cached snapshot, and reopen a remembered group with a snapshot. Include time until the workspace is usable.
- Switch between already loaded pages in Edit, Read, and Split. Test clean selection separately from switching away from an unsaved edit, including a pending/failed save on the previous page.
- Create a page in a book and in Unsorted; delete active and inactive pages; rename page titles and books.
- Delete a populated book and verify its pages appear in Unsorted. Record moved-page count.

### Measurement boundaries

Start action timing at the user event after native confirmation/prompt acceptance. End at the first presented frame showing the intended page/content or structural result. Use operation-specific DOM assertions and browser frame/trace evidence; a resolved handler or React commit alone is not proof of paint. Also record feedback latency (first pending message) and server-confirmed completion separately so a spinner cannot satisfy the content latency metric. Do not count user typing or prompt dwell time.

Capture a request timeline per action with method, route template, initiator category, start/end, status, request body byte count, response encoded/decoded body bytes, and transfer size where available. Mark unavailable browser byte metrics explicitly. Distinguish navigation-triggered work, autosave of the previous page, initial load, manual refresh, and independent poll/focus refreshes. Use browser request events plus explicit operation correlation in opt-in instrumentation rather than attributing every overlapping request to the click.

Use production builds for latency measurements. Capture React Profiler commits and browser CPU traces in a separate diagnostic run with equivalent fixtures; disclose profiling overhead. Inspect `MdezWorkspace`, library derivation/search, draft signatures, CodeMirror, Markdown rendering, and sidebar commits. Report expensive work only when traces support it.

On a disposable local/staging Postgres setup, break down route handling, key authorization, rate limiting, connection acquisition/lock waits, SQL execution, and response serialization. Use fixed timing labels, counts, and request correlation IDs. Investigate query plans and RLS behavior under the effective runtime role using synthetic data. Include N+1 patterns and index usage; do not assume an index or policy is missing. Avoid double-counting nested durations. Report unobservable components as inconclusive.

Instrumentation is opt-in for development/test environments. Collect only timings, counts, sizes, fixed route templates, and random correlation IDs. Do not export raw HARs, keys/headers, Markdown, titles, credentials, raw IPs, or connection URLs. Sanitize traces before sharing because browser tooling may capture payloads. No production database operations or deployments are authorized by this spec.

### Baseline deliverable and decision gate

Add `docs/performance/key-group-baseline.md` containing the setup, reproducible commands, raw sanitized samples or their artifact locations, percentile tables, request timelines, server attribution, profiler findings, limitations, and ranked evidence for each proposed change.

The product owner and implementer then agree numeric p95 budgets for cached switch, create/delete completion, and pending feedback on a named reference environment, with a Local regression tolerance. Record p50 too. These values remain **TBD until measured**; they are a gate for Phase B acceptance, not a reason to invent results now.

If real server measurements are unavailable, mocked browser results can establish request contracts and rendering costs only. Keep server attribution and overall performance acceptance open.

## Phase B conditional implementation

Select the smallest independently reviewable change supported by Phase A, and attach before/after evidence using the same workload. More than one candidate may be unnecessary.

### Loaded page selection and rendering

Keep `selectDocument` synchronous against already loaded state, with zero navigation-triggered requests. Do not introduce a selection fetch or await autosave/resume recording. If traces show expensive whole-library derivation, narrow or memoize that work without losing draft overlays, search correctness, bookmarks, or resume behavior. Verify that changing the selected page alone does not serialize every Markdown body if that is the measured cost.

### Server-confirmed mutations and feedback

Retain create/update row application and page deletion without full-group refetches. While requests run, show concise pending feedback through the existing workspace status pattern and disable duplicate activation of the affected action only. Allow loaded-page navigation. Distinguish waiting from success and report failures; the current create error is caught by the workspace without the group controller necessarily setting a message, so test that failure explicitly.

Creating a page still waits for a server ID before opening an editable page. Never call this fully optimistic creation. A failed create leaves existing content unchanged and offers a safe explicit retry. Do not blindly auto-retry ambiguous create timeouts under the current non-idempotent API. If server round trips alone prevent the agreed creation target, reopen scope for Phase C rather than promising immediate editable pages.

Keep save status for text drafts separate from structural-operation success. No status may claim server persistence before acknowledgment. A late operation response must not select a newly created page over a newer explicit user selection or affect a different workspace after a switch.

### Book deletion

The existing post-delete snapshot is a documented correctness exception: the server moves pages and changes their versions, while DELETE returns no updated rows. Keep this exception unless profiling justifies a focused contract change.

If measured as material, make a separate API/client/controller change returning a transactional receipt with the deleted book ID, authoritative updated moved-page records and versions, and the final group revision. Apply the deleted book and moved rows together, preserve draft overlays, and choose Unsorted when the active book was removed. Do not infer new versions from stale client state. Test a subsequent edit of every moved page against the returned version.

Treat the receipt revision as metadata for that mutation, not permission to skip unrelated changes. Retain the last fully acknowledged sync cursor until catch-up has processed all intervening changes. Add a regression where another session edits an unrelated page before the delete; the next poll must still retrieve it. Do not change the server transaction/lock order to make the UI faster.

### Shared correctness constraints

- Preserve expected-version conflicts and the current user choice to reload shared content or save a conflict copy. Do not silently replace unsaved text with remote content.
- Test dirty drafts on unselected pages and in-flight refreshes. Current refresh blocking is based on selected-page status; a selected clean page is not proof that the entire workspace is clean.
- Guard async results by workspace identity/lifecycle and prevent stale save or refresh results from overwriting newer drafts. If a narrow safety fix is necessary for a chosen optimization, include its regression test; otherwise track it separately.
- Preserve Local Library persistence and data. Do not add a new shared/local repository abstraction unless required by a demonstrated change.
- Do not persist new categories of Key Group content or widen key retention as a performance shortcut.

## Verification and release checkpoint

Extend existing tests rather than replacing the storage model:

| Layer | Required evidence for changed paths |
| --- | --- |
| Hook/unit | Loaded selection with zero client API calls; successful page mutations with no full snapshot fetch; delayed/failing mutations expose truthful feedback; stale results respect selection/workspace; relevant draft/refresh race coverage. |
| Draft/conflict | A failed previous-page save preserves its text when switching away/back; title/body concurrency and newer-draft preservation for any affected save code; conflict copies remain usable. Reuse `useDocumentDrafts.test.tsx` and `key-group-conflict.test.tsx`. |
| API/store, if changed | Real Postgres transaction rollback and version/revision receipts, including book deletion with moved pages and unrelated concurrent edits. Existing fake SQL tests alone cannot establish deployed lock/RLS behavior. |
| Playwright | Extend `tests/e2e/key-groups.spec.ts` on desktop and mobile: clean cached switches, slow/failing CRUD, dirty switch, book deletion to Unsorted, and Local regression. Existing API mocks need create/delete/book routes to cover these scenarios. Run separate real-server measurements; mocked APIs do not measure SQL. |
| Performance | Same before/after fixtures/environment, p50/p95, request counts/bytes, server timing, and profiler evidence. Compare against the agreed budgets and explain remaining exceptions. |

For application implementation run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, and `git diff --check`. Review desktop/mobile layout, keyboard/focus behavior, and announcements for feedback changes. This documentation-only proposal requires source accuracy and diff checks; it supplies no application test or benchmark result.

Phase A is done when the baseline, timeline, attribution or explicit inconclusive findings, and agreed budgets are recorded. Phase B is done when its measured target is met, clean cached selection makes zero navigation-triggered requests, successful page creates/deletes avoid confirmation snapshots, any book-delete exception is justified, failures preserve content, and Local regression checks pass.

Re-measure here. Release if the agreed target is met. Otherwise document the remaining measured gap and select a follow-up. Do not make speculative synchronization work a release requirement. The epic closes only when the measured target and correctness gates pass and deferred work is explicitly tracked or closed as unnecessary. Link this spec with `Refs #36`, not an automatic issue-closing keyword.

## Separate follow-ups

### Phase C durable optimistic mutations

Proceed only if immediate editable creation/offline recovery is required after the release checkpoint. Before coding, approve a dedicated spec for an IndexedDB outbox keyed by workspace, client IDs supported by the API, idempotent retries, per-page ordering across fields and dependent operations, bounded backoff, explicit pending/saved/failed/conflict states, multi-tab ownership and handoff, reload recovery, and ambiguous response handling. Never discard a failed new page after content entry. Existing in-memory queues and snapshot caching do not satisfy this phase.

### Phase D incremental synchronization hardening

Extend the existing changes endpoint and polling rather than assuming neither exists. Verify runtime schema/role, transaction consistency of snapshot/change reads, monotonic revisions, delete records, log retention, and reset fallback on a disposable environment matching deployment. The current store's multiple reads within a transaction need an isolation audit before claiming a consistent cursor snapshot. Define preservation of pending edits and cache durability. A two-browser test must prove reconnect catch-up, deletions, and stale-cursor reset. Realtime, if chosen later, is a notification trigger rather than the reliable change history.

### Phase E conflict and cache policy

Keep whole-document conflict preservation and saved collaboration as the current product direction. Any change to delete-versus-edit, move/reorder conflicts, cross-field ordering, or merging needs explicit outcomes and two-context tests. Define allowed plaintext cache/draft retention, key removal and access-revocation behavior, and browser cleanup limits. Forgetting a group currently removes keys and snapshots, but cannot retract exported or already downloaded copies. CRDT/OT and simultaneous text merging remain out of scope unless separately approved.

## Decisions still required

1. After Phase A, approve the reference environment, numeric budgets, and Local regression tolerance.
2. Use measured evidence to decide whether book deletion needs an API receipt or retains its correctness refresh.
3. At the release checkpoint, decide whether remaining latency warrants durable optimistic creation or additional sync work.

Fixture sizes, sample counts, measurement profiles, and approach 1 are proposed implementation defaults. Builders may adjust diagnostic tooling and internal names while keeping comparisons reproducible and the correctness contracts intact.
