
# Key Group responsiveness implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reproducible Local versus Key Group performance baseline, then ship only the targeted fixes that baseline justifies.

**Architecture:** Keep the existing Local repository, Key Group controller, versioned mutations, snapshot cache, and incremental polling. Add opt-in measurement tools first. Preserve server-confirmed structural mutations; a durable outbox or replacement synchronization engine requires a separate design.

**Tech Stack:** Next.js App Router, React, TypeScript, Dexie, Postgres, Vitest, Playwright; npm and the existing lockfile. No new dependencies are planned.

**Spec:** [Key Group responsiveness implementation spec](../specs/2026-11-11-key-group-responsiveness-design.md).

**Execution status (2026-11-11):** Profiling foundation implemented on `codex/implement-pr-39`. See [baseline](../../performance/key-group-baseline.md), [results](../../performance/key-group-results.md), and [execution ledger](../../performance/execution.md). Unchecked items remain open; Phase A acceptance and Tasks 5–7 are not complete.

## Global constraints

- “Start with a baseline, ship only fixes supported by it, and remeasure before considering a larger synchronization project.”
- “Use the product terms **page**, **book**, and **Unsorted** in UI and reports.” Existing `document` and `folder` API names stay internal.
- “Keep `selectDocument` synchronous against already loaded state, with zero navigation-triggered requests.”
- “Do not silently replace unsaved text with remote content.”
- “Do not export raw HARs, keys/headers, Markdown, titles, credentials, raw IPs, or connection URLs.”
- “No production database operations or deployments are authorized by this spec.”
- Keep the current `650` ms title/body debounce, `30_000` ms polling interval, expected-version checks, lock order, and Local Library persistence unless an explicitly selected task requires a change.
- Numeric performance budgets remain unassigned until Task 4. Missing server access is an explicit measurement blocker, not permission to substitute mock timing for database evidence.
- Execution ruling: AGENTS.md requires a new task branch from freshly fetched `origin/main`; this implementation uses `codex/implement-pr-39` and a separate implementation PR. Source PR #39 stays the design reference. Preserve user changes; fetch before handoff, report upstream drift, and never merge/rebase `main`. The user merges manually.

## Review focus

- A clean selected page can coexist with an unsaved or failed draft elsewhere; Task 5 must test refresh blocking across all pages if draft derivation changes.
- A request can finish after a workspace switch or newer selection; Task 6 must test that late results neither change the active workspace nor steal focus/selection.
- A mutation revision can skip an unrelated remote edit; Task 7 must test that a receipt never advances the fully acknowledged sync cursor past unseen changes.
- Native prompts, request overlap, and mock delays can produce misleading latency; Tasks 1–3 must test timing boundaries, initiator attribution, and sanitized output.
- A changed book can leave moved pages with stale versions or erase drafts; Task 7 must test subsequent saves, transaction rollback, and dirty-page preservation.

## Delivery order and gates

Tasks 1–4 are Phase A and run in order. Task 4 selects or rejects Tasks 5–7 using measured evidence; these are conditional implementation recipes, not authorization to implement every candidate. Task 8 verifies whichever changes were selected. Each selected task is a separate reviewable commit. Continue using PR #39 if requested by the user at execution time; keep the epic open with `Refs #36`.

## Task 1 measurement contracts and synthetic fixtures

**Files:** Create `tests/performance/support/fixtures.ts`, `tests/performance/support/metrics.ts`, and `tests/unit/key-group-performance.test.ts`.

**Interfaces:** `FixtureSize = "small" | "typical" | "large" | "single-page-limit"`; `buildPerformanceFixture(size: FixtureSize): GroupSnapshot`; `percentile(samples: readonly number[], quantile: 0.5 | 0.95): number | null`. Define and export `PerformanceSample` with `action`, `workspaceKind`, `fixture`, `mode`, `profile`, `run`, `outcome`, `paintMs`, `feedbackMs`, and `confirmedMs`; timings are `number | null`. Export `RequestSample` with method, route template, initiator category, start/end, status, and nullable request/response/transfer byte counts. Neither type contains payloads, keys, raw URLs, or arbitrary metadata. Tasks 2 and 4 consume these contracts.

