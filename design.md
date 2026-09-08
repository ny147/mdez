# Mdez Library Workspace Design

Status: implemented and verified on `codex/library-redesign` on 2026-09-08.

The accepted visual reference is `mdez-redesign.html`. The normative behavior and implementation detail live in `docs/superpowers/specs/2026-09-06-library-redesign.md` and `docs/superpowers/plans/2026-09-06-library-redesign.md`.

## Product shape

Mdez opens into a calm, single-page writing library. Books are folders, pages are Markdown documents, and Shelf, Edit, Read, and Split are four views over the same selected content. The redesign adds workspace-wide search, personal bookmarks, and per-workspace resume history without changing document records or the shipped collaboration protocols.

## Visual system

- Manrope carries display hierarchy; DM Sans carries interface text.
- JetBrains Mono remains the editor/status/code face.
- Reader prose uses Georgia for Latin glyphs with the existing Shippori Mincho multilingual fallback.
- The canvas is warm white, the fixed shelf is pale lavender, and semantic lavender/mint/berry accents distinguish Edit, Read, and Shelf.
- Desktop uses a 238px shelf, 80px header, 1240px content measure, and four cover columns when space permits.
- Tablet keeps the established 1023px drawer boundary. Mobile keeps the 767px bottom-navigation boundary and two cover columns.
- Rules establish hierarchy; shadows are reserved for overlays and subtle book depth.

All production colors are defined once in `src/app/styles/tokens.css`. Workspace and Markdown consumers use semantic custom properties rather than inline color literals.

## Information architecture

The sidebar owns workspace switching, group controls, shared-link management, primary library views, the nested book tree, Unsorted pages, and detailed page management. The header owns global search. The main shelf owns Import, New page, New book, the resume card, cover grid, page results, bookmark toggles, and selected-book ZIP export.

Page sharing and Markdown export stay beside an open page. GitHub refresh stays beside the imported source context. These actions remain contextual instead of being duplicated globally.

## State and persistence

`MdezWorkspace` remains the coordinator over the existing local and key-group library hooks. `selectLibraryView` is a pure projection over live documents, folders, selection, query, filter, bookmarks, and resume metadata.

Dexie schema version 5 adds two independent browser-local tables:

- `pageBookmarks`, keyed by workspace and document.
- `workspaceResume`, containing the last explicitly opened document per workspace.

The migration is additive. Existing version-4 records remain unchanged. Personal metadata is scoped as `local` or `group:<id>` and never alters a document's `updatedAt`, a group snapshot, or a group revision. Resume writes are serialized per workspace; hooks reject stale asynchronous reads after a workspace switch.

## Interaction contract

- Search updates live on Shelf. In Edit, Read, or Split, typing prepares a query and Enter safely returns to results without discarding drafts.
- Ctrl/Cmd+K focuses search. Escape clears a nonempty query before it closes other transient UI.
- A nonempty query searches every loaded record in the active workspace, independent of the current book or filter. Clearing it restores that browsing context.
- Page and bookmark controls are separate targets. Bookmarks persist across reload and remain isolated between local and group workspaces.
- Resume history records explicit opens, including successful creation/import selection, but not passive refresh selection.
- Mobile workspace/group/shared-link controls are reached through the inert, focus-managed shelf drawer.
- Every compact mobile control meets the 44px target contract.

## Editor and reader

CodeMirror, the MarkdownReader pipeline, math, syntax highlighting, table of contents, draft queues, and Split resize logic are preserved. The redesign changes only their chrome: display-scale transparent page titles, a quiet toolbar, an unelevated editor frame, a centered reader measure, and a restrained divider.

## Verified acceptance

The final implementation passes:

- 44 Vitest files / 280 tests.
- ESLint with zero warnings.
- Next.js type generation and TypeScript checking.
- Optimized Next.js production build.
- 160 Playwright tests across desktop and mobile projects.

Browser coverage includes persistence, search/bookmark/resume reload, key groups, Quick Share, GitHub import/refresh, Markdown and ZIP export, reader math/code/TOC, reduced motion, keyboard navigation, inert overlays, 44px touch targets, and no horizontal page overflow at 390, 430, 768, 1024, and 1440 pixels.

Deployment and merging into `main` are separate decisions and are not part of this implementation checkpoint.
