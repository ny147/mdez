# Mdez

Mdez is a local-first Markdown reader and editor built with Next.js. Markdown documents, imported repositories, and source metadata are stored in browser IndexedDB. Vercel hosts only the application code and the controlled public GitHub archive route.

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

## Public GitHub limits

Mdez accepts `https://github.com/owner/repository` URLs for public repositories. It imports `.md` and `.markdown` files from the default branch, preserves Markdown-bearing folders, and ignores `.obsidian`, hidden configuration, attachments, and unsupported files.

The initial safety limits are:

- 25 MB compressed repository archive.
- 1,000 Markdown files.
- 5 MB per Markdown file.
- 50 MB extracted Markdown total.
- 15 seconds for GitHub archive requests.

Refresh replaces source-owned pages and any local edits inside that imported book. Local books and other imported repositories remain unchanged. Private repositories, authentication, branch selection, background sync, and two-way merging are not supported.

Mdez does not include accounts, backend document storage, sharing links, collaboration, PDF export, tags, full-text search, or plugins in V1.

## Browser storage and privacy

Documents, folders, imported Markdown, and GitHub source metadata live in IndexedDB for the current browser origin. Browser storage is origin-scoped: data created on localhost does not appear automatically on a preview or production domain, and data from one deployment domain does not move to another.

The controlled archive route receives a public repository URL and streams the bounded GitHub ZIP response to the browser. It does not persist archives or Markdown and the application does not log repository payloads. GitHub can still apply its public unauthenticated rate limits.

Clearing site data, using private browsing, or changing deployment domains can remove or isolate the local library. Export important pages or books before clearing browser storage.

## Production deployment

Production URL: not assigned. Connecting or deploying the project requires explicit release approval.

The intended Vercel configuration is:

- Framework preset: Next.js.
- Install command: npm ci.
- Build command: npm run build.
- No deployment secret is required for public GitHub import.
- Node.js runtime for /api/github/archive.
- Function duration of 20 seconds; the upstream request aborts after 15 seconds.

After creating a preview deployment, run the verification commands from a clean checkout and smoke test:

1. Paste/file import and public GitHub preview/import.
2. Edit, autosave, reload, and reader rendering.
3. Refresh confirmation, successful replacement, and failed-refresh preservation.
4. Document Markdown and book ZIP export.
5. Desktop and mobile layouts.
6. Friendly invalid URL, unavailable repository, rate-limit, timeout, and oversized-archive errors.

Only promote the reviewed preview after these checks pass. Record the preview and production URLs here when deployment is authorized and verified.