- [x] Write tests for deterministic fixtures, flat books, valid references, exact encoded payload lengths, ceilings, and nearest-rank percentiles. Independently checked assertions include `percentile([9, 1, 5, 3], 0.5) === 3`, `percentile([9, 1, 5, 3], 0.95) === 9`, and `percentile([], 0.95) === null`; reject non-finite/negative duration samples rather than recording them as zero.
- [x] Run `npm test -- tests/unit/key-group-performance.test.ts`; expect failure because the helper modules do not yet exist.
- [x] Implement fixtures with stable IDs/timestamps and mixed text, tables, code, and math. Small: 3 books/10 pages/2 KiB each; typical: 10/100/10 KiB; large: 20/1000/40 KiB. The separate boundary fixture has one 5 MiB page. Pad ASCII text to the exact UTF-8 byte length after adding Markdown; keep every fixture below 50 MiB. Do not repeat private or production documents.
- [x] Implement immutable percentile calculation and safe metric serialization. Test literal forbidden sentinel values supplied as extra runtime properties are omitted; serialize only the explicitly allowed fields, never spread unknown objects into results.
- [x] Rerun the task test; expect all assertions to pass. Commit only these files with `test: define Key Group performance fixtures and metrics`.

## Task 2 browser measurement harness and request contracts

**Files:** Create `playwright.performance.config.ts`, `tests/performance/key-group-responsiveness.spec.ts`, `tests/performance/support/browser.ts`, and `tests/unit/key-group-request-metrics.test.ts`. Modify `package.json` only to add `test:performance: "playwright test --config playwright.performance.config.ts"`. Extend `tests/e2e/key-groups.spec.ts`; extract its API model into `tests/e2e/support/key-group-api-model.ts` if needed to share it without importing a test file.

**Interfaces:** `measureAction(page: Page, context: { action: string; initiator: RequestSample["initiator"] }, perform: () => Promise<void>, assertResult: () => Promise<void>): Promise<{ paintMs: number; requests: RequestSample[] }>`; `seedLibrary(page: Page, snapshot: GroupSnapshot, kind: "local" | "group"): Promise<void>`. Browser helpers consume Task 1's types. A collector exports `drain(): RequestSample[]` and `dispose(): void`; it retains no request/response payload references after calculating byte counts.

- [x] Add browser regressions against the existing implementation: loaded clean page selection issues zero API requests; successful page create/delete issues no confirmation snapshot; book deletion currently performs its documented snapshot refresh. Add missing model create/delete/book routes with real contract shapes and expected-version validation. These characterization tests may pass before production changes and must remain green afterward.
- [x] Write failing helper tests for route-template normalization, unavailable byte metrics as `null`, failed request accounting, and separation of autosave/initial-load/manual-refresh/poll requests from navigation. Use synthetic paths with secret sentinel query/header/body values; assert none appears in the exported JSON. Run `npm test -- tests/unit/key-group-request-metrics.test.ts`; expect missing-helper failures.
- [x] Implement the collector using Playwright request/response events and browser resource metrics. Use a test-only operation context and explicit initiator categories for instrumented calls; overlapping requests that cannot be confidently attributed are `unknown`, never assumed to be navigation. Omit headers, raw URLs, payloads, titles, and error stacks from exported records. Disable Playwright trace/video capture in the performance config by default.
- [ ] Implement measurement boundaries in the browser clock: mark the accepted input event, wait for the specific DOM result, then use presented-frame trace evidence in diagnostic captures to validate the frame boundary. A two-animation-frame timestamp is a labeled paint proxy until validated, not an exact paint measurement. Exclude native prompt dwell and fixture reset time. Keep pending feedback and server-confirmed completion separate from result visibility.
- [x] Reuse the desktop Chromium and Pixel 7 project settings. Run production with `PLAYWRIGHT_WEB_SERVER_COMMAND='npm run start' npm run test:performance` after `npm run build`; refuse to silently reuse a dev server in the performance config. Defaults: 100 measured samples per cell after five warm-ups, across three runs; record sample counts and individual failures. Provide explicit fixture/action/profile filters for diagnostic runs and label any reduced sample count in output.
- [x] Support `mock` and `server` modes. Mock mode is deterministic and useful for request contracts/CPU work only. Server mode must use a separately started local app with a disposable database, real mutation endpoints and unchanged rate limits. Refuse non-loopback hosts and require Task 3's disposable-database preflight to succeed before any fixture mutation; a local app URL alone does not prove its database is safe. Seed Local data through IndexedDB and create Key fixtures via the real group-create contract, mapping returned IDs. Store generated keys only in the test browser, not artifacts. The Task 2 smoke run uses mock mode; real server runs wait for Task 3.
- [ ] Exercise cold group open, cached reopen, loaded Edit/Read/Split switches, dirty switches, page create/delete in books/Unsorted, title/book rename, and populated-book deletion. Reset fixture state outside measured intervals; pace real mutations below 120 per group/minute and respect group-creation limits too. Record unthrottled and 100 ms added latency/10 Mbps profiles separately, plus actual settings/RTT and host information.
- [x] Run the helper tests, then `npm run test:e2e -- tests/e2e/key-groups.spec.ts` on desktop/mobile and a filtered `test:performance` smoke run. Expect request assertions and sanitized artifact generation to pass. Commit with `test: add reproducible workspace performance harness`.

