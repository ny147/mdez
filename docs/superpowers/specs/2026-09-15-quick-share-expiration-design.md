# Quick Share expiration fix

Date: 2026-09-15
Status: Product decisions confirmed with the user; implementation pending.
Branch: `fix/quick-share-expiration`

## Outcome

Expired Quick Shares must stop displaying content, disappear from Shared links,
and have their server snapshots permanently deleted by automatic cleanup.
There is no Expired section and no restore action.

## Investigation

Code inspection found two client gaps:

- `src/components/mdez/PublicSharedPage.tsx` fetches only when `publicId`
  changes. A successful payload stays in React state indefinitely; there is
  no expiration timer or resume check.
- `src/lib/shared-link-repository.ts` returns all saved links.
  `src/components/mdez/SharedLinksDialog.tsx` renders them all and explicitly
  labels past links Expired. Its unit test currently requires that behavior.

The server already checks `expiresAt <= now` in
`src/server/quick-shares/service.ts`. The public API returns 410 without
Markdown for expired records and uses `Cache-Control: no-store`.
`PostgresQuickShareStore.purgeExpired` deletes expired rows, and `vercel.json`
schedules `/api/cron/quick-shares` daily at 03:17 UTC. The cron endpoint
requires `CRON_SECRET`.

These findings explain stale client content and list entries. They do not
establish that production GET requests or production cleanup are failing.
No production database or scheduler has been inspected or modified.

## Behavior contract

1. A finite share expires when the current time reaches its `expiresAt` instant,
   including equality. `null` continues to mean Never. Existing expiration
   choices and the seven-day default remain unchanged.
2. The server remains the authority for access. Expired GET responses contain
   no title or Markdown. Cleanup timing cannot extend access. After physical
   deletion, 404 is acceptable; keeping tombstones solely to preserve 410 is
   unnecessary.
3. A loaded public reader removes its title and Markdown from rendered content
   and replaces its payload state with the existing expired terminal state at
   the deadline. Check payload expiration before initially rendering it, too.
   Recheck on focus, visibility restoration, and `pageshow` after suspension.
   Suspended browsers update when execution resumes. Previously copied content
   cannot be recalled.
4. Shared links shows only unexpired and Never links, newest first. Filter on
   initial load and remove rows while the dialog stays open. Recheck on resume.
   If a pending deletion expires, dismiss its confirmation. Use the empty-state
   heading `No active shared links` when the last active row disappears.
5. Hide expired browser entries without needing a network request. Preserve
   browser records for this fix rather than introducing destructive local
   cleanup based on a potentially incorrect device clock. Server cleanup deletes
   the actual shared snapshot, including its title and Markdown, on the next
   successful daily run. It leaves future and Never shares untouched.

## Implementation boundaries

- Use npm and the existing package-lock.json; add no dependencies.
- Preserve local source pages, books, drafts, workspace isolation, and Never shares.
- Do not log Markdown, management tokens, credentials, or raw IP addresses.
- Keep the existing daily cleanup schedule and authenticated server-only deletion.
- Deployment and production database operations require explicit authorization.
- Browser expiration is a UI safeguard; do not claim it prevents retention of
  content already delivered to a recipient or bypass of a manipulated client.

Use a small shared deadline watcher with cancellable timers, capped delays
for 30-day shares, and lifecycle checks. Components own their UI transitions;
the watcher only signals that a deadline has passed. Invalid finite timestamps
must not render a share as Never: hide invalid local rows and show the existing
safe error state for malformed public payloads.

## Acceptance checks

| Case | Expected result |
| --- | --- |
| One millisecond before expiration | Reader and list entry remain available |
| Exact expiration and later | Server denies content; open reader clears; list hides |
| Payload expires during fetch | Markdown is never rendered |
| Background tab resumes after expiration | Terminal reader and filtered list |
| 30-day deadline | No early expiration due to timer overflow |
| Never share | Remains readable and listed |
| Last row or pending deletion expires | Empty state; no stale confirmation |
| Cleanup runs twice | Expired rows removed; second run deletes zero |
| Missing or incorrect cron credential | 401 and no cleanup |
| Cleanup delayed or unavailable | Expired server GET still denies content |

## Verification and release

Implement regression tests before code changes. Run lint, typecheck, unit tests,
build, and affected Playwright flows on desktop and mobile. Use an explicitly
configured non-production database to verify actual purge behavior; report its
absence as an unverified integration check. Document scheduler verification in
`docs/operations.md` without claiming production cleanup is healthy.

This specification supersedes displaying expired entries in Shared links. It
retains the original Quick Share design's daily purge and 410-before-purge model.
