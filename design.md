# Mdez Library Workspace Design

Status: Prism Pages brand implementation verified on `codex/prism-pages-brand` on 2026-09-10, based on freshly fetched `origin/main` at `5ed39b9`.

The library behavior remains defined by `docs/superpowers/specs/2026-09-06-library-redesign.md`. The current brand specification is `docs/superpowers/specs/2026-09-09-prism-pages-brand-design.md`; approved concept references are in `docs/design-assets/prism-pages/`.

## Product shape

Mdez opens into a calm, single-page writing library. Books are folders, pages are Markdown documents, and Shelf, Edit, Read, and Split are four views over the same selected content. The redesign adds workspace-wide search, personal bookmarks, and per-workspace resume history without changing document records or the shipped collaboration protocols.

## Visual system

- Manrope carries display hierarchy; DM Sans carries interface text.
- JetBrains Mono remains the editor/status/code face.
- Reader prose uses Georgia for Latin glyphs with the existing Shippori Mincho multilingual fallback.
- The canvas is near white, the fixed shelf is pale lavender, and semantic violet/teal/berry accents distinguish Edit, Read, and Shelf. Pink, lavender, cyan, and blue cover variants remain stable per book.
- Desktop uses a 238px shelf, 80px header, 1240px content measure, and four cover columns when space permits.
- Tablet keeps the established 1023px drawer boundary. Mobile keeps the 767px bottom-navigation boundary and two cover columns.
- Rules establish hierarchy; shadows are reserved for overlays and subtle book depth.

Workspace colors are defined in `src/app/styles/tokens.css`. The vector identity uses a shared `brand-mark.json` definition consumed by BrandLogo and `scripts/export-brand-icons.mjs`; regenerate exported icons with `node scripts/export-brand-icons.mjs`.

## Prism Pages identity and companion

- The header uses a combined open-book and mascot-head silhouette, plus a lowercase Manrope wordmark. The compact mobile header keeps the symbol only. Favicon uses the book-only mark.
- AnimatedBrandLogo reveals the mascot in 360ms and finishes the sparkle at 600ms, once per tab session. Reduced motion and unavailable browser storage produce a static mark. Sidebar collapse and reload do not replay it. Public shared pages and recovery surfaces use static branding.
- Writing and peeking PNGs are genuinely transparent, 384×256 and 416×277 respectively, each under 145KB. The writing companion appears on the resume card; peeking art appears in welcome and contextual empty states. Only one full mascot appears per Shelf view, and none appears inside the editor/reader.
- First-use requires a ready, empty root library in All with no non-whitespace search. It replaces the two redundant main-panel empty messages with one welcome panel; actions stay available above it.
- Resume artwork uses 192px desktop and 96px compact width and is hidden below 430px. Welcome artwork stacks above copy on mobile.
- Book names in the narrow sidebar now occupy their own row; rename/create/delete controls occupy a second row. This repairs the previously zero-width book labels while preserving the same actions.

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

- 45 Vitest files / 292 tests.
- ESLint with zero warnings.
- Next.js type generation and TypeScript checking.
- Optimized Next.js production build.
- 168 Playwright tests across desktop and mobile projects.

Visual review passed for populated/welcome Shelf, mobile, Edit, Read, and Split. Screenshots and local logs are in `.superpowers/sdd/2026-09-09-prism-pages-brand/`; that scratch directory is ignored. Seventeen text/background token pairs exceeded 4.5:1 (lowest checked: 4.92:1). The mechanical design detector returned no findings. Code review's animation replay and whitespace-search findings were reproduced and resolved. Actual browser zoom at 200% was not separately exercised; responsive viewport checks are not claimed as a substitute.

Browser coverage includes persistence, search/bookmark/resume reload, key groups, Quick Share, GitHub import/refresh, Markdown and ZIP export, reader math/code/TOC, reduced motion, keyboard navigation, inert overlays, 44px touch targets, and no horizontal page overflow at 390, 430, 768, 1024, and 1440 pixels.

Deployment and merging into `main` are separate decisions and are not part of this implementation checkpoint.
