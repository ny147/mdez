# Mdez

Mdez is a local-first Markdown reader and editor built with Next.js. Markdown documents, imported repositories, and source metadata are stored in browser IndexedDB. Quick Share publishes immutable view-only snapshots, while Key Groups let several browsers collaborate on a copied library using one secret group key.

## Development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## V1 Scope

- Paste and file import for Markdown.
- Public GitHub repository import from the default branch.
- Preview before a GitHub import writes to IndexedDB.
- Manual GitHub refresh with an overwrite confirmation.
- Nested folders and document organization.
- Autosaved local editing.
- Shelf, Edit, Read, and Split modes.
- Single document `.md` export.
- Folder `.zip` export with `manifest.json`.
- Unlisted Quick Share snapshots with creator-selected expiry and creator-only deletion.
- Key Group creation, joining, saved collaboration, conflict recovery, and seven-day deletion recovery without accounts.

## Public GitHub limits

Mdez accepts `https://github.com/owner/repository` URLs for public repositories. It imports `.md` and `.markdown` files from the default branch, preserves Markdown-bearing folders, and ignores `.obsidian`, hidden configuration, attachments, and unsupported files.

The initial safety limits are:

- 25 MB compressed repository archive.
- 1,000 Markdown files.
- 5 MB per Markdown file.
- 50 MB extracted Markdown total.
- 15 seconds for GitHub archive requests.

Refresh replaces source-owned pages and any local edits inside that imported book. Local books and other imported repositories remain unchanged. Private repositories, authentication, branch selection, background sync, and two-way merging are not supported.

Mdez does not include accounts, automatic Local/Group synchronization, realtime co-editing, PDF export, tags, full-text search, or plugins in V1.

## Browser storage and privacy

Documents, folders, imported Markdown, and GitHub source metadata live in IndexedDB for the current browser origin. Browser storage is origin-scoped: data created on localhost does not appear automatically on a preview or production domain, and data from one deployment domain does not move to another.

The controlled archive route receives a public repository URL and streams the bounded GitHub ZIP response to the browser. It does not persist archives or Markdown and the application does not log repository payloads. GitHub can still apply its public unauthenticated rate limits.

Clearing site data, using private browsing, or changing deployment domains can remove or isolate the local library. Export important pages or books before clearing browser storage.

Quick Share stores its readable title and Markdown snapshot in Supabase so anyone with the unlisted URL can read it until deletion or expiry. Supabase stores an HMAC digest of the management token, never the raw management token. The raw token stays in the creator browser's IndexedDB. Clearing browser data removes the creator's ability to delete that link early.

Key Groups store readable group Markdown and metadata in Supabase. The raw group key stays in the browser's IndexedDB and is sent only through the `x-mdez-group-key` HTTPS header. Supabase stores only its HMAC digest. Clearing browser data or choosing Leave Group removes remembered access from that browser. A lost group key cannot be recovered.

## Quick Share operations

1. Apply [`supabase/migrations/202608090001_quick_shares.sql`](supabase/migrations/202608090001_quick_shares.sql) to the target Supabase project with the Supabase SQL editor or migration workflow.
2. In Supabase, copy the Postgres transaction-pooler connection URL. Use the pooler URL on port 6543, not a browser-exposed API key.
3. Set these server-only variables for both Preview and Production in Vercel. None may use a `NEXT_PUBLIC_` prefix:

   - `SUPABASE_DATABASE_URL`: transaction-pooler URL.
   - `MANAGEMENT_TOKEN_PEPPER`: at least 32 random bytes.
   - `RATE_LIMIT_PEPPER`: a different secret of at least 32 random bytes.
   - `CRON_SECRET`: an independent random bearer secret.

4. Redeploy after adding or changing variables. Existing deployments do not automatically receive changed build/runtime configuration.
5. Verify the cleanup route manually against the deployment:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://DEPLOYMENT_HOST/api/cron/quick-shares
   ```

   A successful response reports deleted `shares` and `buckets`. Create an already-expired test row in a non-production database, invoke cleanup, and confirm the row disappears. Vercel also invokes this idempotent route daily at 03:17 UTC from `vercel.json`.

Readable Markdown and token HMACs exist in Supabase. Raw management tokens, request bodies, Markdown, and raw IP addresses must not appear in database rows, analytics, or logs. Rate-limit identifiers are HMACed with `RATE_LIMIT_PEPPER` before persistence.

## Production deployment

Production URL: not assigned. Connecting or deploying the project requires explicit release approval.

The intended Vercel configuration is:

- Framework preset: Next.js.
- Install command: npm ci.
- Build command: npm run build.
- Public GitHub import requires no secret. Quick Share requires the four server-only variables listed above.
- Node.js runtime for /api/github/archive.
- Function duration of 20 seconds; the upstream request aborts after 15 seconds.

After creating a preview deployment, run the verification commands from a clean checkout and smoke test:

1. Paste/file import and public GitHub preview/import.
2. Edit, autosave, reload, and reader rendering.
3. Refresh confirmation, successful replacement, and failed-refresh preservation.
4. Document Markdown and book ZIP export.
5. Desktop and mobile layouts.
6. Friendly invalid URL, unavailable repository, rate-limit, timeout, and oversized-archive errors.
7. Quick Share with every expiry option, signed-out public reading, immutable snapshots, creator deletion, unknown links, and expired links.

Only promote the reviewed preview after these checks pass. Record the preview and production URLs here when deployment is authorized and verified.

For rollback, promote the previous verified Vercel deployment and stop the Quick Share cron. Leave migration `202608090001` and its rows in place so a corrected release can recover existing links. Do not drop share rows or rotate `MANAGEMENT_TOKEN_PEPPER` during rollback.

## Key Group operations

1. Apply [`supabase/migrations/202608090001_quick_shares.sql`](supabase/migrations/202608090001_quick_shares.sql), then apply [`supabase/migrations/202608090002_key_groups.sql`](supabase/migrations/202608090002_key_groups.sql). Migration 002 depends on migration 001's database and HMAC rate-limit table.
2. Add `GROUP_KEY_PEPPER` to Vercel Preview and Production as an independent server-only secret containing at least 32 random bytes. Keep `SUPABASE_DATABASE_URL`, `RATE_LIMIT_PEPPER`, and `CRON_SECRET` configured. None may use a `NEXT_PUBLIC_` prefix.
3. Redeploy, create a test group from a non-trivial Local Library, and compare book/page counts. In Supabase, confirm Markdown is readable, `key_digest` is an HMAC value, and no raw group key is stored.
4. Join from a second signed-out browser. Save in both directions, refresh, force a stale-version conflict, and verify both recovery actions preserve the losing draft. Confirm every observed URL omits the key and request headers contain it only as `x-mdez-group-key`.
5. Delete the test group, confirm the deletion and purge dates, and restore it within seven days. Manually invoke cleanup with the cron bearer secret:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://DEPLOYMENT_HOST/api/cron/key-groups
   ```

   The route reports deleted `groups`, retained-log cleanup `changes`, and expired rate-limit `buckets`; it must reject a request without the secret. Vercel invokes it daily at 03:43 UTC.

Do not rotate `GROUP_KEY_PEPPER` casually. Rotation invalidates every existing key unless it is paired with an explicit key-invalidation and digest data-migration plan. Losing a group key means access cannot be recovered.

For rollback, promote the last verified Quick-Share-only deployment and stop the Key Group cron. Leave migration 002 tables and group rows untouched, and do not rotate `GROUP_KEY_PEPPER`; deploy the corrected release against the preserved data.
