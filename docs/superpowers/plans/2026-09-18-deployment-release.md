# Deployment Verification and Manual Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every release verifiable, isolate hosted previews from production data, and require a human production-promotion decision.

**Architecture:** Keep the existing Vercel/Next.js/Supabase production stack. Use disposable Postgres locally and in PR CI; hosted previews exercise local-first features without server storage. Review a Production-configured staged build before manually assigning production traffic.

**Tech Stack:** Node.js 22, npm lockfile, Next.js 15, GitHub Actions, Vitest, Playwright Chromium desktop/mobile, Postgres, Vercel, Supabase.

**Spec:** [Approved release design](../specs/2026-09-18-deployment-release-design.md). Read the [dated audit](../../deployment-audit-2026-09-18.md) before execution.

## Global constraints

- Production is https://mdez.vercel.app/.
- Hosted previews must be disconnected from production storage. Use local disposable Postgres and temporary CI Postgres instead of another hosted Supabase project.
- Every pull request must run real database integration checks, alongside desktop and mobile browser checks.
- Production promotion is manual. Merging and production release are separate decisions.
- Follow AGENTS.md: clean start, fetch, task branch from origin/main, no modification of main, no auto-merge/rebase. Preserve unrelated work.
- This document authorizes no production/configuration/database mutation. Obtain explicit authorization before executing those operational steps; code/test preparation can proceed separately.
- Keep production secrets out of CI, artifacts, terminal output, and browser bundles. Use synthetic database contents only.
- Do not repoint the existing browser suite at production: it resets browser storage and mocks APIs. No production fixture cleanup or database integration tests against remote storage.
- No unrelated dependency upgrades or UI redesign. New code follows the existing project tests and patterns.

## Start here

1. Finish **Task 1: baseline and isolation inventory** (operator: about 20–30 minutes with dashboard access).
2. Implement **Tasks 2–3: preview boundary and CI** (engineering estimate: 1–2 days including tests).
3. Complete **Task 4: preview verification** (about 30–45 minutes).
4. Execute **Task 5: authorized release** (about 30 minutes, plus observing the next daily cleanup runs).

Estimates assume functioning tool access. Every task below is pending; the earlier audit evidence is not a blanket pass for a future commit.

## Task 1: Record the deployment identity and isolate configuration

**Files:** update `docs/deployment-audit-2026-09-18.md`, `docs/self-hosting.md`, `docs/operations.md`; create `docs/releases/YYYY-MM-DD-<short-sha>.md` using the actual release date/SHA at execution time.

**Interface:** produces the release record consumed by Tasks 4–5. Record: date, Git SHA, CI URL, preview URL, staged Production URL/ID, current Production ID, rollback ID, gate results, approval and operator. Never record credential values.

- [ ] In the Vercel project, inspect the deployment serving `mdez.vercel.app`. Record its exact SHA and compare with the successful GitHub run. Do not infer alias identity from the latest deployment record.
- [ ] Record Node runtime, install/build commands, production branch, domain assignment setting, deployment protection, production Postgres major version, three migration states, and recovery/backup availability. Read-only inspection only.
- [ ] With explicit configuration authorization, remove `SUPABASE_DATABASE_URL`, `MANAGEMENT_TOKEN_PEPPER`, `RATE_LIMIT_PEPPER`, `CRON_SECRET`, and `GROUP_KEY_PEPPER` from all Preview scopes/branch overrides/integration injection. Preserve Production values. Record presence/scope only.
- [ ] Inventory old previews that retained production credentials. After Task 2's replacement preview is verified, retire or restrict those old deployments with operator authorization. New environment scopes alone do not prove old deployments are isolated.
- [ ] Record any missing access as a blocked gate with the responsible next action. Commit only documentation changes for this task.

**Acceptance:** exact production identity and isolation work are recorded; no dashboard change is described as completed without evidence. If authorization is absent, keep operational checkboxes open and continue code-only Tasks 2–3.

## Task 2: Make hosted preview sharing explicitly unavailable

**Files:** create `src/middleware.ts`, `tests/unit/preview-boundary.test.ts`, and `tests/e2e/preview-boundary.spec.ts`; modify `src/components/mdez/PublicSharedPage.tsx` and `tests/unit/public-shared-page.test.tsx`; inspect existing `src/lib/quick-share-client.ts` and `src/lib/key-group-client.ts` for error display; update `docs/self-hosting.md`.

