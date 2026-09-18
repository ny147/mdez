![Mdez — your local-first Markdown workspace for reading, editing, organizing, and sharing](docs/assets/mdez-banner.png)

# Mdez

Mdez is a local-first Markdown workspace for reading, editing, organizing, and sharing Markdown. Your everyday library stays in your browser, works without an account, and can be exported whenever you need a portable copy.

## Why Mdez?

- **Write and read in one place.** Switch between Shelf, Edit, Read, and adjustable Split views.
- **Keep a real library.** Organize pages in top-level books or Unsorted, search titles and content, bookmark useful pages, and resume your last page.
- **Bring existing Markdown.** Paste text, import local `.md` and `.markdown` files, or preview and import a public GitHub repository.
- **Own your files.** Export a page as Markdown or a book as a ZIP archive containing its Markdown files and manifest.
- **Share when you choose.** Publish an unlisted, read-only Quick Share or copy a library into a key-protected group workspace.

Mdez renders GitHub Flavored Markdown, syntax-highlighted code blocks, and KaTeX math.

Click the sun or moon button in the header to switch directly between **Light** and **Dark**. Mdez follows your device appearance until your first choice, then remembers that choice in this browser across workspaces and Quick Share pages. The icon and tooltip show which theme the next click will select. Dark mode uses a midnight blue palette with muted book covers. If browser storage is unavailable, theme switching still works for the current session.

In Read and Split preview, use **A− / A+** to adjust reading text from 12–28 px.
In Read, drag the handle on the document's right edge to change its width. In
Split, drag the divider between the editor and preview. Both handles also support
arrow keys and Home/End. Mobile keeps the document within the screen and uses
Edit/Preview tabs in Split; tablets retain the stacked, vertically adjustable Split.
Text size, Read width, and Split position are remembered independently across all
pages in this browser. **Reset** restores all three reading settings. These
preferences do not alter exported Markdown or shared document content.

## Quick start

You need [Node.js 22](https://nodejs.org/) and npm.

```bash
git clone https://github.com/ny147/mdez.git
cd mdez
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To try the main workflow:

1. Create a page or import a Markdown file.
2. Edit it and switch to Read or Split view.
3. Export the page or its book when you want a backup.

The local library and public GitHub import work without environment variables. Quick Share and Key Groups need the optional server configuration described in [Self-hosting](docs/self-hosting.md).

## Storage, privacy, and sharing

Documents, books, bookmarks, recent-page history, and GitHub source metadata are stored in IndexedDB for the current browser origin. Data saved on `localhost` does not automatically appear on a preview or production domain. Clearing site data, using private browsing, or changing domains can remove or isolate a library, so export important work first.

Sharing is optional and uses server storage:

- **Quick Share** stores an immutable, view-only Markdown snapshot in Supabase. Access ends at its selected expiration, and the next successful daily cleanup permanently deletes the expired snapshot. Its creator can also delete it early.
- **Key Groups** store a copied library in Supabase so browsers with the secret group key can collaborate. This is saved collaboration rather than real-time co-editing.

Raw management and group keys stay in the creator's or member's browser and are never stored in the database. Losing a key can permanently remove access or management capability.

## Project guides

- [Public GitHub import](docs/github-import.md) — supported repositories, safety limits, refresh behavior, and exclusions.
- [Self-hosting](docs/self-hosting.md) — optional Supabase migrations, secrets, and sharing setup.
- [Operations](docs/operations.md) — deployment checks, cleanup jobs, recovery, and rollback.
- [Product requirements](PRODUCT.md) — product goals, current priorities, and deferred scope.

## Development

Run the same checks used by continuous integration:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The browser tests use Playwright. Install its Chromium runtime before the first run if needed:

```bash
npx playwright install --with-deps chromium
```

## Contributing

Issues and pull requests are welcome. Keep changes focused, explain the user-facing behavior, and run the relevant checks above before opening a pull request. Changes to storage, imports, sharing, or deployment should also update the matching guide in `docs/`.

## License

A project license has not been selected yet. Until a license file is added, the repository's source is not licensed for reuse or redistribution.
