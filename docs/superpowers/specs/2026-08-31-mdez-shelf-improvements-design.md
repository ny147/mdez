# Mdez Shelf Stabilization and Scaling Design

**Date:** 2026-08-31

**Status:** Approved direction; implementation pending

**Mode:** Operate
**Target:** Shelf view in Local Library and Key Group workspaces

## Objective

Improve the Shelf in two independently shippable phases:

1. **Stabilization:** eliminate layout failures, reduce mobile action competition, make local-data recovery credible, and close the remaining interaction and accessibility gaps.
2. **Scaling:** add fast retrieval and one coherent, keyboard-operable book/page hierarchy for larger libraries.

The work refines the existing quiet pastel library. It does not replace the Mdez identity, change the four workspace modes, or redesign Edit, Read, or Split. This milestone intentionally supersedes the earlier V1 deferral of root export only for the versioned workspace-backup flow described below; contextual book ZIP behavior remains unchanged.

## Job and Audience

The Shelf is the place where a writer, developer, student, or note-heavy creator returns to find, organize, create, import, and protect Markdown content. Users may arrive with an empty library, a handful of books, or thousands of pages. They should immediately understand:

- where their content is stored;
- what the primary next action is;
- which book and page are active;
- how to recover their work if browser data is lost;
- how to retrieve an older page without opening books one at a time.

The surface remains an **Operate** experience. Scanability, predictable controls, keyboard access, and honest storage feedback outrank decorative density.

## Outcomes and Proof

The design succeeds when:

- no viewport from 320px through 1920px produces document-level horizontal overflow;
- the Shelf content, status row, and mobile mode navigation never overlap;
- mobile users see one primary Shelf action before the book content, rather than four stacked peers;
- a user can create or rename a book without entering native browser prompt UI;
- a complete active workspace can be exported and safely restored into the Local Library;
- users can see whether a workspace has never been backed up or has a stale backup;
- a user can find a page by book name, title, or body text from the sidebar or `⌘K`/`Ctrl+K`;
- the sidebar exposes one understandable book/page hierarchy with complete keyboard semantics;
- existing Local Library, Key Group, GitHub import, Shared Links, autosave, page export, and book ZIP behavior continue to work.

## Review Decisions

The implementation must not translate the submitted review literally. Apply these decisions:

- Replace `100vw` shell sizing, but preserve the app shell's intentional internal scrolling and containment.
- Diagnose mobile bottom overlap through element geometry. Do not add arbitrary padding when the shell grid can own the persistent chrome.
- Preserve horizontal book scrolling for a genuinely overflowing shelf. Do not show or reserve a scrollbar when content fits.
- Refine the existing nested book and page navigation rather than introducing a second tree.
- Do not add a stats strip merely to occupy empty space.
- Do not change contrast tokens that already meet WCAG AA without new failing evidence.
- Preserve existing tab semantics, icon labels, focus styles, reduced-motion behavior, and mobile target sizing.
- Do not add a marketing landing page, tags, book colors/emoji, or production folder sync in this milestone.

## Phase 1 — Shelf Stabilization

### 1. Shell containment and persistent chrome

The workspace shell uses its containing block rather than the viewport as its width authority:

- replace every app-shell `100vw` usage with `width: 100%` and an appropriate `max-width: 100%`/`min-width: 0` chain;
- keep global `box-sizing: border-box`;
- keep the shell's intentional containment, but do not use a new hidden overflow rule to conceal an unresolved child-width defect;
- ensure the topbar's grid columns can shrink without forcing the action cluster beyond the viewport;
- name the topbar with `<header aria-label="Workspace toolbar">`.

On mobile, topbar, main content, workspace status, and mode navigation belong to explicit shell grid rows. Status and mode navigation must not independently cover the main scroll region. Safe-area insets extend the bottom row without reducing the minimum 44px control target.

The main scroll container ends above the status and navigation rows at rest and at maximum scroll. Dynamic viewport height remains based on `100dvh` so expanded and collapsed mobile browser chrome do not trap the last content.

### 2. Shelf action hierarchy

The Shelf exposes one primary action and progressively discloses everything else.

**Desktop:**

- `Create page` or `Create page in [book]` remains the filled primary button.
- `Create book` remains visible as a secondary action.
- `More` opens a menu containing `Import Markdown`, contextual `Download [book].zip`, and `Download workspace backup`.

**Mobile:**

