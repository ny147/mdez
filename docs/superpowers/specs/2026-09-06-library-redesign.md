# Mdez library redesign — implementation specification

Status: ready for implementation following the user decision review on 2026-09-07. Application implementation has not started. Product decisions below are confirmed; technical details are the implementation recommendations derived from current source.

## Confirmed decisions

Confirmed 2026-09-07: the user approved the recommended first-release scope: apply the visual redesign and include search, bookmarks, and resume writing while preserving every current feature. The behavior and control-placement decisions are recorded below.

Confirmed 2026-09-07: bookmarks are personal to this browser and scoped separately to each workspace, including groups. They are not shared with group members, do not modify shared pages, and do not follow the user to another device. The Personal bookmarks section implements this confirmed ownership decision.

The first draft included assumptions beyond a visual redesign. The user resolved them in the following review:

1. Resolved: visual integration plus search, bookmarks, and resume writing in the first release; preserve all existing features.
2. Resolved: browser-personal bookmarks, isolated by workspace; no shared-page mutation or cross-device synchronization.
3. Resolved: header search covers the entire active workspace even when a book is open; results show book paths. Draft-safe navigation remains required.
4. Resolved: resume targets the last page this user opened in this browser, scoped per workspace; edits by another member do not change it.
5. Resolved: contextual controls in the new layout—workspace switching/group management in the sidebar, page sharing/export beside the open page, and GitHub refresh beside the imported book. Preserve all existing operations.

Code evidence checked: `Document` has no bookmark field; `ShelfPane` shows top-level books and caps recent pages at eight; the active library controller exposes nested books, unsorted documents, imports, and mutations; `WorkspaceSwitcher` offers Local Library plus create/join/select group actions. The redesign must distinguish additions from restyling existing capabilities. Keep the HTML's visual approval separate from approval of these behavioral changes.

## Outcome and authority

Apply the visual direction in `mdez-redesign.html` to the production Next.js workspace. Users should recognize the spacious lavender library, pastel graphic covers, clear navigation, resume panel, recent-page list, and quieter editor while retaining their existing data and every shipped workflow.

The HTML is the visual reference, not a replacement application or persistence implementation. `docs/mdez-redesign-notes.md` describes its boundaries. For product capabilities, current source takes precedence over the older PRODUCT.md: the application now includes key groups and public sharing. This spec supersedes the previous visual contract only for the redesigned workspace; unrelated routes retain their behavior.

## Scope

- Redesign shell, sidebar, bookshelf, recent pages, editor chrome, reader, split view, and relevant control styling.
- Add library search, personal bookmarks, and a resume-writing panel using real records.
- Keep nested books, unsorted pages, create/rename/move/delete actions, file/paste/GitHub import and manual refresh, Markdown/ZIP export, draft recovery, and save error handling.
- Keep workspace switching, key-group create/join/settings/refresh/conflict flows, quick sharing, and shared-link management accessible. Shared content and public routes must remain functional.
- Do not seed production with the prototype's sample books. Do not copy its basic Markdown parser, localStorage document store, arbitrary import size limit, account avatar, or hard-coded collection metadata.
- No deployment, server protocol change, document schema rewrite, or redesign of public shared pages is included.

## Visual contract

| Role | Value |
| --- | --- |
| Main canvas | `#fbfafc` |
| Sidebar | `#f3f0f8` |
| Text | `#292735` |
| Secondary text | `#706c7c`, darken locally if necessary for AA contrast |
| Primary action | `#7052b8` |
| Border | `#e9e6ee` |
| Cover / ink pairs | `#ded0f0 / #675080`, `#cde0d5 / #466653`, `#f0d6c2 / #865a3d`, `#d2def0 / #4a6180` |
| Display / UI | Manrope / DM Sans through `next/font/google` |
| Code / reader | Preserve JetBrains Mono and existing multilingual reader fallback; use Georgia for Latin prose where it matches the reference |

Desktop: approximately 238px sidebar, 80px header, 44px content padding, 1240px content maximum, four cover columns with 23px gaps. Covers are approximately 180px tall, with subtle spine detail and geometric artwork; titles wrap and remain accessible in full. Use stable folder-ID hashing for four cover variations, so sorting cannot change a book's appearance. No persisted cover customization is required.

Keep Lucide icons in application controls. The book logo and cover geometry may become small SVG React components. Use 7–9px button radii and 12–13px major surface radii. Headings use restrained negative tracking; body controls must remain legible at 100% and 200% zoom. Do not reproduce the prototype's very small decorative text where it harms readability.

Retain existing responsive boundaries: mobile at 767px, tablet at 1023px. Use two cover columns on mobile, two or three at intermediate widths, and four with sufficient desktop width. Adapt the HTML's 760px breakpoint to this existing contract. Keep the working overlay drawer, scrim, focus management, and mobile mode navigation. Only the appropriate content pane scrolls; avoid a fixed-height shelf that clips records. Reader/editor behavior must remain usable with a software keyboard and long content.