## Task 3 opt-in server attribution

**Files:** Create `src/server/key-groups/performance.ts` and `tests/unit/key-group-performance-server.test.ts`. Modify `src/server/key-groups/authorize.ts`, `runtime.ts`, `service.ts`, and `postgres-store.ts` only at measurement boundaries. Wrap the measured handlers in `src/app/api/key-groups/[groupId]/route.ts`, `changes/route.ts`, `documents/route.ts`, `documents/[documentId]/route.ts`, `folders/route.ts`, and `folders/[folderId]/route.ts`.

**Interfaces:** `withGroupPerformance(request: Request, work: () => Promise<Response>): Promise<Response>` creates an isolated async request context. `measureGroupPhase<T>(phase: "authorize" | "rate_limit" | "store" | "serialize", work: () => Promise<T>): Promise<T>` records inclusive durations in that context. Instrumentation is enabled only when `MDEZ_PERFORMANCE=1`, the app and database hosts are loopback, and the database name ends in `_test`; otherwise opt-in profiling fails closed before calling `work`. Ordinary requests with profiling disabled keep existing response bodies, errors, and cache headers. Responses in validated profiling mode include `x-mdez-performance: disposable`; Task 2 checks this on a non-mutating GET before seeding, even when that read returns 401 without a key. This avoids needing a fixture before validating the fixture database. Use fixed `Server-Timing` labels and a generated request ID; the browser collector consumes only these allowed fields.

- [x] Write tests showing that disabled instrumentation leaves response headers unchanged, unsafe/non-test profiling configurations reject before executing the handler, concurrent requests never share spans, nested durations are explicitly inclusive, a rejected phase propagates its original error, and output contains only numeric durations/counts and a random request ID. Run `npm test -- tests/unit/key-group-performance-server.test.ts`; expect missing-module failures.
- [x] Implement the isolated context with Node `AsyncLocalStorage` and monotonic timing. Do not accept arbitrary log fields or emit SQL parameters. Measure response serialization around `groupJson` construction rather than treating network transfer as serialization. Do not alter authorization order, locking, mutation results, or `cache-control: no-store`.
- [x] Instrument authorization, rate limiting, store work, and route total time. Report store time as inclusive of connection acquisition, lock waits, and SQL until those components have independent evidence. Do not subtract overlapping spans and label the remainder “SQL.”
- [ ] On the disposable database, record effective role, RLS/policy applicability, indexes, query counts, transaction isolation, and relevant `EXPLAIN (ANALYZE, BUFFERS)` findings using synthetic data. Mutation EXPLAIN must be inside a rollback-only transaction in that disposable database. Profile populated-book deletion for per-page queries; inspect pool/lock waits separately. Where precise attribution is unavailable, record it as inconclusive rather than adding a speculative pool or SQL abstraction.
- [x] Run the task tests plus `npm test -- tests/unit/key-group-route.test.ts tests/unit/key-group-mutations.test.ts tests/unit/key-group-service.test.ts`. Expect unchanged response/conflict contracts and isolated timing output. Commit with `perf: add opt-in Key Group request attribution`.