- only the contextual Create Page button and `More` remain above the Shelf content;
- `Create book`, Import, book ZIP, and workspace backup live in the menu;
- the action block must not consume the whole first 390×844 viewport before the Books section begins.

The More menu:

- uses a button with `aria-haspopup="menu"`, `aria-expanded`, and an explicit accessible name;
- closes on outside activation, `Escape`, item selection, mode change, and drawer close;
- restores focus to the trigger after dismissal;
- supports Arrow Up/Down, Home/End, and Enter/Space;
- disables book ZIP when no book is open while retaining an explanation;
- gives Import, book ZIP, and workspace backup a concise secondary description.

`Sync to folder` does not appear in the production menu. File System Access API work is a later feasibility decision because support, permission persistence, and recovery behavior vary by browser.

### 3. Book creation and rename

Replace `window.prompt` with one reusable Mdez book dialog.

- Create mode shows the destination context: root shelf or parent book.
- Rename mode pre-fills and selects the current name.
- Names are trimmed, required, 1–120 characters, and unique among sibling books using case-insensitive comparison.
- Validation is inline and does not erase input.
- Enter submits when valid; Escape and Cancel close without changes.
- Focus starts in the name field and returns to the invoking control.
- A failed save keeps the dialog open and provides a specific recovery message.

An empty book includes an inline `Add first page` action that creates within that book. This is present on touch devices and is not hover-dependent.

### 4. Book rail and page-card clarity

Keep the book-spine metaphor, with these constraints:

- render page counts as `1 page`, `2 pages`, or `Empty`; never `1p`/`2p`;
- expose the complete book name through its accessible name and native title;
- add a stable horizontal caption beneath each spine, clamped only where required to protect layout;
- do not require a mathematically impossible “no truncation at 40 characters” rule inside a fixed-height vertical spine;
- when visual text is shortened, the complete value remains available through the caption, accessible name, or title;
- visually distinguish an empty spine without implying it is disabled;
- preserve a restrained 150–180ms lift for pointer hover and remove it under reduced motion.

The rail scrolls only when its content is wider than its viewport. When it overflows, it provides scroll snap, an accessible region name, and keyboard scrolling. When it fits, no scrollbar track or empty scroll affordance appears.

Replace the page-card dog-ear triangle with a small open affordance that cannot be mistaken for a resize handle. Clicking a recent page continues to open Edit; changing that product behavior is outside this refinement.

Relative timestamps remain visible. Each timestamp uses `<time datetime="…" title="…">` with an absolute localized date and time available to pointer and assistive-technology users.

### 5. Storage trust and workspace backup

The Shelf contains a compact storage-trust row below its actions:

- Local Library: `Stored in this browser`;
- Key Group: `Shared workspace · access key saved in this browser`;
- no backup: `No workspace backup yet`;
- recent backup: `Last workspace backup [relative time]`;
- more than seven days: the same line receives a passive warning treatment;
- actions: `Back up now` and `What does this mean?`.

The explainer states what browser clearing can remove, what a workspace backup contains, what Shared Links or Key Groups transmit, and that page/book exports are not complete workspace backups.

#### Backup format

`Back up now` downloads a versioned `.mdez.zip` for the active workspace. It includes:

- `manifest.json` with schema version, Mdez version, workspace kind/name, export timestamp, folders, page metadata, and file-path mapping;
- every page as UTF-8 Markdown in its book hierarchy;
- unbooked pages under a reserved `pages-without-book/` directory;
- source metadata required to identify imported GitHub content, without authentication secrets, group keys, management tokens, or Shared Link tokens.

The backup timestamp is scoped per workspace and stored locally only after archive generation and download initiation succeed. A page `.md` export or contextual book ZIP does not reset the whole-workspace backup reminder.

#### Restore behavior

Import gains `Restore Mdez backup` for `.mdez.zip` files:

1. Parse and validate the archive before any mutation.
2. Show a preview with book count, page count, workspace source, export time, and validation warnings.
3. Restore into Local Library as newly identified content; never silently overwrite current pages or write into a Key Group.
4. Preserve hierarchy, order, titles, timestamps where valid, Markdown bodies, and GitHub-source attribution where safe.
5. Resolve sibling-name collisions by presenting the renamed root labels in the preview.
6. Perform the confirmed restore as one IndexedDB transaction; any failure leaves the existing library unchanged.

Unsupported schema versions, corrupt archives, unsafe paths, missing manifests, duplicate manifest IDs, or files outside declared mappings produce specific errors and zero writes.

