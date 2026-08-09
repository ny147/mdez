# Mdez Compact Library Explorer Design

**Date:** 2026-08-09

**Status:** Approved visual direction, pending implementation plan

**Scope:** Desktop sidebar and Shelf mode across desktop, tablet, and mobile drawer layouts

## Goal

Make the library feel calm and predictable by separating navigation from commands. The sidebar becomes a compact explorer for choosing books and pages. Shelf mode becomes the single owner of create, import, and export actions. Brand colors, local-first behavior, and existing data operations remain unchanged.

## Problems Addressed

- Create page, New book, Import markdown, and Book ZIP currently appear in several places at once.
- The sidebar mixes navigation, large calls to action, nested cards, and permanent management controls in a 240px rail.
- Context is ambiguous because identical actions do not clearly communicate whether they affect Shelf root or the open book.
- Vertical book spines are difficult to scan and become thin or tall as page counts change.
- Recent-page cards do not establish a strong title, location, and update-time hierarchy.
- Dense content at the top of the sidebar contrasts with a comparatively vacant Shelf surface.

## Design Direction

Use a compact file-explorer model with progressive disclosure. The sidebar contains only library navigation and item-level management. Shelf mode distributes each global or contextual command to the section it affects.

### Action Ownership

Each command has one visible owner while Shelf mode is active:

- **Books header:** New book and Book ZIP.
- **Recent pages header:** Import markdown and Create page.
- **Book row actions:** Create nested book, rename book, and delete book.
- **Page row actions:** Rename page, move page, and delete page.

Remove the existing Shelf command bar and the sidebar's large Import markdown, Book ZIP, New book, and Create page buttons. Empty states explain the next step without repeating those buttons.

Edit and Read retain their existing recovery actions only when no page is selected. Those controls are not rendered simultaneously with Shelf mode and therefore do not create competing ownership.

Context remains explicit in accessible names:

- `Create page in [book]` when a book is open.
- `Create page` at Shelf root.
- `Book ZIP for [book]` only when an exportable book is open.
- Disabled ZIP copy explains that Shelf root cannot be exported as a book.

## Sidebar Structure

The sidebar is one quiet navigation surface, not a stack of cards.

1. A compact Library label with a page count.
2. A Books group containing Shelf root followed by nested books.
3. A Pages group containing pages within the selected book or Shelf root.

Groups use spacing and one divider instead of bordered wrappers. Rows share one component vocabulary:

- leading book, library, or page icon;
- truncating title;
- page count metadata for book rows or relative update time for page rows;
- contextual actions at the trailing edge.

Selected rows use the existing low-intensity berry tint and border. They do not use a fully saturated bar. Unselected rows remain transparent and gain a quiet hover background.

### Progressive Disclosure

Secondary actions are hidden visually by default and shown when a row is:

- hovered with a pointer;
- focused within by keyboard;
- selected;
- displayed in the touch-oriented mobile drawer.

The actions remain present in the accessibility tree and keyboard order. Hiding is visual only. Touch layouts always expose actions for the selected row because hover is unavailable.

To avoid crowding, each manageable row exposes one labeled More actions trigger. The resulting popover contains the existing rename, move, nested-book, and delete actions relevant to that row. No other management buttons remain beside the row title.

All interactive targets remain at least 44 by 44 CSS pixels on touch layouts. Desktop icon visuals may be smaller while retaining an equivalent hit area.

## Shelf Mode Structure

Remove the top command bar. Keep the Bookshelf heading and one short context sentence, then render two distinct sections.

### Books

The header contains the Books title, count, New book, and contextual Book ZIP action.

Replace vertical book spines with horizontal book tiles:

- a 12rem minimum tile width before the grid collapses to one column;
- title on a normal horizontal baseline;
- direct page count;
- clear Open book or Currently open state;
- full-tile selection target with `aria-pressed` and `aria-expanded` semantics.

Shelf root appears as the first tile and represents loose pages. It can be selected but cannot enable Book ZIP. Actual books follow in existing order. The layout uses an auto-fitting grid on wide surfaces, two columns when practical, and one column on narrow surfaces.

### Recent Pages

The header contains Recent pages, Import markdown, and Create page.

Each page card uses a stable three-level hierarchy:

1. page title;
2. parent book or Shelf root;
3. human-readable update time.

Cards use a comfortable horizontal footprint, consistent padding, and one selected state. Retain only a subtle dog-ear detail if it does not compete with the text. Do not nest an additional bordered button inside the card.

## Responsive Behavior

### Desktop, 1024px and above

- Sidebar retains the existing 240px desktop width token.
- Row actions appear on hover, focus, or selection.
- Books and Recent pages use responsive multi-column grids.
- Section commands remain on the same header row when they fit.

### Tablet, 768px to 1023px

- Existing drawer behavior remains.
- Shelf section commands wrap as a compact group without clipping.
- Book and page grids use two columns when their minimum width is satisfied, otherwise one.

### Mobile, below 768px

- Existing drawer and bottom navigation remain.
- Selected-row actions remain visible inside the drawer.
- Shelf section headers stack above their command groups.
- Commands use full-width or balanced two-column placement based on available space.
- Book and page grids use one column.
- No document-level horizontal overflow is allowed at 390px and 430px.

## Accessibility

- Preserve semantic navigation, tree, treeitem, list, heading, and button roles.
- Preserve native buttons and visible focus rings.
- More actions triggers have specific accessible names such as `More actions for hello world`.
- Popovers or menus close with Escape and return focus to their trigger.
- Selected book and page states are conveyed with `aria-selected` or `aria-pressed`, not color alone.
- Full action context remains available through accessible names even when visible labels are compact.
- Text and controls continue to meet WCAG AA contrast using existing tokens.

## Component Boundaries

- `Sidebar.tsx` owns the simplified explorer frame and group layout.
- `FolderTree.tsx` owns book navigation rows and book management disclosure.
- `DocumentList.tsx` owns page navigation rows and page management disclosure.
- `ShelfPane.tsx` owns action placement, horizontal book tiles, and recent-page cards.
- Create a small reusable `RowActionsPopover` backed by the native popover API for the shared book and page disclosure behavior. No broader component-system refactor is required.
- `MdezWorkspace.tsx` retains state coordination and existing callbacks without changing repository behavior.

## Data and Behavior

No persistence schema or data flow changes are required. Existing callbacks continue to perform create, import, export, rename, move, select, and delete operations. The work changes presentation, command placement, and responsive behavior only.

## Testing

Add or update Playwright coverage for:

- no duplicate Create page, New book, Import markdown, or Book ZIP controls in active Shelf mode;
- sidebar contains navigation rows but no large global-action strip;
- row actions appear for hover, keyboard focus, selection, and selected mobile rows;
- Shelf root and book tiles use horizontal text and correct selected semantics;
- Book ZIP remains disabled for Shelf root and enabled for an open book;
- recent-page cards expose title, parent location, and relative time;
- no overflow or clipped actions at 390px, 430px, 768px, 1024px, and 1440px;
- touch targets meet the 44px minimum on mobile;
- current create, import, export, rename, move, delete, drawer, and keyboard flows continue to pass.

Run unit tests, lint, typecheck, production build, the full Playwright suite, Impeccable detection, and live visual inspection at desktop, tablet, and mobile sizes before completion.

## Out of Scope

- Brand color or token changes.
- Repository, IndexedDB, import, export, or autosave changes.
- New search, filtering, sorting, favorites, drag-and-drop reordering, or command-palette features.
- Changes to editor, reader, split-pane, topbar, statusbar, or mobile navigation beyond preserving their current behavior.