## Task 4 capture baseline and select fixes

**Files:** Create `docs/performance/key-group-baseline.md`; store sanitized machine-readable samples under `docs/performance/data/key-group-baseline/`. Update this plan with measured selections and the user's target decisions.

**Interfaces:** Consume Task 1 samples, Task 2 timelines, and Task 3 server timing. Produce a baseline and a decision record naming which of Tasks 5–7 is selected, why, and the exact comparison cells that will verify it.

- [ ] Run Tasks 2–3 on the unchanged interaction behavior before optimization. Record environment, commit, fixture encoded sizes, seed, command lines, sample counts, p50/p95, failure counts, request counts/bytes and timings, and cold/warm separation. Keep React Profiler/browser CPU diagnostic captures separate from production latency samples and disclose profiling overhead.
- [ ] Inspect expensive commits in `MdezWorkspace`, `useDocumentDrafts`, library/search derivation, CodeMirror, Markdown rendering, and sidebar rendering. Rank measured contributions; list evidence that does not establish causation as a hypothesis.
- [x] Validate exported samples against the allowlist and scan artifacts for synthetic forbidden sentinels. Inspect timelines to ensure background refresh and previous-page autosave were not counted as navigation. If a component is unavailable, name the blocked cells and preserve the remaining results.
- [ ] Obtain product-owner agreement on numeric p95 budgets for cached switch, create/delete completion, and pending feedback on a named reference environment, plus Local regression tolerance. Record the agreed values in the baseline. This is a real decision gate; no unanswered request or elapsed time approves a budget.
- [ ] Select Tasks 5–7 individually, or close a candidate as unnecessary. If database access or target approval is unavailable, commit the partial baseline honestly and keep performance acceptance open; do not call Phase A complete or implement speculative optimizations. Commit the report with `docs: record Key Group performance baseline and selected fixes`.

## Task 5 conditional rendering and draft work

**Files:** Modify `src/hooks/useDocumentDrafts.ts` and, only if profiling identifies it, `src/components/mdez/MdezWorkspace.tsx`. Extend `tests/unit/useDocumentDrafts.test.tsx` and `tests/unit/key-group-conflict.test.tsx`; add `tests/unit/key-group-navigation.test.tsx` for controller contracts.

**Interfaces:** Retain `useDocumentDrafts`' existing public methods and `WorkspaceController.selectDocument(id: string): void`. If refresh safety is affected, add `hasUnsavedDrafts: boolean` to `DocumentDraftController` and consume it in the workspace's `setRefreshBlocked` effect; selected-page `saveStatus` continues to describe that page only.

- [ ] Execute only when Task 4 traces show whole-library serialization/derivation materially affects selection. Write a failing regression using stable document references and instrumented body access: changing selection must not reread every body. Also test an immutable incoming document update still refreshes the visible text. Run the specific unit test and inspect the expected failure before changing production code.
- [ ] Remove repeated body serialization from selection renders. Use stable document identity to drive synchronization, initialize persisted maps lazily, and preserve existing dirty-value comparisons/overlays. Avoid depending on array identity alone if a caller rebuilds arrays on every render; verify actual callers first. No save-delay or storage migration changes.
- [ ] Add regression cases for failed draft A → clean B → refresh → return A, incoming remote updates while A is dirty, simultaneous title/body activity, removal, reverted edits, stale saves, and conflict-copy recovery. Dirty data anywhere must block automatic refresh if this path is changed. Do not claim this solves offline durability.
- [ ] Run `npm test -- tests/unit/useDocumentDrafts.test.tsx tests/unit/key-group-conflict.test.tsx tests/unit/key-group-navigation.test.tsx` and repeat the selected before/after benchmark cells. Expect preserved drafts and a measured improvement with no navigation-triggered requests. Commit with `perf: reduce measured work during loaded page selection`.

