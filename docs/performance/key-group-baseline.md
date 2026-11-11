# Key Group baseline: partial diagnostic evidence

PR #39's profiling foundation is implemented. **Phase A acceptance remains open.** These are reduced diagnostic runs, not a release benchmark or proof that a performance target is met. No Phase B optimization is selected.

## Reproduce

Use Node 22, `npm ci`, and `npm run build`. The dedicated performance configuration starts `npm run start -- --port 3100`, refuses an existing server, and disables traces, videos, and screenshots. It uses desktop Chromium and Pixel 7 emulation. Pixel emulation does not identify physical mobile performance.

PowerShell diagnostic example:

```powershell
$env:PERF_FIXTURE='small'
$env:PERF_PROFILE='unthrottled'
$env:PERF_SAMPLES='1'
$env:PERF_RUNS='1'
$env:PERF_WARMUPS='0'
npm.cmd run test:performance
```

Remove these overrides for the full matrix: 100 samples **per run**, three runs, five excluded warm-ups per run. `PERF_ACTION` accepts comma-separated names from `tests/performance/support/metrics.ts`; `PERF_FIXTURE` accepts `small`, `typical`, `large`, or `single-page-limit`; `PERF_PROFILE` accepts `unthrottled` or `latency`. The latter applies CDP's 100 ms latency and 10 Mbps upload/download settings. Reports include the actual settings and an observed HEAD-asset round trip, which includes app processing and is not a network-only RTT.

Reports are saved to `playwright-report/performance/<cell>/sanitized-performance.json`. Copy only those files for sharing. The retained evidence is under [data/key-group-baseline](data/key-group-baseline/). Raw Playwright error contexts and diagnostic browser traces are not sanitized sharing artifacts.

Fixtures use seed 36, fixed timestamps, distinguishable synthetic Markdown bodies containing tables, code and math, and exact UTF-8 lengths. Small is 3 books/10 pages/2 KiB each; typical is 10/100/10 KiB; large is 20/1,000/40 KiB; the separate boundary fixture has a single 5 MiB page. Non-Unsorted pages populate every book. Large successful-create cells prepare 999 pages outside timing to leave room under the 1,000-page ceiling. Reports disclose prepared counts and the number of moved pages for book deletion. One-page fixtures skip workloads requiring two pages or a populated book.

## Real-server mode

Start a separate **production** app against a dedicated, migrated local Postgres database. Set server-only `MDEZ_PERFORMANCE=1`, `SUPABASE_DATABASE_URL` with a loopback host and a database name ending in `_test`, and the existing independent `GROUP_KEY_PEPPER` and `RATE_LIMIT_PEPPER` values. Connection-string query overrides are rejected in profiling mode. Never use production credentials or a remote database.

Set `PERF_MODE=server`, `PERF_BASE_URL` to that loopback app, and select exactly one fixture/action/profile per invocation. The harness checks both the disposable-database and production-runtime response markers **before sampling or creating fixtures**. It creates synthetic groups through the real API and keeps generated keys in the test browser. Returned server IDs are used for reset operations. Reset uses authoritative versions, and mutations are paced outside measured intervals; rate limits remain enabled. Each desktop/mobile invocation creates at most two groups, but repeated invocations still count toward the unchanged five-groups/hour address limit. Wait for that window rather than clearing rate-limit buckets.

The implementation session used a task-owned `postgres:17-alpine` Docker container bound to loopback port 55439, database `mdez_performance_test`, and the repository migrations. The flat-book migration was applied in one transaction. The initial autocommit attempt failed because its temporary tables use `ON COMMIT DROP`; the transaction run succeeded. This database is disposable and does not represent the deployed Supabase environment.

## Interpretation and boundaries

Retained runs used Windows 10.0.26300, AMD Ryzen 5 7500F (12 logical CPUs), approximately 16 GiB RAM, Chromium 148.0.7778.96, desktop 1280×720 and the existing Pixel 7 viewport. App and database were on this host; CPU throttling was 1 and the retained runs were unthrottled. Raw metadata supplies the viewport, configured network settings, sample counts, source hash and commit. Mock smoke captures were made while implementation was uncommitted; their commit field identifies an ancestor, not a complete source revision. Their differing source hashes are not an interchangeable before/after comparison.

The isolated mock smoke contains 56 successful measured actions: 13 Local and 15 group cells per project, one sample each with no warm-ups. The separate contended run retains one failed Local Edit-switch sample and is excluded from representative timing claims.

The real-server capture uses application commit `505048d`, small fixtures, Edit, one warm-up and three measured samples per run across three runs: nine samples per table row, 72 in total, zero failures. For each row, nearest-rank p95 is the **maximum of only nine samples**. These are diagnostic observations, not stable percentiles or agreed budgets.

