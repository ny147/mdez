# Self-hosting Mdez

The local library and public GitHub import work without a database. Configure Supabase only when you want to enable Quick Share and Key Groups.

## Prerequisites

- Node.js 22 and npm.
- A Supabase project with a Postgres transaction-pooler connection URL on port `6543`.
- A server host such as Vercel for the Next.js application and cleanup routes.

Do not use a browser-exposed Supabase API key as the database URL.

## Apply the database migrations

Apply these migrations in order with the Supabase SQL editor or your migration workflow:

1. [`202608090001_quick_shares.sql`](../supabase/migrations/202608090001_quick_shares.sql)
2. [`202608090002_key_groups.sql`](../supabase/migrations/202608090002_key_groups.sql)
3. [`202609110001_flat_books.sql`](../supabase/migrations/202609110001_flat_books.sql)

The Key Groups migration depends on the database objects and HMAC rate-limit table created by the Quick Share migration. The flat-books migration converts nested group books into top-level books while preserving page membership and disambiguating duplicate path names.

## Configure server-only variables

Set the following variables in `.env.local` for local server testing and in every deployed environment that uses sharing:

```dotenv
SUPABASE_DATABASE_URL=postgres://postgres.PROJECT_REF:PASSWORD@POOLER_HOST:6543/postgres
MANAGEMENT_TOKEN_PEPPER=replace-with-at-least-32-random-bytes
RATE_LIMIT_PEPPER=replace-with-a-different-at-least-32-byte-secret
CRON_SECRET=replace-with-an-independent-random-secret
GROUP_KEY_PEPPER=replace-with-an-independent-at-least-32-byte-secret
```

All five values are server-only. Never give them a `NEXT_PUBLIC_` prefix. Use independent random values for each pepper and secret, and redeploy after changing them.

## Keep hosted previews local-only

Vercel Preview deployments are intentionally disconnected from server-side sharing. Do not assign `SUPABASE_DATABASE_URL`, `MANAGEMENT_TOKEN_PEPPER`, `RATE_LIMIT_PEPPER`, `CRON_SECRET`, or `GROUP_KEY_PEPPER` to the Preview environment, branch overrides, or integration-provided Preview variables. Keep those values scoped to Production when production sharing is enabled.

With `VERCEL_ENV=preview`, Mdez rejects Quick Share, Key Group, and cleanup-route requests with `503 Service Unavailable` before any database work. The local IndexedDB library, public GitHub import, editing, persistence, and export remain available. This application boundary is defense in depth; it does not replace removing credentials from Preview or retiring older Preview deployments that were built with production credentials.

To reproduce the hosted-preview boundary locally without a database URL:

```bash
VERCEL_ENV=preview npm run build
VERCEL_ENV=preview PLAYWRIGHT_WEB_SERVER_COMMAND="npm run start" npm run test:e2e -- tests/e2e/preview-boundary.spec.ts
```

The preview-boundary suite runs both configured Playwright projects and verifies the real HTTP response as well as the user-facing unavailable states.

## How sharing data is stored

Quick Share stores a readable title and immutable Markdown snapshot in Supabase. The database stores an HMAC digest of the management token; the raw token stays in the creator browser's IndexedDB. Clearing that browser's site data removes the creator's ability to delete the link early.

Key Groups store readable group Markdown and metadata in Supabase. The raw group key stays in browser IndexedDB and is sent only through the `x-mdez-group-key` HTTPS header. Supabase stores its HMAC digest. Leaving a group removes remembered access from that browser, and a lost group key cannot be recovered.

Readable Markdown and token HMACs exist in Supabase. Do not place raw management tokens, raw group keys, request bodies, Markdown, or raw IP addresses in database rows, analytics, or logs. Rate-limit identifiers are HMACed with `RATE_LIMIT_PEPPER` before persistence.

## Verify the setup

1. Redeploy after applying migrations and setting variables.
2. Create a Quick Share and open its unlisted URL in a signed-out browser.
3. Create a Key Group from a non-trivial local library and compare its book and page counts.
4. Join the group from a second signed-out browser and save changes in both directions.
5. Follow the cleanup and recovery checks in [Operations](operations.md).