### 6. Phase 1 accessibility

- Preserve the existing desktop/mobile tablist behavior and roving focus.
- Preserve visible `:focus-visible` treatment and 44×44px mobile targets.
- Provide accessible names for every new icon-only control.
- Menus and dialogs follow native keyboard expectations and maintain focus.
- Do not attach `aria-expanded` to book spines unless they control a named expandable region.
- All status changes use the existing single polite live region; backup progress must not create a competing live region.
- Content and controls remain usable at 200% zoom.
- All transitions respect `prefers-reduced-motion`.

## Phase 2 — Library Scaling

Phase 2 begins after Phase 1 ships and its geometry and backup behavior are verified.

### 1. Persistent search

Add one persistent search field at the top of the sidebar. On mobile it appears at the top of the library drawer.

- Placeholder: `Search books and pages`.
- Visible shortcut hint: `<kbd>⌘K</kbd>` on macOS or `<kbd>Ctrl K</kbd>` elsewhere.
- The shortcut opens the drawer/sidebar when necessary and focuses the field.
- Search matches book names, page titles, and page body text using normalized case-insensitive text.
- Results are grouped by book, with unbooked pages in `Pages without a book`.
- Page results show title, book path, and a short body snippet when the body caused the match.
- Arrow Up/Down moves through results; Enter opens the active result; Escape clears results first and dismisses the drawer only on a second Escape.
- When no result exists, offer `Create page “[query]”` in the selected book or Pages without a book.
- Whitespace-only and queries longer than 200 characters do not run.

Search runs outside the main rendering path so typing stays responsive. Build a client-side index from the active workspace snapshot, update it incrementally after page/book mutations, and rebuild it when the active workspace changes. Display `Indexing library…` in the search region without blocking other Shelf actions.

For 5,000 pages with representative Markdown bodies, the first result update should arrive within 250ms after the input debounce and must not produce a main-thread task longer than 50ms. Return at most 50 visible results and ask the user to refine the query when more matches exist.

### 2. Unified semantic library tree

Replace the separate `FolderTree` and `DocumentList` presentations with one hierarchy:

```text
Pages without a book
Book
  Page
  Nested book
    Page
```

The tree:

- uses `role="tree"`, `role="treeitem"`, and nested `role="group"` correctly;
- marks the active page with `aria-current="page"`;
- gives book nodes an accessible direct-page count;
- supports Arrow Up/Down, Arrow Left/Right, Home/End, and Enter;
- persists expansion per workspace across sessions;
- expands ancestors when search opens a result;
- keeps management commands in a contextual menu so Rename/Create nested book/Delete do not appear as four peer controls on every row;
- remains usable as a conventional list with linear screen-reader navigation.

The sidebar is the authoritative hierarchy and management surface. Shelf spines and recent cards are the discovery surface. Both may select the same underlying book/page, but their purposes are stated through headings and copy rather than left for users to infer.

### 3. Large-library states

Design and test these ranges:

- empty workspace;
- one empty book;
- typical: 5–20 books and 50–500 pages;
- large: 100 books and 5,000 pages;
- book and page titles up to 200 characters, including Thai, emoji, RTL text, and long unbroken tokens;
- pages with bodies up to 2MB;
- duplicate titles in different books;
- indexing, no-results, truncated-results, stale-result, and index-failure states.

An index failure falls back to title-only search and explains that body search is temporarily unavailable. It must never block access to the normal tree.

## Architecture and Component Boundaries

### Phase 1

- `src/app/styles/workspace.css` owns shell geometry, responsive action composition, book rail, status/nav rows, and motion.
- `src/components/mdez/MdezWorkspace.tsx` coordinates menu/dialog state, active-workspace backup, restore completion, and the existing single status region.
- `src/components/mdez/ShelfPane.tsx` owns Shelf hierarchy and composes actions, trust row, book rail, and recent pages.
- New focused components own the More menu, Book dialog, and Storage Trust row; none owns persistence directly.
- `src/lib/export.ts` evolves the current archive primitives into versioned workspace-backup generation without breaking book ZIP exports.
- A dedicated backup parser validates archives and returns a mutation-free preview model.
- Repository code performs restore in one Local Library transaction.
- Backup-recency metadata uses a versioned, workspace-scoped local key; it does not require a Dexie schema or server migration.

### Phase 2