## Information architecture and interactions

### Shell and sidebar

Header: library breadcrumb, labeled search, and actual workspace actions. Sidebar: brand, existing WorkspaceSwitcher, My library, Recent pages, Bookmarks, nested book navigation, New book, and storage/help information. Confirmed 2026-09-07: put workspace switching and group management in a labeled sidebar workspace menu; page sharing and Markdown export in the open-page action area; GitHub source refresh beside its imported book. Shared-link management remains reachable from the workspace menu even without an open page. Group refresh/settings remain in the active-group context. Keep import and New page directly visible on the shelf, book ZIP export in the selected-book actions, and nested create/rename/move/delete controls on their respective book/page menus. Preserve existing confirmation, conflict and permission behavior. Menus must work by keyboard and touch and cannot rely on hover. Do not show a fake personal avatar or universal local-only assurance in a shared workspace.

One selected-folder source of truth remains in the active library hook. Selecting My library, Recent pages, or Bookmarks clears the selected folder; selecting a book shows its direct pages and child books. Show an Unsorted pages entry with an explicit unsorted filter, distinct from My library even though both use a null selected-folder ID. With no search query, that entry shows only pages whose folderId is null and no book covers. Preserve existing parent navigation and move operations.

### Shelf and lists

Library heading: “A little space for big ideas.” Supporting copy and action emphasis follow the HTML. New page creates in the selected book, or unsorted when no book is selected. New book respects selected parent context. Import uses the existing dialog; Export book remains available when a book is selected.

Render top-level books at library root and direct child books when inside a book, ordered by existing order/name rules. Page counts explicitly count direct pages, matching current behavior. Replace the arbitrary recent-list limit of eight with a complete scrollable list; search must reach every page.

My library shows the bookshelf and recent pages. Recent pages hides covers and sorts all pages by updatedAt descending, then ID for stable ties. Bookmarks shows personal favorites. Each row has a page title, book name or Unsorted pages, relative edit time, and an independently labeled bookmark toggle. The page target must not wrap the bookmark button.

### Search

Search is client-side against the active workspace's loaded records, never a server query. Trim and case-fold the query; match page title/body and book name. Confirmed 2026-09-07: header search covers all books, nested books, and Unsorted pages in the active workspace, even when a book is open. Each page result shows its full book path, or Unsorted pages. A nonempty header query is a workspace-wide search, independent of the selected book or Bookmarks filter; clearing it restores the previous browsing context. Empty-query browsing retains the selected book/filter. Match book results across the workspace as well. Page matching uses title/body; book-name matching returns books rather than implicitly returning every page they contain. Show full book paths on both kinds of result to disambiguate duplicate names. Resolve paths with a visited-ID guard and a safe missing-parent fallback. Do not search across workspaces or expose group keys. Search changes must never clear an active editor draft: submit/search navigation goes through the existing safe view transition. In a shelf view, typing updates results immediately. In Edit/Read/Split, typing prepares the query; Enter submits through safe navigation to the shelf results so typing alone never ejects the editor. Ctrl/Cmd+K focuses search; Escape clears a nonempty query, otherwise closes a drawer as applicable. Provide explicit zero-results copy and a clear-search action.

### Resume writing

Confirmed 2026-09-07: at My library with an empty query, show the last page the user successfully opened in this browser within the active workspace. Opening in Edit, Read, or Split counts; passive selection during data loading, background refresh, and another member’s edits do not. Creating or importing a page counts when it actually opens in a document view. Use the actual title/book and computed reading estimate (at least one minute, 200 whitespace-separated words per minute). Label as ‘Continue writing’ and open through the existing document-selection/draft flow. Hide when no personal history exists, the target is missing, or the current context is non-root/search. Do not substitute the most recently edited page. Retain the remembered target across temporary loading/offline errors; never silently open a different page when it becomes unavailable.

Persist a separate browser-local resume record per workspace alongside bookmark metadata: add `workspaceResume: "workspaceId"` in the same additive Dexie v5 migration, with `{ workspaceId: string; documentId: string; openedAt: string }`. Use the same non-secret workspace IDs as bookmarks. Failed metadata writes must not prevent opening the page or imply document-save failure; report that resume history could not be saved. Serialize updates per workspace and guard stale reads so rapid navigation cannot restore an older target. No group document/revision mutation or cross-device synchronization.

### Personal bookmarks

Bookmarks do not exist on the current Document type. Implement them as browser-local UI metadata for both local and group workspaces. They are not shared edits and do not increment group revisions or change document updatedAt.

Add an additive Dexie table in version 5: `pageBookmarks: "[workspaceId+documentId], workspaceId"`. Records are `{ workspaceId: string; documentId: string; createdAt: string }`. Workspace IDs are `local` or `group:<groupId>`; never include a group key. Preserve every version-4 store declaration. Migration creates the bookmark and resume tables without changing existing data.

