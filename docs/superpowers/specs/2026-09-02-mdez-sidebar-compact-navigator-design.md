# Mdez Sidebar Compact Navigator Design

**Date:** 2026-09-02

**Status:** Approved direction; implementation pending

**Mode:** Operate
**Target:** Left library sidebar in Local Library and Key Group workspaces

## Objective

Replace the sidebar's page-card presentation with a compact, searchable navigator that preserves Mdez's nested-book model, contextual page filtering, local-first behavior, and quiet pastel identity.

This design supersedes only the **Phase 2 persistent search and unified semantic library tree** sections of `docs/superpowers/specs/2026-08-31-mdez-shelf-improvements-design.md`. It does not reopen that specification's completed Phase 1 shell, Shelf action, book-dialog, book-rail, backup, or restore decisions.

## Job and Audience

The sidebar is the fast navigation and item-management surface for writers, developers, students, and note-heavy creators. A user should be able to identify the active book, switch pages, find an item in a larger library, and disclose management actions without the sidebar competing with the editor or Shelf.

The surface remains an **Operate** experience. Density, hierarchy, safe actions, keyboard access, and accurate local-storage language outrank decorative card treatment.

## Review Assessment

The submitted Opus review correctly identifies the main structural defect: pages are a flat, frequently scanned collection but are rendered as tall, nested cards. The supplied HTML is a useful density reference, not an implementation source.

| Review finding | Decision |
| --- | --- |
| Pages use cards where rows are appropriate | Accept. Replace page cards and their nested action frames with compact rows. |
| Destructive controls are exposed at rest | Accept for book rows. Move destructive book and page actions behind contextual disclosure. |
| Selection is too dependent on a border | Accept. Use a persistent leading accent, tinted background, and ink text. |
| Search is absent | Accept. Add global title/name search at the top of the sidebar. |
| Sort is absent | Defer. Preserve repository order until real use demonstrates that a second ordering model is needed. |
| Pink-on-pink contrast is unsafe | Partially accept. Current `--color-shelf` on `--color-panel` is approximately 4.49:1 and is too close to the AA threshold for small text. Add a darker semantic accent-text token and do not reduce metadata contrast with opacity. |
| “Pages without a book” should become “Unfiled” | Reject. The existing phrase is an intentional product term shared with Shelf, Import, backup, and move destinations. Improve its row treatment instead of creating vocabulary drift. |
| There is no Books empty state | Reject. Mdez already provides one; retain it and tighten its presentation. |
| Creation copy refers to volatile memory | Reject as inapplicable. Mdez auto-saves to IndexedDB. Do not introduce the mockup's “Drafts stay in memory until saved” copy. |
| Workspace switcher belongs inside the sidebar | Reject. The topbar remains the single home for workspace identity and switching. |

## Selected Direction

Use a **contextual compact navigator** rather than a unified file-explorer tree.

The sidebar keeps two connected sections:

1. **Books** selects the current book context, including `Pages without a book`.
2. **Pages** lists only the direct pages in that selected context.

Search temporarily replaces those contextual sections with grouped global results. Clearing search returns the user to the same selected book and page.

This direction preserves the current mental model and nested-book operations while removing excess chrome. It deliberately avoids two alternatives:

- A unified book/page tree is denser but adds complex tree keyboard behavior and makes the Pages context less obvious.
- Moving all pages to the main Shelf makes the sidebar simpler but weakens page switching while editing or reading.

## Outcomes and Proof

The design succeeds when:

- three populated page rows consume no more than 168px, excluding the Pages heading;
- a typical 768px-tall desktop viewport exposes substantially more navigation content than the current card treatment;
- the selected book and page are recognizable without relying on color or a one-pixel border alone;
- no destructive action is visible as a trash control at rest;
- a user can find a book or page by name without opening books one at a time;
- nested books, direct-page counts, GitHub source feedback, Key Group behavior, autosave, and drawer behavior remain intact;
- every action remains usable with keyboard, touch, screen reader, 200% zoom, and reduced motion;
- small text has at least 4.5:1 contrast and control boundaries have at least 3:1 contrast.

## Information Architecture

The sidebar order is:

1. mobile-only `Library shelf` heading and Close control;
2. persistent Search field;
3. scrollable context area containing GitHub source feedback and the Books and Pages sections;
4. contextual error or recovery message near the operation that produced it.

Do not add a sidebar footer, workspace switcher, global Import action, global Export action, backup action, or primary New Draft button. The Shelf remains the home for global create/import/export/backup actions. The sidebar owns navigation and contextual item management.

The desktop sidebar remains `15rem` wide. The tablet/mobile drawer remains `min(19rem, 86vw)`. Increased density comes from row anatomy and removal of nested frames, not from taking more canvas away from Edit, Read, or Split.

## Search Experience

### Field

- Place one search field above the scroll region with placeholder `Search books and pages` and accessible label `Search books and pages`.
- Use the existing workspace-input language, a Search icon, and a clear button that appears only for a non-empty query.
- `Cmd+K` on macOS and `Ctrl+K` elsewhere opens the sidebar/drawer when necessary and focuses the field.
- Escape clears a non-empty query. Escape with an empty query keeps the existing drawer-dismiss behavior.
- Search is local, immediate, case-insensitive, diacritic-insensitive, and whitespace-normalized.
- Match book names and page titles only. Body search, snippets, indexing workers, and fuzzy ranking are outside this phase.
- Ignore whitespace-only queries. Cap input at 200 characters and display at most 50 page results plus 20 book results.

### Results mode

For a non-empty normalized query, replace the normal Books and Pages sections with:

- `Books` results ordered by book path and repository order;
- `Pages` results ordered by most recently updated, then title;
- page rows that include the parent book path or `Pages without a book` as secondary context;
- a count for each result group;
- a no-results state: `No books or pages match “[query]”.` with a `Clear search` action.

Selecting a book result clears search, selects that book, expands its ancestors, and restores the normal contextual view. Selecting a page result clears search, selects its containing book and page, expands ancestors, switches to Edit as current navigation does, and closes the mobile drawer.

Search results use normal buttons and list semantics rather than claiming a combobox pattern. Tab reaches results in document order. Arrow-key result navigation is not required in this phase.

Search derives from the active in-memory workspace snapshot and performs no persistence or network access. Switching workspace clears the query and stale results.

## Books Section

### Header

- Show `Books`, the total number of books, and a compact `Create book` action.
- The action remains authored through the existing Book dialog and retains its current validation and focus behavior.
- The count is textual or badge-like but not interactive.

### Root context

Render `Pages without a book` as the first compact book-context row with its direct page count. It is not a card, banner, or unlabeled accent block.

### Nested book rows

Each row contains:

1. a disclosure control when the book has nested books;
2. a book-selection button with the book name;
3. a direct-page count;
4. a contextual-actions trigger.

Keep nested indentation at the existing `0.75rem` step and cap visual indentation after four levels so deep trees retain usable text width. The DOM and accessible hierarchy remain complete even when visual indentation is capped.

The book selection button's accessible name is `[book name] book, [count], [open or closed]`. The disclosure control retains `aria-expanded` and `aria-controls` only when it controls a nested group.

Book contextual actions are:

- `Create book inside [name]`;
- `Rename [name]`;
- a separated destructive `Delete [name]` action.

The contextual trigger uses an overflow icon, never a trash icon. Deletion retains the existing content guard and confirmation behavior. A failed delete keeps the selected context and exposes the existing recovery message.

### Selection treatment

Selected book and root-context rows use all three signals:

- a 3px leading berry accent;
- a low-intensity berry tint;
- ink-colored, higher-weight text.

Do not use a full solid berry slab. Hover may add a lighter tint but must not erase the selected treatment.

## Pages Section

### Header and creation

- Show `Pages`, the number of direct pages in the selected context, and a compact contextual `Create page` action.
- The action's accessible name remains `Create page` for the root or `Create page in [book]` for a book.
- Remove the current full-width create button. The main Shelf's primary Create Page action remains visually dominant.
- Do not add a second sort model in this phase. Pages retain repository order, then title as the existing tie-breaker.

Creating a page continues to create immediately and enter Edit, preserving local-first speed. After the editor renders, focus and select the complete `Page title` value so `untitled.md` can be replaced without a second navigation step. This in-context rename behavior replaces the need for a creation prompt.

### Page-row anatomy