## Task 6 conditional mutation feedback and async safety

**Files:** Modify `src/hooks/useKeyGroupLibrary.ts`, `src/components/mdez/MdezWorkspace.tsx`, and the affected action surfaces in `Sidebar.tsx`, `LibraryTree.tsx`, `LibraryPageList.tsx`, `ShelfPane.tsx`, and `EditorPane.tsx` only as needed. Create `tests/unit/key-group-operation-state.test.tsx` and extend `tests/e2e/key-groups.spec.ts`. Reuse `WorkspaceStatus.tsx`.

**Interfaces:** Add optional `pendingOperations: ReadonlySet<string>` and `operationMessage: string | null` to `WorkspaceController`. Use fixed operation keys such as `page:create`, `page:delete:<id>`, `book:create`, `book:rename:<id>`, and `book:delete:<id>`. Local controllers may omit them. The controller owns lifecycle/error state; the workspace combines it with existing draft/conflict status and the single status region.

- [ ] Execute only if Phase A confirms missing feedback or duplicate/late operations in tested flows. Write failing tests with deferred client promises: pending feedback appears before completion, repeat activation causes one mutation, loaded navigation remains available, create/delete failures preserve existing content and show an error, and a late response does not steal a newer selection or populate a different workspace. Run `npm test -- tests/unit/key-group-operation-state.test.tsx`; inspect expected failures first.
- [ ] Track pending operations synchronously before awaiting the request; clear them in `finally`, guarded by workspace lifecycle. Show pending status through the existing region and disable only affected action controls. Retain returned-row application and page deletion without confirmation snapshots. Continue requiring server acknowledgment before opening an editable new page.
- [ ] Track selection intent as well as workspace identity. On acknowledgment, add the row to its still-active originating workspace, but select/reveal it only if the user has not selected something else. Update `handleCreateDocument` so its delayed continuation cannot force Edit mode or close a newly opened drawer after later navigation. Reject/ignore obsolete UI effects without interpreting them as a failed server mutation.
- [ ] Use explicit structural status such as `Creating page...`, `Deleting page...`, and a failure message. Pending must never read as Saved. Preserve draft/conflict errors and do not auto-retry a create after an ambiguous timeout. “Saved in this browser” must not be used to imply remote acknowledgment.
- [ ] Run unit tests and `npm run test:e2e -- tests/e2e/key-groups.spec.ts` on desktop/mobile, including failed saves and a subsequent Local Library create/edit/delete. Inspect keyboard focus, announcements, and duplicate controls. Remeasure feedback/completion separately. Commit with `fix: show truthful Key Group mutation feedback`.

## Task 7 conditional book deletion receipt

**Files:** Modify `src/types/key-group.ts`, `src/server/key-groups/store.ts`, `postgres-store.ts`, `runtime.ts`, `src/app/api/key-groups/[groupId]/folders/[folderId]/route.ts`, `src/lib/key-group-client.ts`, and `src/hooks/useKeyGroupLibrary.ts`. Extend affected fake-store adapters/tests. Create `tests/integration/key-group-delete-receipt.test.ts` and `tests/unit/key-group-delete-receipt.test.tsx`.

**Interfaces:** Add `GroupFolderDeletion = { deletedFolderId: string; revision: number; movedDocuments: GroupDocument[] }`. Return it through `KeyGroupStore.deleteFolder`, runtime, route, and client helper instead of `number`, discarded `void`, and `{ deleted: true }`. In the controller, separate `acknowledgedRevision` from mutation metadata if necessary; refresh uses only the fully applied cursor. The receipt contains records read inside the existing delete transaction.

