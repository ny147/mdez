# Production audit — 2026-09-18

**Target:** https://mdez.vercel.app/

**Scope:** limited live browser/HTTP audit and repository inspection; not a complete release certification.

## Observed

| Check | Evidence | Limit |
| --- | --- | --- |
| Application reachable | HTTP 200 on the root; Vercel response headers | Does not identify the aliased Git commit |
| Basic local library | Imported a synthetic page named `Deployment audit — 2026-09-18`; read its list/code block; reloaded and found it in Recent and Continue writing | Fixture remains in the audit browser's IndexedDB; no shared fixture was created. Separate edit/autosave and export checks were not run |
| Recent UI features | Dark appearance, theme switch control, reader text-size controls, and code-copy control visible | Theme switching, size persistence, clipboard, and full responsive coverage not tested |
| Security headers | HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, restrictive device Permissions-Policy, strict-origin-when-cross-origin Referrer-Policy | Limited header inspection, not a security audit |
| Cleanup authorization | Both `/api/cron/quick-shares` and `/api/cron/key-groups` returned 401 without credentials | Does not prove CRON_SECRET is configured or jobs execute successfully |
| Latest main CI | [Run 35300113125](https://github.com/ny147/mdez/actions/runs/35300113125), success for `5c477178a38ecc85d041bd88946035b4b3adfe79` | Historical evidence for that commit only |
| Deployment record | [GitHub deployment 6516347871](https://api.github.com/repos/ny147/mdez/deployments/6516347871) and its [successful status](https://api.github.com/repos/ny147/mdez/deployments/6516347871/statuses), same SHA; environment named `Production – mdez-lhs3` | Generated URL `https://mdez-lhs3-9ysgnlpjh-ny147s-projects.vercel.app`; current production-alias mapping remains unverified |

## User-reported and approved

The user confirmed that Preview shares the production database. This was not independently inspected in the hosting dashboard. Approved replacement: no hosted Preview database, disposable local/CI Postgres, real database checks on every PR, manual production promotion.

## Repository findings

- `.github/workflows/ci.yml` currently runs only the `chromium` Playwright project and does not run `npm run test:postgres`.
- `playwright.config.ts` already defines `chromium` and `mobile`; its server/base URL is local, not a deployed smoke-test target.
- Quick Share and Key Group browser suites mock their APIs. Integration suites exercise actual SQL separately.
- Existing integration helpers require an `_test` database. Plain Postgres needs `anon` and `authenticated` roles for the migrations' REVOKE statements.
- The flat-books test deliberately creates old nested data and applies the migration inside a rolled-back transaction. Do not globally pre-apply that migration before this upgrade test.
- `vercel.json` declares daily cleanup at 03:17 UTC (Quick Share) and 03:43 UTC (Key Groups).
- The archive route declares Node runtime, a 20-second maximum duration, and a 15-second upstream timeout. Vercel behavior at limits has not been exercised.

## Pending release evidence

| Gate | Required evidence |
| --- | --- |
| Hosting identity | Production alias → deployment ID → Git SHA; project/runtime configuration |
| Environment isolation | Preview scopes/overrides and older deployments no longer expose production credentials; Production retains required configuration |
| Database readiness | Actual production Postgres version, migration state, pooler connectivity, and recovery/backup availability; no secrets in the record |
| Real database checks | CI run with fresh/upgrade migration coverage, sharing persistence, concurrency, expiry and cleanup |
| Preview smoke | Desktop/mobile import, edit/autosave/reload, GitHub refresh/failure preservation, export, and unavailable sharing behavior |
| Production operations | Authorized synthetic sharing smoke, successful scheduler history, rollback target and manual promotion evidence |

No production sharing records, secrets, migrations, deployment settings, or scheduled jobs were changed in this audit. No claim is made that production is ready for the next release.

Next: use the current release procedure in [Operations](operations.md) and retain
the resulting evidence in a dated release-candidate record.

## Implementation evidence — 2026-09-21

The implementation is preserved as draft [pull request 19](https://github.com/ny147/mdez/pull/19). Application release candidate `f9dc7a8b36f6a8c54e7dd3401c5b7a1988f7de6f` adds the Preview sharing boundary and the CI gates; it has not been merged or promoted.

| Check | Evidence | Limit |
| --- | --- | --- |
| Required CI jobs | [Run 35602609742](https://github.com/ny147/mdez/actions/runs/35602609742): `Verify` passed in 4m57s, `Preview boundary` in 1m13s, and `Database integration` in 49s | Repository branch protection has not yet been inspected or changed |
| Real database checks | PostgreSQL 17 service; five test files and seven tests passed, including fresh/upgrade migrations, RLS and privileges, flat-books upgrade behavior, and both cleanup paths | Production PostgreSQL major version and migration state remain operator evidence |
| Negative control | [Run 35510132439](https://github.com/ny147/mdez/actions/runs/35510132439) failed only the deliberately inverted cleanup assertion (`expected 1 to be 2`); the assertion was restored in the next commit | This proves the gate observes that regression, not every possible database failure |
| Hosted Preview | Deployment `CTEPmgAhcKYWBicCB2ynfTF8aJVe` at `https://mdez-rkiaa8oft-ny147s-projects.vercel.app/` was protected by Vercel authentication | Two Vercel projects were visible for the pull request; the canonical project and older deployment inventory remain unconfirmed |
| Desktop Preview smoke | At 1440×900, a synthetic local page passed edit, autosave, reload, reader rendering, search, bookmark/resume, theme switching, Markdown export, public GitHub preview/import, and direct unavailable-share rendering | GitHub refresh opened its overwrite confirmation, but post-dismissal state could not be re-inspected after a browser-control focus failure |
| Mobile Preview smoke | Both configured Playwright projects passed the application-level Preview boundary in CI | Hosted 390px validation was blocked: the authenticated Chrome session did not adopt the requested viewport, while the controllable in-app browser could not pass Vercel authentication |

Still pending operator authorization and evidence:

- confirm the production alias, Vercel project, deployment ID, Git SHA, runtime settings, Preview secret scopes, and older Preview inventory;
- confirm the Production PostgreSQL version, migrations, pooling, backup, and recovery posture;
- configure or verify required branch-protection checks;
- complete authenticated hosted-mobile smoke testing and any synthetic sharing submission;
- merge and promote manually only after every gate is accepted.