**Interface:** Vercel's server-side `VERCEL_ENV=preview` disables both sharing API families and cron endpoints. Response: `{ error: "Sharing is unavailable in this preview. Your local library still works." }`, status 503, `cache-control: no-store`. Other environments pass through unchanged. No public environment variable or database secret is needed.

- [ ] Add failing unit cases that call the middleware under `vi.stubEnv("VERCEL_ENV", "preview")` and assert 503, the exact message, and no-store. Restore environment stubs after each test. Include production and undefined/local pass-through cases. Run `npm test -- tests/unit/preview-boundary.test.ts` and record the expected missing-module failure.
- [ ] Implement this narrow request boundary, preserving any middleware added upstream when execution starts:

```ts
import { NextResponse } from "next/server";

export function middleware() {
  if (process.env.VERCEL_ENV === "preview") {
    return NextResponse.json(
      { error: "Sharing is unavailable in this preview. Your local library still works." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/quick-shares/:path*",
    "/api/key-groups/:path*",
    "/api/cron/quick-shares",
    "/api/cron/key-groups"
  ]
};
```

- [ ] Add a real local preview-mode HTTP browser test (no route mocks) covering collection and descendant URLs, GET/POST/PATCH/DELETE, and both cron paths. Example assertion inside a Playwright test:

```ts
const response = await request.post("/api/quick-shares", {
  data: { title: "Preview audit", markdown: "# synthetic", expiry: "1h" }
});
expect(response.status()).toBe(503);
expect(response.headers()["cache-control"]).toBe("no-store");
expect(await response.json()).toEqual({
  error: "Sharing is unavailable in this preview. Your local library still works."
});
```

  Gate this spec with `test.skip(process.env.VERCEL_ENV !== "preview", "Preview-only boundary test")`. Run it in a separate CI job/server with `VERCEL_ENV=preview`, no database URL, and both Playwright projects. Build with the same environment. Do not set preview mode globally for the normal mocked suite. After checkout/setup-node/npm-ci, the job's steps are:

```yaml
- run: npx playwright install --with-deps chromium
- run: npm run build
  env:
    VERCEL_ENV: preview
- run: npm run test:e2e -- tests/e2e/preview-boundary.spec.ts
  env:
    VERCEL_ENV: preview
    PLAYWRIGHT_WEB_SERVER_COMMAND: npm run start
```

  Name this job `Preview boundary` and preserve the existing browser failure-artifact upload step.
- [ ] In that same isolated preview server, verify the Quick Share and Join/Create Group dialogs surface the message, a fabricated public-share path shows unavailable copy, and paste/edit/reload/export still work. Verify the public-share page obtains data through the guarded API; if upstream code now reads SQL during page rendering, add the same server-side guard before that read. Never permit direct production SQL as a fallback.
  The current public reader maps all non-404/410 failures to a generic error. Add an `unavailable` member to `SharedPageState`, handle 503 before the generic error, and reuse `TerminalState`:

```tsx
// In the response handler, before !response.ok:
if (response.status === 503) return setState({ status: "unavailable" });

// In rendering, before the ready-state reader:
if (state.status === "unavailable") {
  return <TerminalState title="Sharing unavailable"
    message="Sharing is unavailable on this deployment. Your local library still works." />;
}
```

  Add a failing public-reader unit test with a mocked 503 response, assert the new heading/message, and verify 404/410 behavior remains intact. The preview API's exact message remains preview-specific; the public reader's generic 503 copy must not mislabel a production service outage as Preview.
- [ ] Run focused tests, lint, typecheck, full unit/build/browser checks required by AGENTS.md. Commit the boundary and guide updates. After authorized Preview configuration changes, verify the new hosted preview and record evidence in Task 1.

**Acceptance:** preview denial is an HTTP integration result, not merely a unit-tested matcher constant. Existing production/local tests remain unchanged and passing. Secrets are absent from hosted Preview even though the code has a guard.

## Task 3: Require desktop/mobile and disposable database checks on every PR

**Files:** modify `.github/workflows/ci.yml`; create `scripts/test-postgres-bootstrap.sql` and `tests/integration/migration-chain.test.ts`; retain existing `vitest.postgres.config.ts`, `tests/integration/support/postgres.ts`, `tests/integration/key-group-flat-books.test.ts`, `tests/integration/key-group-concurrency.test.ts`, and `tests/integration/quick-share-cleanup.test.ts`; create `tests/integration/key-group-cleanup.test.ts` if its behavior is not covered when execution begins. Update `docs/self-hosting.md` and `docs/operations.md`.

