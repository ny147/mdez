# Deployment verification and manual releases

Date: 2026-09-18. Status: user-approved direction; implementation not started.

## Approved decisions

- Production is https://mdez.vercel.app/.
- The user confirmed Preview currently shares the production database.
- Hosted previews must be disconnected from production storage. Use local disposable Postgres and temporary CI Postgres instead of another hosted Supabase project.
- Every pull request must run real database integration checks, alongside desktop and mobile browser checks.
- Production promotion is manual. Merging and production release are separate decisions.

## Scope and environment boundaries

Keep the existing Next.js application, local-first IndexedDB library, Supabase production database, and Vercel hosting. Do not add accounts, a new hosting provider, or another hosted database.

| Environment | Storage | Verification |
| --- | --- | --- |
| Local development/test | Disposable Postgres with a database name ending in `_test`; browser-local IndexedDB | Real migration, persistence, conflict and cleanup tests |
| Pull-request CI | Fresh service-container Postgres; synthetic values only | Required checks on every PR, including forks without deployment credentials |
| Hosted Preview | No database URL or production sharing secrets | Local library, GitHub import, browser persistence, export, and an explicit sharing-unavailable response |
| Staged Production | Production configuration and production database | Same approved commit, production build configuration, protected inspection; no destructive fixtures |
| Current Production | Existing production database and stable origin | Small authorized smoke checks, scheduler history, release/rollback evidence |

A staged production deployment is not an isolated test environment. Its unique URL can reach production data before promotion. Do not run database regression tests, fixture expiry changes, or authenticated cleanup jobs there.

Remove production sharing credentials from Preview, including branch overrides and integration-injected values. Existing deployments may retain their old configuration: inventory them and retire or restrict obsolete preview deployments after the replacement is verified. Do not rotate production peppers as part of preview isolation; doing so can invalidate existing keys.

## Application behavior

On Vercel Preview, reject Quick Share and Key Group API access before any database work with HTTP 503 and the message: `Sharing is unavailable in this preview. Your local library still works.` Include `Cache-Control: no-store`. Apply the boundary to both API families, their descendants, and cleanup routes. Public share pages must display an unavailable state without reading production storage.

Keep local and production behavior unchanged. Removing credentials is the primary environment boundary; an application guard provides defense against accidental credential inheritance. Existing error displays can show the explicit response. Do not add a second live-status region or redesign the workspace.

## Release contract

1. PR checks pass against disposable resources; human reviews the local-only hosted preview.
2. The user merges manually. Verify checks against the resulting main commit, not just its pre-merge ancestor.
3. Build that commit with Production configuration while automatic production-domain assignment is disabled.
4. Record the staged deployment, previous known-good production deployment, database migration compatibility, and configuration checks.
5. The user explicitly approves promotion; verify the production alias and record smoke results afterward.

Vercel documents that Preview-to-Production promotion rebuilds, while promoting a staged Production deployment does not rebuild. Use the staged-production path so the inspected production artifact is the promoted artifact. Disable automatic domain assignment and verify that the existing `mdez.vercel.app` alias stays on the previous release until approval. If the available project configuration cannot demonstrate this, stop the release and resolve the hosting configuration first.

Sources checked 2026-09-18: [Promoting deployments](https://vercel.com/docs/deployments/promoting-a-deployment) and [staged CLI deployments](https://vercel.com/docs/cli/deploying-from-cli).

## Evidence and completion

Store a dated audit/release record with commit, deployment identity, CI run, scope, result, and blocker for each gate. Use `observed`, `user-reported`, `pending`, and `failed` explicitly. An unchecked item means unverified, not necessarily broken.

Production cleanup success requires scheduler execution evidence, not just a 401 from an unauthenticated request. A passing mocked browser suite does not prove real database connectivity. Local Postgres coverage does not prove Supabase pooler, permissions, deployed migrations, or production secrets.

Rollback changes the application deployment; it does not reverse schema/data changes. Require an application rollback target compatible with the current schema. Preserve production Markdown, keys, and token digests. Any production migration, configuration mutation, deployment, promotion, or test write requires explicit authorization at execution time.

## Out of scope

No production changes are authorized by this planning document. No new migrations, database reset, secret rotation, automatic merge/promotion, paid monitoring service, or full backup/restore feature is included. Monitoring in this iteration consists of documented release checks and scheduler/log inspection; additional alert automation needs a separate decision.
