# Quick Share Expiration Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Clear expired public readers, hide expired creator links, and verify automatic snapshot deletion.

**Architecture:** Preserve server expiration enforcement and daily Postgres cleanup. Add a reusable browser deadline watcher, filter creator links, and have each open UI transition at its deadline and on browser resume.

**Tech Stack:** Next.js App Router, React, TypeScript, Dexie, Postgres, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-15-quick-share-expiration-design.md`

## Global constraints

- Use npm and the existing package-lock.json; add no dependencies.
- Preserve local source pages, books, drafts, workspace isolation, and Never shares.
- Do not log Markdown, management tokens, credentials, or raw IP addresses.
- Keep the existing daily cleanup schedule and authenticated server-only deletion.
- Deployment and production database operations require explicit authorization.
- Resume on `fix/quick-share-expiration`; do not recreate the branch or discard its documents.

## Task 1: Deadline watcher and public reader

Files: create `src/lib/share-expiration.ts` and `tests/unit/share-expiration.test.ts`;
modify `src/components/mdez/PublicSharedPage.tsx` and
`tests/unit/public-shared-page.test.tsx`.

Interfaces to introduce:

```ts
export function isShareExpired(expiresAt: string | null, now = Date.now()): boolean {
  return expiresAt !== null &&
    (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now);
}