- [ ] Execute only if Task 4 identifies the book-deletion snapshot as material. Otherwise retain the documented correctness refresh and skip this task. Write failing real-Postgres tests proving returned versions match persisted rows, all pages move to Unsorted, a failed transaction commits nothing, and lock order remains group before book. Add controller tests that editing moved pages uses their returned versions without a full snapshot.
- [ ] Add the unrelated-change test before implementation: start from acknowledged revision 5, receive a deletion receipt at revision 8, then assert the next changes request still uses `after=5` and applies an unrelated update at revision 6. Include a dirty moved page and an overlapping poll so old rows cannot overwrite a newer acknowledged receipt.
- [ ] Run `npm test -- tests/unit/key-group-delete-receipt.test.tsx` and `npm run test:postgres -- tests/integration/key-group-delete-receipt.test.ts`; inspect failures. The latter requires the existing dedicated `MDEZ_TEST_DATABASE_URL` setup and must never target production.
- [ ] Return authoritative moved records plus final revision transactionally, apply the receipt atomically to books/pages/version maps, and choose Unsorted when needed. Preserve dirty overlays. Retain the original acknowledged cursor until change catch-up covers every intervening revision; ignore older entity versions during overlapping application. Keep the existing lock order and conflict outcomes.
- [ ] Rerun those tests, existing mutation/concurrency integration tests, and affected browser tests. Compare payload, query count, and latency against baseline: moved rows may still be large, so do not assume the receipt is automatically cheaper. Commit with `perf: apply authoritative book deletion receipts` only if the selected goal is met.

## Task 8 release verification and PR handoff

**Files:** Update `docs/performance/key-group-baseline.md`, add `docs/performance/key-group-results.md`, and update `README.md`/`PRODUCT.md` only for actual shipped behavior. Update this plan's task checkboxes from executed evidence.

**Interfaces:** The results report maps the agreed budgets and selected tasks to measured outcomes; it lists skipped/deferred candidates and outstanding blockers. No new runtime interface.

- [ ] Repeat the same fixture/environment/action cells after selected changes. Report p50/p95, counts, bytes, server attribution, failures, profiler differences, and Local regression against the agreed tolerance. Keep artifacts sanitized and cold/warm results separate.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. If Task 7 ran, also run `npm run test:postgres` with a dedicated disposable database. Inspect desktop/mobile screenshots and the affected user flows. Record exact failures/unavailable checks; do not mark acceptance green if blocked.
- [x] Request a fresh whole-branch code review against the spec and selected tasks, with particular attention to the five Review Focus cases. Resolve substantive findings with regression tests and rerun affected checks.
- [ ] Confirm the release checkpoint: measured target met, zero navigation-triggered requests for loaded switches, no redundant page-mutation snapshots, documented book exception or verified receipt, safe failure behavior, and Local regression coverage. If server latency still prevents immediate editable creation, report that measured gap and propose the separate outbox spec rather than broadening this implementation silently.
- [ ] Review `git diff --check`, task diff, and `git status --short --branch`; stage only task files, commit, and push the existing PR branch. Fetch origin and report freshness without integrating upstream. Rewrite PR #39's title/body around the final implementation and evidence, use `Refs #36`, leave it draft if required checks or performance acceptance remain blocked, and state that the user merges manually.

## Deferred work

Durable optimistic mutations, broader synchronization hardening, cache/revocation policy changes, and new conflict semantics remain the separate Phases C–E in the spec. They receive their own designs only if the measured release checkpoint requires them. This plan does not add CRDT/OT, client encryption, new retention categories, or a persistent outbox.

## Plan review

Before execution, verify the plan still matches the linked spec and repository. Tasks 1–4 cover profiling, Tasks 5–7 cover conditional fixes, Task 8 covers comparison and handoff, and the deferred section preserves the later-phase boundary. Shared contracts flow from Task 1 to Task 2 to Task 4; server timing flows from Task 3 to Tasks 2/4; conditional receipts flow through the full store/runtime/route/client/controller chain in Task 7. Recheck all consuming signatures when that task is selected.

No implementation work should start from an unchecked assumption that a candidate is slow. The next executable step after plan approval is Task 1.