Render pages as one bordered list with shared outer corners and one-pixel dividers. Do not wrap each row in a card.

Each page row contains:

1. a file icon;
2. a selection button containing a one-line title and relative update time;
3. a contextual-actions trigger.

Requirements:

- row height is 48–56px depending on text metrics;
- title truncates to one line with the complete title in the accessible name and native title;
- metadata uses `Updated [relative time]` and a semantic `<time datetime>` with the absolute localized timestamp in `title`;
- long unbroken titles shrink or truncate without widening the sidebar;
- selected pages use `aria-current="page"` and the same leading-accent/tint/text treatment as selected books;
- the whole selection button, not the overflow trigger, opens the page;
- do not place a focusable row around another interactive control.

### Page contextual actions

Replace the tall `<details>` frame and native rename prompt with a compact authored popover.

The trigger is named `Manage [page title]` and controls a panel containing:

- `Rename page`, which opens the page in Edit and focuses/selects the Page title field;
- `Move page to`, using the existing destination select and current move mutation;
- a separated destructive `Delete page` button.

Because the panel contains a form control, it uses labelled popover/group semantics rather than `role="menu"`. It closes on outside activation, Escape, successful action, page selection, mode change, drawer close, and workspace change. Escape and non-destructive dismissal restore focus to the trigger.

On fine-pointer desktop layouts, the overflow trigger may be visually revealed by row hover, row focus-within, or selection, but remains in the tab order and becomes visible when focused. On touch/hoverless devices it is always visible and has a minimum 44px target.

## Empty, Loading, and Error States

### Empty workspace

- Books: `No books yet` followed by `Create one to group related pages.` and a compact Create Book action only if the header action is not visible at the current breakpoint.
- Pages without a book: `No pages here yet.` followed by a contextual Create Page action.

### Empty selected book

Show `No pages in [book] yet.` with `Add first page`. Do not imply the book is disabled.

### Loading

While the library loads, keep search disabled and show one neutral `Loading library…` state in the scroll region. Do not render empty states before readiness is known.

### Search no-results

Keep the query visible, show the escaped query in the message, and offer Clear Search. Do not create a page automatically from a query.

### Errors

Use the existing single workspace status region for announcements. An inline message may remain visible for recovery context but must not create a competing assertive live region. Search computation failure falls back to the normal contextual navigator because the source data remains intact.

## Visual System

Preserve Mdez's existing Space Grotesk/Inter typography, pastel surfaces, berry/lavender/mint palette, borders, and six-to-eight-pixel control radii.

Add `--color-shelf-text: #96355f` for small accent text. It has approximately 6.42:1 contrast on `--color-panel`, 6.72:1 on `--color-canvas`, and 6.97:1 on `--color-paper`. Keep `--color-shelf` for larger accents and decorative surfaces.

Use `--color-ink` for row titles and `--color-muted` for timestamps. Do not apply opacity to metadata text; opacity produces surface-dependent contrast. Selected row text remains ink rather than white-on-berry.

Rows use shared boundaries rather than nested cards:

- one outer border for the page list;
- one divider between rows;
- no dog-ear decoration;
- no inner border around the page-selection button;
- no second border around a closed action disclosure.

Motion is limited to 120–180ms background, color, and disclosure transitions. No row translates on hover. All transitions are removed or reduced under `prefers-reduced-motion`.

## Responsive Behavior

### Desktop, 1024px and wider

- Preserve the persistent 15rem sidebar and existing collapse behavior.
- Search and section headers remain fixed within the sidebar composition while Books/Pages content scrolls as one region.
- Overflow triggers follow fine-pointer disclosure rules.

### Tablet and mobile, below 1024px

- Preserve the existing drawer, scrim, focus containment, Close control, and post-selection close behavior.
- Search is the first functional control after the drawer heading.
- Overflow triggers are always visible and at least 44×44px.
- The drawer retains `min(19rem, 86vw)` and must not create document-level horizontal overflow at 320px.
- Opening the search shortcut opens the drawer before focusing the field.

At 200% zoom, the sidebar may occupy the available viewport width, but its content must remain vertically scrollable and no control may be clipped horizontally.

## Accessibility Contract