Bookmark count and rendering intersect metadata with live records. Toggle writes are awaited and display recoverable errors; an unsuccessful write must not claim success. Missing/deleted documents are ignored; stale rows can be deleted only after authoritative successful load, never because a group is loading or offline. Same document ID in two workspaces must not leak bookmark state. Filter/query state resets on workspace switching. No cloud bookmark synchronization is included.

### Editor and reader

Use the existing CodeMirror editor, MarkdownReader pipeline, syntax highlighting, math, table of contents, export, and SplitWorkspace resize logic. Apply the HTML's hierarchy and spacing around those components. Preserve mode values `shelf`, `editor`, `preview`, `split` and existing semantic tabs, keyboard interactions, and draft queue. Page title changes continue through the current persistence handlers. No textarea replacement or custom parser is allowed.

## State, accessibility, and safety

- Loading shows honest loading status without flashing empty or seeded content.
- Empty library offers New page, New book, and Import; empty book offers creation/import; empty bookmarks explains the star action; no search results offers Clear search.
- Keep saved/saving/unsaved/error states derived from persistence, including IndexedDB failure, group conflict, and pending draft recovery. “Saved in this browser” appears only when accurate for the active workspace.
- Hidden drawer remains inert and excluded from focus; opening moves focus in, Escape/scrim closes, focus returns to its trigger. Name dialogs through headings and restore focus after completion.
- Maintain accessible tab state; expose filter selection and `aria-pressed` on bookmarks. Decorative art is hidden from accessibility APIs.
- Text contrast meets WCAG AA; visible focus; minimum 44px mobile hit areas even for small icons. No horizontal page overflow at 390px or 200% zoom. Respect reduced motion.
- Long/unbroken titles, Unicode/Thai/Japanese, empty content, large existing libraries, and unavailable fonts must remain usable. Use current safe Markdown rendering and never expose group keys or management tokens in screenshots/logs.

## Architecture and file ownership

| Files | Responsibility |
| --- | --- |
| `src/app/layout.tsx`, `src/app/styles/tokens.css`, `workspace.css`, `markdown.css` | Font roles, semantic tokens, layout, responsiveness, reader styling |
| `src/components/mdez/MdezWorkspace.tsx` | Wire active library, safe navigation, search/filter metadata and current actions |
| `Sidebar.tsx`, `FolderTree.tsx`, `WorkspaceSwitcher.tsx` | Navigation and workspace context while preserving nested operations |
| `ShelfPane.tsx` | Coordinate shelf presentation and its supplied callbacks |
| New `BookCover.tsx`, `LibraryPageList.tsx`, `LibrarySearch.tsx` | Reusable cover, list, search presentation; no data writes |
| `EditorPane.tsx`, `EditorToolbar.tsx`, `PreviewPane.tsx`, `SplitWorkspace.tsx`, `WorkspaceStatus.tsx` | Apply chrome while preserving existing responsibilities |
| New `src/lib/library-view.ts` | Pure filtering, stable sorting, cover variant and reading estimate helpers |
| `src/lib/db.ts`, new `src/lib/page-bookmarks.ts`, new `src/hooks/usePageBookmarks.ts`, new `src/lib/workspace-resume.ts`, new `src/hooks/useWorkspaceResume.ts` | Additive personal metadata persistence and reactive scoped state |
| `src/lib/workspace-copy.ts` | Context-correct UI copy |

Do not rename domain Folder/Document types to Book/Page merely to match UI labels. Keep business operations in existing library hooks/repositories. Any newly extracted component must have typed props, not references to window globals from the prototype.

## Acceptance gates

1. Desktop and mobile visual review against the reference covers filled/empty shelf, selected book, search, bookmarks, Edit/Read/Split, and long titles.
2. Existing IndexedDB version-4 records survive migration unchanged; bookmark changes and last-opened history survive reload and remain workspace-scoped.
3. Search/filter/resume never lose pending edits, and controls preserve selection semantics.
4. Existing nested operations, file/paste/GitHub import, manual refresh, Markdown/ZIP export, Markdown/math, recovery, shared links, and group conflict tests remain passing.
5. Keyboard drawer, tab navigation, dialog naming, focus return, 390px overflow, tablet, and 200% zoom checks pass.
6. Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`. Record baseline failures separately; never silently remove failing regression coverage to meet the design.
7. Update PRODUCT.md and design.md to match the actual built result only after implementation. Keep this spec and the HTML as the design checkpoint.

## Delivery order

User-confirmed implementation setup: first fetch/pull the latest `origin/main` while preserving local checkpoint commits; then create `codex/library-redesign` from the updated main in an isolated worktree. Revalidate code assumptions after pulling. No application work takes place on main. Follow plan section 0 for the exact sequence and conflict/restart handling. Planning itself does not execute this setup.

Implement the shell first, metadata/search selectors next, covers and full shelf wiring next, then editor chrome and the final regression pass. Commit after each verified slice. Detailed execution checklist: `../plans/2026-09-06-library-redesign.md`.