**Interfaces:** existing `npm run test:postgres` consumes `MDEZ_TEST_DATABASE_URL`; use a fresh local service database named `mdez_test`. A separate `mdez_chain_test` database is reserved for applying the complete migration chain. Existing flat-book upgrade fixtures must retain their old-schema setup.

- [ ] Change the normal production-mode browser step from `npm run test:e2e -- --project=chromium` to `npm run test:e2e`. This uses both existing projects. Preserve failure artifacts. Add Task 2's separate preview-boundary job without sharing a live server or `.next` output with the normal job.
- [ ] Add a `Database integration` job on the existing `pull_request`, `push: main`, and manual triggers. Use checkout/setup-node/npm-ci like `Verify`, a 15-minute timeout, and the following service configuration. PostgreSQL 17 is a proposed baseline; confirm against the production major version in Task 1 and match it before accepting this gate.

```yaml
services:
  postgres:
    image: postgres:17
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: mdez_ci_only
      POSTGRES_DB: mdez_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres -d mdez_test"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 12
env:
  MDEZ_TEST_DATABASE_URL: postgres://postgres:mdez_ci_only@127.0.0.1:5432/mdez_test
  MDEZ_CHAIN_DATABASE_URL: postgres://postgres:mdez_ci_only@127.0.0.1:5432/mdez_chain_test
```

  These credentials are disposable service-container fixtures, not GitHub secrets. Install `postgresql-client` in the Ubuntu job if `psql` is unavailable. Bootstrap only this fresh container:

```sql
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE DATABASE mdez_chain_test;
```

```sh
psql "$MDEZ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/test-postgres-bootstrap.sql
npm run test:postgres
```

- [ ] Add a migration-chain test using `postgres` and `readFileSync`. Refuse a chain URL unless its database ends in `_test`, its host is `localhost` or `127.0.0.1`, and it differs from `MDEZ_TEST_DATABASE_URL`. On the fresh `mdez_chain_test` database apply, in order:

```ts
const migrations = [
  "supabase/migrations/202608090001_quick_shares.sql",
  "supabase/migrations/202608090002_key_groups.sql",
  "supabase/migrations/202609110001_flat_books.sql"
];
for (const file of migrations) {
  await sql.unsafe(readFileSync(file, "utf8"));
}
const rows = await sql<{ name: string | null }[]>`
  select to_regclass('public.quick_shares')::text as name
  union all select to_regclass('public.key_groups')::text
  union all select to_regclass('public.group_folders')::text
  union all select to_regclass('public.group_documents')::text
`;
expect(rows.every((row) => row.name !== null)).toBe(true);
```

  Also assert the flat-books constraint rejects non-null `parent_id`, RLS is enabled, and anon/authenticated have no table privileges. Close the SQL connection in `afterAll`. Do not add resets that make rerunning against an existing database look safe: recreate the disposable container for another clean-chain run.
- [ ] Keep existing upgrade/concurrency/share-cleanup tests and add missing real-SQL coverage for Key Group delete → restore before seven days, purge at/after the deadline, retention of active/unexpired groups, cascading removal of expired group children, and cleanup idempotency. Use synthetic rows and exact clock instants. Run the added tests red before implementation changes; fix any exposed defect in a separately reviewed commit. Do not mark unit/mocked coverage as SQL coverage.
- [ ] Demonstrate successful clean CI execution and that a deliberately failing assertion fails the relevant job; remove the deliberate failure. With explicit repository-settings authorization, require `Verify`, `Database integration`, and the preview-boundary job before merge, and verify fork PRs need no production secrets. Record unavailable branch-protection controls as a blocked gate. Commit CI/tests and the reproducible local instructions.

**Acceptance:** PR CI checks both device projects, real SQL, fresh and upgrade migrations, and preview denial. Record test counts and run URL. This does not certify deployed Supabase configuration or end-to-end hosted sharing; Task 5 covers that separate evidence.

## Task 4: Verify the hosted local-only preview

**Files:** update the dated release record and `docs/operations.md`. Do not change the application's origin or migrate IndexedDB.

**Interface:** consumes an exact successful PR SHA and its Preview URL; produces desktop/mobile smoke evidence. Use a new browser profile with synthetic Markdown.

