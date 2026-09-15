# Mdez operations

This guide covers deployment checks, scheduled cleanup, recovery, and rollback for a self-hosted Mdez instance.

## Deployment configuration

The intended Vercel configuration is:

- Next.js framework preset.
- `npm ci` install command.
- `npm run build` build command.
- Node.js runtime for `/api/github/archive`.
- 20-second function duration for the GitHub archive route; its upstream request aborts after 15 seconds.
- The five server-only values described in [Self-hosting](self-hosting.md) when sharing is enabled.

Public GitHub import requires no secret. Quick Share uses `SUPABASE_DATABASE_URL`, `MANAGEMENT_TOKEN_PEPPER`, `RATE_LIMIT_PEPPER`, and `CRON_SECRET`. Key Groups also use `GROUP_KEY_PEPPER`.

## Release verification

Run the automated checks from a clean checkout:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

When a change affects Postgres migrations or Key Group concurrency, also run `npm run test:postgres` against a disposable configured database.

Smoke test these user paths on the deployment:

1. Paste, file import, and public GitHub preview/import.
2. Edit, autosave, reload, search, bookmark, resume, and reader rendering.
3. GitHub refresh confirmation, successful replacement, and failed-refresh preservation.
4. Page Markdown and book ZIP exports on desktop and mobile.
5. Quick Share and Key Groups, including the failure and recovery cases below.

For GitHub import, verify friendly errors for invalid URLs, unavailable repositories, rate limits, timeouts, and oversized archives. For Quick Share, check every expiry option, signed-out reading, immutable snapshots, creator deletion, unknown links, and expired links.

For Key Groups, join from a second signed-out browser, save in both directions, and force a stale-version conflict. Both recovery actions must preserve the losing draft. Confirm that URLs omit the group key and requests send it only in the `x-mdez-group-key` header.

## Scheduled cleanup

Vercel reads both schedules from [`vercel.json`](../vercel.json):

- Quick Share cleanup: `/api/cron/quick-shares` daily at 03:17 UTC.
- Key Group cleanup: `/api/cron/key-groups` daily at 03:43 UTC.

Verify the Quick Share job against a non-production database containing an expired test row:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://DEPLOYMENT_HOST/api/cron/quick-shares
```

A successful response reports deleted `shares` and `buckets`. Confirm that the expired test row disappears.

Verify Key Group deletion and seven-day recovery before testing its cleanup route:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://DEPLOYMENT_HOST/api/cron/key-groups
```

The response reports deleted `groups`, retained-log cleanup `changes`, and expired rate-limit `buckets`. Both cleanup routes must reject requests without the cron secret.

## Recovery and secret rotation

A deleted Key Group can be restored during its seven-day recovery window. A lost group key cannot be recovered.

Do not rotate `GROUP_KEY_PEPPER` without an explicit key-invalidation and digest-migration plan. Rotation by itself invalidates every existing group key. Rotating `MANAGEMENT_TOKEN_PEPPER` prevents existing Quick Share management tokens from authorizing early deletion.

## Rollback

For a Quick Share rollback, promote the previous verified deployment and stop the Quick Share cron. Leave migration `202608090001` and its rows in place so a corrected release can recover existing links. Do not drop share rows or rotate `MANAGEMENT_TOKEN_PEPPER` during rollback.

For a Key Group rollback, promote the last verified deployment that supports Quick Share and stop the Key Group cron. Leave migrations `202608090002` and `202609110001`, their tables, and group rows untouched. Do not rotate `GROUP_KEY_PEPPER`; deploy the corrected release against the preserved data.