- A focused search hook owns query state and worker lifecycle.
- A dedicated worker owns indexing and matching; React components receive serializable result summaries.
- A unified Library Tree component replaces the current split navigation presentation while reusing existing folder/document mutations.
- Search index data is derived and disposable. IndexedDB content remains the source of truth.

No new backend endpoint is required for either phase. Key Group mutations, encryption/key handling, Shared Links, GitHub fetching, and server persistence remain unchanged.

## Error and Recovery Contract

- Every error names the failed task and offers the next valid action.
- Layout errors are prevented through containment rather than hidden globally.
- Menu or dialog failures preserve the user's context and input.
- Backup generation failure does not update backup recency.
- Backup parsing and restore validation perform zero writes.
- Restore mutation failure rolls back the entire transaction.
- Search indexing failure leaves tree navigation intact.
- Switching workspaces cancels stale search results and closes workspace-scoped overlays.

## Verification Strategy

### Phase 1 automated coverage

1. Add geometry tests at 320, 390, 414, 768, 1024, 1243, 1280, 1440, and 1920 pixels.
2. At each width assert `documentElement.scrollWidth === clientWidth` and no visible element exceeds the client boundary by more than one pixel.
3. Assert the final main-content element, status row, and mobile navigation rectangles do not overlap.
4. Test action visibility and menu semantics on desktop and mobile.
5. Test dialog validation, Enter/Escape, focus restoration, duplicate sibling names, and failure preservation.
6. Test no-overflow and genuine-overflow book rails separately.
7. Round-trip a representative workspace through `.mdez.zip`, including nested books, unbooked pages, duplicate titles, Unicode, and empty books.
8. Prove invalid/corrupt backups make zero repository writes.
9. Verify backup-recency state is workspace-scoped and changes only after successful workspace backup initiation.
10. Run keyboard, 200% zoom, contrast, touch-target, and reduced-motion coverage.

### Phase 2 automated coverage

1. Test title, book, body, Unicode, no-result, capped-result, and stale-result search behavior.
2. Test global shortcut behavior with open/closed desktop sidebar and mobile drawer.
3. Test complete tree keyboard navigation and ARIA state.
4. Test per-workspace expansion persistence and ancestor expansion from search.
5. Measure the 5,000-page indexing/search budget in a deterministic performance fixture.
6. Verify index failure falls back without breaking tree navigation.

### Visual verification

After each phase builds successfully, inspect desktop and mobile together in one bounded pass. Include populated, empty, long-title, overflow, stale-backup, open-menu, search-results, and no-results states. Fix the resulting batch once, confirm once, and stop.

## Release Order

1. Phase 1A: shell containment and mobile chrome geometry.
2. Phase 1B: action hierarchy, authored book dialog, rail/card clarity, and semantics.
3. Phase 1C: versioned workspace backup, restore preview, and storage-trust messaging.
4. Ship and observe Phase 1.
5. Phase 2A: search index and results experience.
6. Phase 2B: unified semantic tree and expansion persistence.
7. Ship and observe Phase 2.

Phase 1 must remain releasable without Phase 2. Phase 2 must not reopen settled shell or backup architecture.

The two phases receive separate implementation plans. Planning begins with Phase 1 only after this design is approved; Phase 2 planning starts after Phase 1 ships and its defined observation gate is complete.

## Out of Scope

- Redesigning Edit, Read, or Split.
- Changing mode order or replacing mobile bottom navigation.
- Tags, stats dashboards, book colors/emoji, bulk editing, or a general command palette.
- Production File System Access API sync or two-way folder synchronization.
- SEO landing pages or Open Graph work.
- Accounts, private GitHub authentication, real-time collaboration, or changes to Key Group security.
- Changing a recent-page click from Edit to Read.
- Importing a backup directly into a Key Group or overwriting existing content during restore.

## Global Definition of Done

- No document-level horizontal overflow from 320–1920px, including the 1243px regression width.
- No persistent chrome overlaps content at maximum scroll.
- Every interactive control is keyboard reachable, visibly focused, and operable.
- Text contrast is at least 4.5:1 and component contrast at least 3:1.
- No shortened book/page value lacks a complete accessible or pointer-visible value.
- Every empty, error, and no-result state offers a valid next action.
- Phase 1 backup and restore complete a tested, non-destructive round trip.
- Phase 2 search and tree remain responsive at the defined large-library range.
- Lighthouse Accessibility is at least 95 on Shelf desktop and mobile.
- Unit tests, lint, typecheck, production build, targeted Playwright tests, and one bounded visual QA pass succeed.