- Sidebar remains an `<aside aria-label="Library shelf">`.
- Books and Pages are labelled sections with semantic headings and list markup.
- Selection uses `aria-pressed` for book-context buttons and `aria-current="page"` for the active page.
- Nested disclosure uses authored buttons and named controlled groups; the design does not introduce a partial or incorrect ARIA tree pattern.
- Icon-only controls have explicit accessible names and visible tooltips through native titles where useful.
- Every popover maintains focus, closes predictably, and restores focus after non-navigation dismissal.
- Keyboard users can reach search, book disclosure, book selection, contextual actions, page selection, and page actions in logical order.
- The global search shortcut does not run while focus is in an editable field, CodeMirror, dialog, or other control that owns the keystroke.
- Focus indicators retain at least 3:1 contrast and are not clipped by list overflow.
- Touch controls reach at least 44×44px on hoverless devices.
- Thai, emoji, RTL text, and titles up to 200 characters remain navigable and expose their complete accessible value.

## Architecture and Component Boundaries

### Existing components to refine

- `src/components/mdez/Sidebar.tsx` owns sidebar composition, search query state, search/normal mode switching, and scroll-region layout. It receives content and mutations but performs no persistence.
- `src/components/mdez/FolderTree.tsx` remains the nested Books navigator. It adopts compact rows, counts, selection treatment, and contextual actions; it does not render pages.
- `src/components/mdez/DocumentList.tsx` remains the selected-context Pages list. It adopts compact rows and delegates contextual management.
- `src/components/mdez/DocumentActions.tsx` becomes an authored popover/group instead of a bordered `<details>` card.
- `src/components/mdez/MdezWorkspace.tsx` owns global shortcut coordination, drawer opening, mode changes, and the one-shot request to focus/select the editor title after create or sidebar Rename.
- `src/components/mdez/EditorPane.tsx` fulfills an explicit focus-title request after the matching page renders. It does not infer focus from a title value such as `untitled.md`.
- `src/app/styles/workspace.css` owns sidebar geometry, compact row treatment, responsive trigger visibility, active states, and motion.
- `src/app/styles/tokens.css` owns the new semantic shelf-text token.

### Focused additions

- `src/components/mdez/SidebarSearch.tsx` renders the search field, clear control, shortcut hint, grouped results, and no-results state.
- `src/lib/sidebar-search.ts` exports pure query normalization and result derivation. It accepts folders/documents and returns capped, grouped results without React or persistence dependencies.
- `src/components/mdez/BookActionsMenu.tsx` owns the keyboard-accessible simple action menu for nested create, rename, and delete.

Do not introduce a worker, search index database, fuzzy-search dependency, new backend endpoint, schema migration, or general command palette. Search is derived, disposable UI state.

### Required interfaces

The implementation plan must preserve or formalize these boundaries:

```ts
type SidebarSearchResult = {
  books: Array<{ folder: Folder; path: string; directPageCount: number }>;
  pages: Array<{ document: Document; bookPath: string }>;
  totalBookMatches: number;
  totalPageMatches: number;
  truncated: boolean;
};

function searchSidebar(
  folders: Folder[],
  documents: Document[],
  query: string
): SidebarSearchResult;

type TitleFocusRequest = {
  documentId: string;
  requestId: number;
} | null;
```

`requestId` makes repeated Rename actions on the same page observable without coupling focus to title contents. The workspace clears or advances the request after EditorPane acknowledges it.

## Data and Interaction Flow

### Search

1. Sidebar updates local query state.
2. `searchSidebar` derives grouped results from the active workspace snapshot.
3. Selecting a result calls the existing folder/page selection callbacks.
4. Page selection continues through the existing workspace handler, which changes mode and closes the drawer.
5. Workspace identity change clears the query before rendering results from the new snapshot.

### Create page and Rename page

1. Existing create or selection mutation identifies the target document.
2. Workspace switches to Edit and publishes a `TitleFocusRequest` for that document.
3. EditorPane waits until the matching document title input is mounted, then focuses and selects its complete value once.
4. Normal title draft/save behavior remains unchanged.

### Contextual actions

Contextual components call existing create, rename, move, and delete mutations. They do not read or write IndexedDB directly. Operation success or failure continues through the workspace's existing status/error channel.

## Content and State Ranges

Design and test:

- empty workspace;
- root pages without books;
- one empty book;
- nested books at least six levels deep;
- typical library: 5–20 books and 50–500 pages;
- large title-search fixture: 100 books and 5,000 pages;
- duplicate page titles in different books;
- book and page titles up to 200 characters;
- Thai, combining marks, emoji, RTL text, and long unbroken tokens;
- selected item outside the first scroll viewport;
- open contextual popover during page/book selection, drawer close, mode change, and workspace switch;
- search with zero, one, 50, and more than 50 page matches.

For the 5,000-page title-only fixture, a query update should complete within 100ms on the test machine and produce no long task over 50ms. If this target fails, use deferred rendering or memoization before considering a worker.

## Verification Strategy

### Unit and component coverage

- Query normalization: case, diacritics, repeated whitespace, empty input, Unicode, and 200-character cap.
- Search grouping, book paths, ordering, counts, result caps, and truncation flag.
- Direct-page counts remain distinct from descendant-page counts.
- TitleFocusRequest fires after create and repeated Rename actions on the same page.
- Book menu and page popover support Escape, outside dismissal, focus restoration, and destructive-action separation.
- Page move retains the existing destination and selected-context behavior.

### End-to-end coverage

- Populated page rows are no taller than 56px and three rows fit within 168px.
- Page list uses one outer frame and dividers, without nested card/action borders.
- Active book and page expose the correct ARIA state and at least three visual signals.
- Desktop overflow triggers reveal on hover/focus/selection; touch triggers remain visible with 44px targets.
- No trash icon control is visible at rest.
- Global shortcut opens/focuses desktop sidebar and mobile drawer, but does not steal keystrokes from the title field, editor, or dialogs.
- Search finds nested books and pages, shows parent paths, handles no results, clears correctly, and selects the right context.
- Create Page and Rename Page focus and select the correct editor title.
- Nested create/rename/delete, GitHub source refresh, Key Group navigation, mobile drawer, and desktop sidebar restore remain regression-covered.
- Geometry remains contained at 320, 390, 768, 1024, 1243, 1440, and 1920px.

### Bounded visual verification

Inspect desktop and mobile together in one pass with:

- empty library;
- populated root pages;
- nested books;
- selected page and book;
- long and multilingual titles;
- open book menu and page action popover;
- search results, truncated results, and no results;
- 200% zoom and reduced motion.

Fix the resulting defect batch once, confirm once, and stop.

## Release Order

1. Semantic accent token, compact row primitives, and density tests.
2. Book rows and authored Book actions menu.
3. Page rows and authored Page action popover.
4. Create/Rename title-focus handoff.
5. Sidebar title/name search and global shortcut.
6. Responsive, accessibility, regression, and bounded visual verification.

Every step must leave the sidebar usable and testable. Search ships after compact navigation so a search defect cannot block ordinary book/page access.

## Out of Scope

- Replacing the contextual Books/Pages model with one ARIA tree.
- Full-text body search, snippets, fuzzy matching, tags, filters, or a worker-backed index.
- Page sorting or persisted per-book sort preferences.
- Drag-and-drop reordering or bulk actions.
- Moving workspace identity, Import, Export, backup, or global Shelf actions into the sidebar.
- Changing IndexedDB schema, storage semantics, autosave, backup format, or Key Group security.
- Redesigning Shelf, Edit, Read, Split, topbar, status bar, or mobile mode navigation.
- Replacing page creation with a modal prompt.
- Changing product vocabulary from `Pages without a book` to `Unfiled`.

## Definition of Done

- Pages are compact rows, not independent cards.
- Books remain nested, contextual, and fully manageable without exposed destructive icons.
- Search retrieves books and page titles across the active workspace without persistence or network access.
- The selected book/page is clear without color-only or border-only communication.
- New and renamed pages enter an authored, focused title-editing flow with no native prompt.
- Empty, loading, error, search, touch, keyboard, long-title, multilingual, and deep-nesting states meet this contract.
- Text contrast is at least 4.5:1; non-text active/focus boundaries are at least 3:1.
- No document-level horizontal overflow occurs from 320–1920px.
- Unit tests, lint, typecheck, production build, targeted Playwright tests, and one bounded visual QA pass pass before completion.