- [ ] At desktop 1440px and mobile 390px, paste a synthetic Markdown page, edit a unique marker, wait for saved status, reload, and verify the marker in Read. Check lists, code, math, dark/light appearance, reader controls, and no horizontal page overflow.
- [ ] Create two books, move a page, search body text, bookmark and resume it, then export one page and a book ZIP. Verify downloaded contents match synthetic fixtures. Keep fixture ownership explicit; do not clear a user's existing browser library.
- [ ] Preview/import a small public Markdown repository. Record repository URL and fixture revision. Refresh after a local edit and confirm overwrite messaging; simulate a failed fetch in the local suite and verify original content survives. Check deployed invalid/unavailable responses without load-testing GitHub or production.
- [ ] Attempt sharing/group access and confirm the explicit 503/unavailable state. Verify local content remains editable. No real sharing records should be created by a hosted Preview.
- [ ] Save each result with URL, SHA, viewport and timestamp. Treat provider-specific archive size/timeouts as pending unless actually exercised; run boundary fixtures locally and inspect Vercel function configuration separately. Stop on data loss, save failure, unexpected production access, or failed required checks.

**Acceptance:** preview smoke evidence matches the reviewed commit. A later commit requires affected checks again; do not reuse evidence silently.

## Task 5: Stage, promote manually, verify and retain rollback evidence

**Files:** update `docs/operations.md`, the release record, and `README.md` if the stable production URL changes. Hosting/database changes are operator actions, not automatic consequences of a code merge.

**Interface:** consumes successful checks, preview evidence, approved main SHA and a previous compatible Production deployment; produces an explicitly approved promotion and verified alias identity.

- [ ] With explicit hosting authorization, disable automatic Production domain assignment under Vercel Project → Settings → Environments → Production → Branch Tracking. Record the current deployment before changing the setting. Verify the project-provided `mdez.vercel.app` alias also stays fixed when a staged build is created; do not rely only on the toggle's label.
- [ ] After the user merges, verify CI for the actual resulting main SHA. Build a staged Production deployment through the configured Vercel Git workflow. If using the CLI on a verified checkout instead, the documented staging command is `vercel --prod --skip-domain`. Record deployment ID, SHA, Node/build settings, required environment-variable presence, existing migration state, and the compatible rollback ID. Do not use Preview variables or promote an unreviewed rebuild.
- [ ] Inspect the staged URL as production-sensitive. Verify basic local-library behavior and logs without printing bodies or secrets. Before any shared-data smoke, get explicit approval for the synthetic payloads, target deployment/database, and cleanup. Do not test destructive expiry/purge fixtures here. If a migration is needed, prepare a separate reviewed migration/backup/rollback procedure and obtain authorization; do not apply one as a routine test setup.
- [ ] Ask the user to approve the exact staged deployment and production domain. Promote that staged build manually in the dashboard. Record the approval and resulting alias → deployment → SHA mapping. No auto-merge, automatic branch deletion, or promotion from CI.
- [ ] On the stable production origin, verify the local smoke flow and, if authorized, one synthetic Quick Share and a synthetic Key Group using two isolated browser sessions. Test read/join/save and verify no key enters a URL. Use application-supported cleanup only for owned fixtures with authorization. Inspect scheduler history for successful Quick Share (03:17 UTC) and Key Group (03:43 UTC) runs. Record the last successful run and outcome; if no eligible run has occurred yet, leave operational verification pending until the next scheduled run.

**Failure/rollback rule:** failed saving, sharing, data isolation, or required checks stops promotion. After promotion, the operator restores the recorded compatible application deployment if a material regression appears. Schema/data are not automatically rolled back; stop and investigate when the previous app is incompatible. Never drop tables or rotate peppers as a rollback shortcut. Recheck alias identity and core behavior after rollback, and record the incident.

**Acceptance:** all release gates have evidence, or the release is explicitly held. Inspecting a route's 401 response alone never closes the scheduler gate. Promotion approval is not permission to run unrelated production database operations.

## Final handoff

- [ ] Run the required application checks for implementation changes; for this planning-only change, review links, accuracy, and `git diff --check` without claiming unrun tests.
- [ ] Confirm the final task branch and task-owned diff. Commit only owned files, fetch origin, report behind status, push with upstream, and open a PR targeting main; use draft when required checks are blocked.
- [ ] Link the release/audit evidence and state what remains operationally pending. The user merges manually. Deployment and promotion require their own explicit approval.

## Plan self-review

Approved decisions map to Tasks 1–2 (isolation), Task 3 (every-PR checks), and Tasks 4–5 (review/manual release). Audit facts are separated from desired future state. A staged Production URL is explicitly production-sensitive; no hosted test database is introduced. Existing upgrade fixtures are separated from the fresh migration-chain database. This plan has not been executed.