| Project | Workspace | Create in | n | p50 proxy ms | p95 proxy ms |
| --- | --- | --- | ---: | ---: | ---: |
| Chromium | Local | Unsorted | 9 | 63.5 | 79.9 |
| Chromium | Local | Book | 9 | 64.0 | 79.6 |
| Chromium | Key Group | Unsorted | 9 | 77.0 | 77.4 |
| Chromium | Key Group | Book | 9 | 62.8 | 1364.0 |
| Pixel 7 emulation | Local | Unsorted | 9 | 76.8 | 95.0 |
| Pixel 7 emulation | Local | Book | 9 | 78.8 | 91.5 |
| Pixel 7 emulation | Key Group | Unsorted | 9 | 63.4 | 93.8 |
| Pixel 7 emulation | Key Group | Book | 9 | 63.4 | 81.0 |

The 1364 ms desktop group-book outlier is retained. Its cause has not been established by a CPU/frame trace; do not infer database or rendering causation from the aggregate alone. The server capture ran after the full browser suite completed.

To reproduce that reduced server capture, start the separately configured disposable production app, then set `PERF_MODE=server`, `PERF_BASE_URL=http://127.0.0.1:3101`, `PERF_FIXTURE=small`, `PERF_ACTION=create-page`, `PERF_PROFILE=unthrottled`, `PERF_SAMPLES=3`, `PERF_RUNS=3`, and `PERF_WARMUPS=1`. Run `npm.cmd run test:performance -- --output=playwright-report/performance-server`. Generated keys remain in the browser. The task-owned app and database are removed at handoff, so a new disposable environment is needed for a later run.

- Each accepted click, input, or key event is marked in the browser clock. Inline rename setup occurs before the accepted Enter event. Fixture reset, sample pacing and native confirmation dwell are excluded.
- The result endpoint is a **two-animation-frame paint proxy**, after a specific DOM result. Presented-frame trace validation has not been completed. Do not describe these timings as exact paint latency.
- Cold group open reloads the page and clears the snapshot cache; cached reopen reloads while keeping the cache. Both await the opening GET and loaded editor state, avoiding retained-hook-memory measurements.
- Loaded switches assert the selected title and distinguishable body. Mobile waits for the application's automatic drawer closure instead of adding a separate close click to the timed action.
- Request records include fixed route templates, browser-clock start/end, status, available numeric byte counts, fixed server spans and random correlation IDs. Missing metrics remain `null`. Unfinished attempts are retained with null completion/status; failed action records retain their sanitized timelines. No request headers, URLs, keys, titles, Markdown or error stacks are exported.
- Temporal overlap is insufficient attribution: ambiguous document PATCH requests and background GETs remain `unknown`. A previous-page PATCH during navigation is classified as autosave. Separate poll/focus/manual-refresh correlation remains inconclusive when the harness cannot prove its initiator.
- Pending feedback is observed only for recognized status messages; absent feedback remains `null`. Confirmation timing requires a confidently attributed mutation; an ambiguous PATCH is not treated as acknowledged save latency.
- Dirty-switch cells require an unsaved/saving status immediately before selection. Controlled pending/failed-save variants and stronger pre-acceptance correlation remain additional coverage work; existing draft/conflict unit regressions remain unchanged.

## Server attribution

The opt-in headers report inclusive total, authorization, rate-limit, store, and serialization durations/counts. AsyncLocalStorage isolates requests. Store time includes connection acquisition, lock waits and SQL; it is not SQL-only time. Nested or overlapping phases must not be subtracted to infer SQL duration. Serialization wraps actual JSON construction. Ordinary responses keep their existing bodies, statuses and cache behavior with profiling disabled.

Disposable-database inspection found role `postgres`, superuser/BYPASSRLS true, `read committed` isolation, RLS enabled without FORCE RLS on the four group tables, and zero policies. The expected primary/unique indexes and group/order/cursor indexes exist. This role bypasses RLS; these observations cannot establish production RLS overhead.

[Query plans](data/key-group-baseline/disposable-query-plans.txt) include a synthetic invalid-digest authorization lookup using the digest index, a small-library read, and a synthetic moved-row update inside `BEGIN`/`ROLLBACK`. The update plan is an isolated SQL diagnostic, **not** a measurement of the application's complete deletion transaction or its group-before-book lock order. The small read chose a sequential scan; this does not establish a missing index. Pool/lock waits and actual per-request SQL counts remain unattributed. Source shows per-page book-delete work, which remains a hypothesis requiring populated-library profiling.

## Decisions and remaining acceptance work

| Candidate | Decision | Evidence still required |
| --- | --- | --- |
| Rendering/draft derivation | Unselected | Separate React/CPU profiling and representative before/after cells |
| Mutation feedback/async safety | Unselected | Agreed feedback target; delayed/failing mutation measurements |
| Book deletion receipts | Unselected; retain authoritative snapshot | Populated deletion cost, payload comparison and cursor/version safety tests |

Cached-switch p95, create/delete p95, pending-feedback p95, reference environment and Local regression tolerance are **pending explicit numeric agreement**. The user affirmed the target questions without supplying values; no values are inferred.

The full fixture/profile/sample matrix, presented-frame validation, separate React/CPU attribution, controlled failed-draft workloads, production-like database role/region comparison, and performance budgets remain open. Reduced samples and mocks do not close those gates. No optimization, outbox, replacement sync engine, deployment, or production database operation was performed. Refs #36.
