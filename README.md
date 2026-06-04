# Mdez

Mdez is a local-first Markdown reader and editor built with Next.js. Markdown documents and folders are stored in browser IndexedDB; Vercel hosts only the application code.

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
- Nested folders and document organization.
- Autosaved local editing.
- Split, editor-only, and preview-only modes.
- Single document `.md` export.
- Folder `.zip` export with `manifest.json`.

Mdez does not include accounts, backend document storage, sync, sharing links, collaboration, PDF export, tags, full-text search, or plugins in V1.