export function watchShareExpiration(
  expiresAt: string | null,
  onExpire: () => void
): () => void;
```

- [x] Write fake-clock tests with `now = 2026-09-15T00:00:00Z` and a deadline one
  second later. Assert availability at +999ms, expiry at +1000ms, no callback
  for null, cancellation on unsubscribe, and no early expiry for a 30-day share.
  Add focus, visible `visibilitychange`, and `pageshow` checks after moving the
  system clock past the deadline without executing queued timers.
- [x] Run `npm test -- tests/unit/share-expiration.test.ts`; confirm missing
  behavior fails before implementation.
- [x] Implement the watcher: check immediately, calculate remaining milliseconds,
  and schedule a timeout capped at `2_147_483_647`. At every wake, recompute
  remaining time; expire once or reschedule. Register the three lifecycle
  listeners and return a function clearing the timeout and all listeners.
  Null returns a no-op unsubscribe function. Keep browser access inside the
  watcher, so importing the pure predicate does not touch `window`.
- [x] Add a reader regression based on this exact clock sequence:

```tsx
vi.useFakeTimers();
vi.setSystemTime(new Date("2026-09-15T00:00:00Z"));
vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
  publicId: "abc", title: "Guide", markdown: "# Private snapshot",
  createdAt: "2026-09-14T00:00:00Z", expiresAt: "2026-09-15T00:00:01Z"
}))));
render(<PublicSharedPage publicId="abc" />);
await act(async () => { await vi.advanceTimersByTimeAsync(0); });
expect(screen.getByRole("heading", { name: "Private snapshot" })).toBeVisible();
await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
expect(screen.queryByRole("heading", { name: "Private snapshot" })).toBeNull();
expect(screen.getByText("This shared page has expired")).toBeVisible();
```

  Import `act` from Testing Library and restore real timers after each test.
  Also cover already-expired 200 payloads, malformed timestamps, null expiry,
  unmount, and an old fetch resolving after `publicId` changes.
- [x] Run `npm test -- tests/unit/public-shared-page.test.tsx` and record the
  failing expiration regression. Before setting ready state, check timestamp
  validity and expiry. Ignore aborted/stale fetch completions. In a separate
  effect watching ready state, subscribe to the deadline and replace ready
  state with `{ status: "expired" }`; return unsubscribe on state change.
- [x] Run both targeted test files. Review the diff and commit only these files
  with message `fix: expire loaded Quick Share readers`.

## Task 2: Active-only creator list

Files: modify `src/lib/shared-link-repository.ts`,
`src/components/mdez/SharedLinksDialog.tsx`,
`tests/unit/shared-link-repository.test.ts`, and
`tests/unit/shared-links-dialog.test.tsx`.

Consumes `isShareExpired` and `watchShareExpiration` from Task 1.
Preserve `listSharedLinks(): Promise<StoredSharedLink[]>` and its newest-first
ordering. Do not delete browser records as a side effect of listing.

- [x] Add repository tests with past, equal-now, future, invalid, and null
  timestamps. Expect only future and null rows, in newest-first order. Verify
  excluded rows still exist in `db.sharedLinks` and source documents survive.
  Freeze `Date.now` with a spy so IndexedDB scheduling uses real timers.
- [x] Run `npm test -- tests/unit/shared-link-repository.test.ts`; confirm the
  active-only assertion fails. Filter the existing ordered result:

```ts
const links = await db.sharedLinks.orderBy("createdAt").reverse().toArray();
const now = Date.now();
return links.filter((link) => !isShareExpired(link.expiresAt, now));
```

- [x] Replace the test requiring the Expired label with assertions that expired
  rows are absent. Add fake-clock tests for a row expiring while the dialog is
  open, the last row disappearing, an expiring deletion confirmation, resume,
  and close/unmount cleanup. Keep existing successful/failed early deletion tests.
- [x] Run `npm test -- tests/unit/shared-links-dialog.test.tsx`; record failures.
  Filter again at the component boundary because mocked or delayed list results
  can be stale. Subscribe to the earliest finite active deadline while open.
  On expiration, filter state and clear a matching pending deletion. Resubscribe
  when links change; unsubscribe on close. Change the empty-state heading to
  `No active shared links`. Remove the obsolete Expired label branch.
- [x] Run both targeted files and Task 1 tests, review the diff, and commit the
  four task files with message `fix: hide expired creator share links`.

## Task 3: Server and cleanup verification

Files: extend `tests/unit/quick-share-service.test.ts`,
`tests/unit/quick-share-route.test.ts`, and `tests/unit/quick-share-runtime.test.ts`;
add `tests/unit/quick-share-cron.test.ts`. Consult
`src/server/quick-shares/postgres-store.ts` and the existing Postgres test setup
before extending its integration suite. Update `docs/operations.md` and README.md.

Interfaces retained: `readQuickShareService(publicId, { store, now })`,
`purgeExpiredQuickShares(now, store)`, and cron `GET(request)`.

- [x] Add service assertions at one millisecond before, exactly at, and after
  expiration. Assert `EXPIRED` at equality and `NOT_FOUND` after the record is
  purged. Keep null-expiry reads available. The existing service should pass;
  do not manufacture server changes if enforcement is already correct.
- [x] Extend route tests to assert 410 contains no Markdown/title and has
  `cache-control: no-store`. For cron tests, mock `purgeShares`; missing/wrong
  credentials must return 401 without calling it, correct credentials return
  counts, and rejected cleanup returns the generic 500 message.
- [x] Run the targeted Quick Share service, route, runtime, and persistence tests.
- [ ] In an explicitly configured test database, insert four isolated fixture
  records: past, equal-now, future, and null expiry. Call the actual Postgres
  store purge with that fixed instant; expect two removed and two retained.
  Run it again; expect zero. Remove only test fixtures afterward. Run
  `npm run test:postgres`; if the test database is absent, record the blocker
  and do not substitute a production connection.

  Blocked on 2026-09-16: `MDEZ_TEST_DATABASE_URL` is not configured. The command
  reached the dedicated-test-database guard and did not connect to PostgreSQL.
- [x] Update operations guidance: access denial is immediate; physical deletion
  occurs on the next successful daily 03:17 UTC run. Describe checking scheduler
  invocation, authorized response counts, and fixture removal. State that a
  failed job requires operator investigation and never prolongs API access.
  Clarify this timing in README storage wording. Commit only task-owned files.

## Task 4: Browser regression and handoff

Files: modify `tests/e2e/quick-share.spec.ts` and reuse `playwright.config.ts`.

- [x] Replace the fixed August 2026 finite mock expiry with a future timestamp
  derived from the test clock so active-share tests do not become expired tests.
  Update the existing empty-state assertion to `No active shared links`.
- [x] Add browser tests using a fixed installed Playwright clock: load a reader
  with expiry in one second, advance past it, and assert its heading disappears
  and the expired terminal state appears. Create a finite share through mocked
  POST, open Shared links, advance its deadline, and assert the row disappears.
  Reopen the dialog and verify it stays hidden. Keep Never and failed-deletion
  flows as controls. Run on the configured desktop and mobile projects.
- [x] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
  `npm run test:e2e -- tests/e2e/quick-share.spec.ts`. Inspect every result and
  check desktop/mobile terminal and empty-state layouts for overflow and focus.
- [x] Review `git diff --check`, all task changes, and
  `git status --short --branch`. Commit only task-owned changes, fetch origin,
  and report `git rev-list --count HEAD..origin/main`; do not integrate main.
- [ ] Push with `git push -u origin fix/quick-share-expiration`. Create or update
  the PR targeting main with actual verification results. Keep it draft if any
  required check is blocked or failing. The user merges manually.

## Planning handoff

This commit contains the specification and plan only. No runtime bug fix or
production cleanup verification is claimed. Review document accuracy and diff
for this planning change; application test gates apply when executing the plan.
