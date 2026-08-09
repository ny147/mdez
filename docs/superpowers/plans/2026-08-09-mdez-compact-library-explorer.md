# Mdez Compact Library Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crowded library rail and vertical Shelf cards with a navigation-only compact explorer, single-owner Shelf commands, horizontal book tiles, and structured recent-page cards.

**Architecture:** Keep `MdezWorkspace` as the state coordinator and preserve every existing repository callback. Move global command ownership into `ShelfPane`, simplify `Sidebar`, `FolderTree`, and `DocumentList` into explorer navigation, and share disclosure behavior through one native-popover component. Extend the existing semantic CSS and Playwright suite without changing persistence, tokens, or brand colors.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, Tailwind CSS plus semantic CSS, lucide-react, Playwright, Vitest.

## Global Constraints

- Preserve every value in `src/app/styles/tokens.css`.
- Shelf mode is the only simultaneous owner of Create page, New book, Import markdown, and Book ZIP.
- Edit and Read retain recovery actions only when no page is selected.
- Sidebar desktop width remains `240px`; the existing tablet/mobile drawer remains intact.
- Row management uses one `More actions for [item]` trigger and the native popover API.
- Touch targets remain at least `44px × 44px` at widths below `768px`.
- Book tiles use horizontal text and a `12rem` minimum before collapsing to one column.
- No document-level horizontal overflow at `390`, `430`, `768`, `1024`, or `1440` pixels.
- No persistence schema, import/export implementation, autosave, topbar, statusbar, editor, reader, or split-pane behavior changes.

## File Responsibility Map

- Create `src/components/ui/RowActionsPopover.tsx`: shared native popover trigger, focus restoration, close-on-action behavior, and visual state hook.
- Modify `src/components/mdez/Sidebar.tsx`: navigation-only explorer frame, counts, errors, source status, and drawer close control.
- Modify `src/components/mdez/FolderTree.tsx`: Shelf root/book navigation rows and book action disclosure.
- Modify `src/components/mdez/DocumentList.tsx`: page navigation rows and page action disclosure.
- Modify `src/components/mdez/ShelfPane.tsx`: unique command ownership, Shelf root/book tiles, and recent-page cards.
- Modify `src/components/mdez/MdezWorkspace.tsx`: remove obsolete Sidebar command props only; preserve callbacks.
- Modify `src/app/styles/workspace.css`: explorer rows, popover, horizontal tiles, recent-page cards, and breakpoint behavior.
- Modify `tests/e2e/mdez.spec.ts`: command ownership, progressive disclosure, accessibility, layout, and migrated interaction helpers.

---

### Task 1: Establish Single Command Ownership

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Modify: `src/components/mdez/Sidebar.tsx`
- Modify: `src/components/mdez/FolderTree.tsx`
- Modify: `src/components/mdez/DocumentList.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/ShelfPane.tsx`

**Interfaces:**
- Consumes: existing `onCreateDocument`, `onCreateFolder`, `onOpenImport`, and `onExportFolder` callbacks supplied by `MdezWorkspace`.
- Produces: one active Shelf command for each action, plus navigation-only Sidebar props with no global create/import/export callbacks.

- [ ] **Step 1: Add a failing command-ownership test and Shelf helper**

Add this helper near the existing mode helpers:

```ts
async function clickShelfCommand(page: import("@playwright/test").Page, name: string) {
  await showShelfIfAvailable(page);
  const control = page.getByRole("main").getByRole("button", { name, exact: true });
  await expect(control).toBeVisible();
  await control.evaluate((button: HTMLButtonElement) => button.click());
}
```

Add this test:

```ts
test("Shelf owns each library command exactly once", async ({ page }) => {
  const main = page.getByRole("main");
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });

  for (const name of ["Create page", "New book", "Import markdown"]) {
    await expect(main.getByRole("button", { name, exact: true })).toHaveCount(1);
    await expect(sidebar.getByRole("button", { name, exact: true })).toHaveCount(0);
  }

  await expect(main.getByRole("button", { name: "Book ZIP for open book in Shelf", exact: true })).toHaveCount(1);
  await expect(sidebar.getByRole("button", { name: "Book ZIP for open book in Shelf", exact: true })).toHaveCount(0);
});
```

The production mutation this catches is reintroducing any duplicate global command into the sidebar or Shelf command bar.

- [ ] **Step 2: Run the ownership test and verify RED**

Run:

```bash
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "Shelf owns each library command exactly once"
```

Expected: FAIL because Sidebar still contains Import markdown and Book ZIP, FolderTree contains New book, DocumentList contains Create page, and ShelfPane still renders a separate command bar.

- [ ] **Step 3: Remove global commands from the Sidebar tree and page list**

In `SidebarProps` and the `Sidebar` call in `MdezWorkspace`, remove:

```ts
onCreateDocument: () => void;
onOpenImport: () => void;
onExportFolder: () => void;
```

Keep `onCreateFolder` because book rows still create nested books. Remove the import/export button strip from `Sidebar`. Replace its bordered scroll wrapper with:

```tsx
<div className="sidebar-explorer min-h-0 flex-1 overflow-auto">
  <div className="sidebar-explorer-summary">
    <strong>Library</strong>
    <span>{documents.length} {documents.length === 1 ? "page" : "pages"}</span>
  </div>
  <FolderTree
    folders={folders}
    documents={documents}
    selectedFolderId={selectedFolderId}
    expandedFolderIds={expandedFolderIds}
    onSelectFolder={onSelectFolder}
    onToggleFolder={onToggleFolder}
    onCreateFolder={onCreateFolder}
    onRenameFolder={onRenameFolder}
    onDeleteFolder={onDeleteFolder}
  />
  <DocumentList
    folders={folders}
    documents={documents}
    selectedFolderId={selectedFolderId}
    selectedDocumentId={selectedDocumentId}
    onSelectDocument={onSelectDocument}
    onRenameDocument={onRenameDocument}
    onMoveDocument={onMoveDocument}
    onDeleteDocument={onDeleteDocument}
  />
</div>
```

Remove the New book header action and bordered empty card from `FolderTree`. Remove `onCreateDocument`, `onOpenImport`, the Create page header action, and the duplicated empty-state buttons from `DocumentList`. Empty text becomes:

```tsx
<p className="sidebar-empty-copy">
  {selectedBook ? `No pages in ${selectedBook.name}.` : "No loose pages on Shelf root."}
</p>
```

- [ ] **Step 4: Move commands into their final Shelf section headers**

Delete `.shelf-command-bar`, `.shelf-guidance`, and `.shelf-primary-actions` markup from `ShelfPane`. Add Books header commands:

```tsx
<div className="shelf-section-header">
  <div>
    <h2 id="bookshelf-title" className="workspace-section-title">Books</h2>
    <span className="shelf-section-count">{sortedFolders.length} {sortedFolders.length === 1 ? "book" : "books"}</span>
  </div>
  <div className="shelf-section-actions">
    <button
      type="button"
      onClick={onExportFolder}
      disabled={!openBook}
      aria-label="Book ZIP for open book in Shelf"
      className="secondary-button"
    >
      <Download aria-hidden="true" className="h-4 w-4" />
      Book ZIP
    </button>
    <button type="button" onClick={() => onCreateFolder(null)} className="secondary-button">
      <BookOpen aria-hidden="true" className="h-4 w-4" />
      New book
    </button>
  </div>
</div>
```

Add Recent pages header commands:

```tsx
<div className="shelf-section-header">
  <h2 id="recent-pages-title" className="workspace-section-title">Recent pages</h2>
  <div className="shelf-section-actions">
    <button type="button" onClick={onOpenImport} className="secondary-button">
      <Upload aria-hidden="true" className="h-4 w-4" />
      Import markdown
    </button>
    <button type="button" onClick={onCreateDocument} aria-label={createPageLabel} className="primary-button">
      <FilePlus aria-hidden="true" className="h-4 w-4" />
      Create page
    </button>
  </div>
</div>
```

Use instructional empty copy only. Do not render buttons inside either Shelf empty state.

- [ ] **Step 5: Migrate tests that intentionally used Sidebar global actions**

Replace Sidebar-specific command calls with `clickShelfCommand`. Examples:

```ts
await clickShelfCommand(page, "New book");
await clickShelfCommand(page, "Import markdown");
await clickShelfCommand(page, selectedBook ? `Create page in ${selectedBook}` : "Create page");
```

Keep direct no-document Edit/Read recovery-action tests unchanged. Update the existing fresh-workspace and open-book expectations so they target `main` and expect `New book`, not `New book on shelf`.

- [ ] **Step 6: Run focused command and workflow tests**

Run:

```bash
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "Shelf owns each library command exactly once|fresh workspace exposes visible create and import actions|one open book controls shelf context|imports markdown|exports a nested folder ZIP"
```

Expected: all selected desktop and mobile tests PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/components/mdez/Sidebar.tsx src/components/mdez/FolderTree.tsx src/components/mdez/DocumentList.tsx src/components/mdez/MdezWorkspace.tsx src/components/mdez/ShelfPane.tsx tests/e2e/mdez.spec.ts
git commit -m "refactor: give Shelf clear command ownership"
```

---

### Task 2: Build the Compact Explorer and Row Action Popover

**Files:**
- Create: `src/components/ui/RowActionsPopover.tsx`
- Modify: `src/components/mdez/Sidebar.tsx`
- Modify: `src/components/mdez/FolderTree.tsx`
- Modify: `src/components/mdez/DocumentList.tsx`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: existing rename, move, nested-book, and delete callbacks.
- Produces: `RowActionsPopover({ label, children, selected })`, one explorer-row visual vocabulary, and keyboard/touch-safe progressive disclosure.

- [ ] **Step 1: Add failing explorer and disclosure tests**

Add:

```ts
test("sidebar presents quiet explorer rows with disclosed management actions", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Writing"));
  await clickShelfCommand(page, "New book");
  await openShelfDrawerIfAvailable(page);

  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  const book = sidebar.getByRole("treeitem", { name: /Writing book/ });
  const more = sidebar.getByRole("button", { name: "More actions for Writing" });

  await expect(book).toBeVisible();
  await expect(sidebar.locator(".sidebar-explorer")).toBeVisible();
  await more.focus();
  await more.click();
  await expect(page.getByRole("button", { name: "Rename Writing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create book inside Writing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete Writing" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
});

test("selected mobile explorer rows keep their More actions trigger available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clickShelfCommand(page, "Create page");
  await openShelfDrawerIfAvailable(page);
  const more = page.getByRole("complementary", { name: "Library shelf" })
    .getByRole("button", { name: "More actions for untitled.md" });
  await expect(more).toBeVisible();
  const box = await more.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
```

The mutations these tests catch are restoring always-visible management buttons, removing native disclosure, breaking Escape focus restoration, or shrinking touch actions.

- [ ] **Step 2: Run disclosure tests and verify RED**

Run:

```bash
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "quiet explorer rows|selected mobile explorer rows"
```

Expected: FAIL because `RowActionsPopover`, `.sidebar-explorer`, and More actions triggers do not exist.

- [ ] **Step 3: Create `RowActionsPopover` with the native popover API**

Create `src/components/ui/RowActionsPopover.tsx`:

```tsx
"use client";

import { MoreHorizontal } from "lucide-react";
import { useId, useRef, type MouseEvent, type ReactNode } from "react";

type RowActionsPopoverProps = {
  label: string;
  children: ReactNode;
  selected: boolean;
};

export function RowActionsPopover({ label, children, selected }: RowActionsPopoverProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function closeAfterAction(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-row-action]")) {
      popoverRef.current?.hidePopover();
      triggerRef.current?.focus();
    }
  }

  return (
    <span className="sidebar-row-actions" data-selected={selected}>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-label={label}
        className="sidebar-row-actions-trigger"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </button>
      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        aria-label={label}
        className="row-actions-popover"
        onClick={closeAfterAction}
      >
        {children}
      </div>
    </span>
  );
}
```

React 19's installed DOM types support `popoverTarget`; use that property directly. Do not replace the native popover with an absolute element inside the scroll container.

- [ ] **Step 4: Convert FolderTree and DocumentList to explorer rows**

Render Shelf root as one full-width `sidebar-row sidebar-root-row` treeitem without management actions. Render each real book with this structure:

```tsx
<div className={`sidebar-row sidebar-book-row group ${isSelected ? "is-selected" : ""}`} style={{ paddingLeft: `${depth * 0.75}rem` }}>
  <button
    type="button"
    onClick={() => hasChildren && onToggleFolder(folder.id)}
    disabled={!hasChildren}
    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
    className="sidebar-row-expand"
  >
    {hasChildren ? (isExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />) : <span aria-hidden="true" />}
  </button>
  <button
    type="button"
    onClick={() => onSelectFolder(folder.id)}
    role="treeitem"
    aria-level={depth + 1}
    aria-label={`${folder.name} book, ${pageCount} ${pageCount === 1 ? "page" : "pages"}, ${isSelected ? "open" : "closed"}`}
    aria-selected={isSelected}
    aria-expanded={isSelected}
    className="sidebar-row-main"
  >
    <BookOpen aria-hidden="true" className="sidebar-row-icon" />
    <span className="sidebar-row-copy">
      <span className="sidebar-row-title">{folder.name}</span>
      <span className="sidebar-row-meta">{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
    </span>
  </button>
  <RowActionsPopover label={`More actions for ${folder.name}`} selected={isSelected}>
    <button data-row-action type="button" onClick={() => onCreateFolder(folder.id)} aria-label={`Create book inside ${folder.name}`}>Create nested book</button>
    <button data-row-action type="button" onClick={handleRename} aria-label={`Rename ${folder.name}`}>Rename book</button>
    <button data-row-action type="button" onClick={() => onDeleteFolder(folder.id)} aria-label={`Delete ${folder.name}`}>Delete book</button>
  </RowActionsPopover>
</div>
```

Render each page with the same copy hierarchy and its existing callbacks:

```tsx
<article className={`sidebar-row sidebar-page-row ${selectedDocumentId === document.id ? "is-selected" : ""}`}>
  <button
    type="button"
    onClick={() => onSelectDocument(document.id)}
    aria-pressed={selectedDocumentId === document.id}
    className="sidebar-row-main"
  >
    <FileText aria-hidden="true" className="sidebar-row-icon" />
    <span className="sidebar-row-copy">
      <span className="sidebar-row-title">{document.title}</span>
      <span className="sidebar-row-meta">Updated {formatRelativeTime(document.updatedAt)}</span>
    </span>
  </button>
  <RowActionsPopover label={`More actions for ${document.title}`} selected={selectedDocumentId === document.id}>
    <button data-row-action type="button" onClick={() => renameDocument(document)} aria-label={`Rename ${document.title}`}>Rename page</button>
    <label className="row-actions-field">
      <span>Move page</span>
      <select value={document.folderId ?? ""} onChange={(event) => onMoveDocument(document.id, event.target.value || null)} aria-label={`Move ${document.title} page`}>
        <option value="">Shelf root</option>
        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select>
    </label>
    <button data-row-action type="button" onClick={() => onDeleteDocument(document.id)} aria-label={`Delete ${document.title}`}>Delete page</button>
  </RowActionsPopover>
</article>
```

Keep `role="tree"`, `role="treeitem"`, `role="group"`, `aria-level`, selection, expansion, and recursive nesting. Sort move destinations with the existing order/name comparator before mapping them.

- [ ] **Step 5: Add explorer and popover CSS**

Implement:

```css
.sidebar-explorer { display: flex; flex-direction: column; gap: var(--space-5); }
.sidebar-explorer-summary,
.sidebar-group-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.sidebar-group + .sidebar-group { border-top: 1px solid var(--color-rule); padding-top: var(--space-4); }
.sidebar-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; border: 1px solid transparent; border-radius: var(--radius-control); }
.sidebar-book-row { grid-template-columns: 2.25rem minmax(0, 1fr) auto; }
.sidebar-root-row { grid-template-columns: minmax(0, 1fr); }
.sidebar-row:hover { background: color-mix(in srgb, var(--color-paper) 72%, transparent); }
.sidebar-row.is-selected { border-color: color-mix(in srgb, var(--color-shelf) 28%, var(--color-rule)); background: color-mix(in srgb, var(--color-shelf) 9%, var(--color-paper)); }
.sidebar-row-main { display: grid; grid-template-columns: 1rem minmax(0, 1fr); gap: var(--space-2); min-width: 0; padding: var(--space-2); text-align: left; }
.sidebar-row-title,
.sidebar-row-meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-row-actions { opacity: 0; }
.sidebar-row:hover .sidebar-row-actions,
.sidebar-row:focus-within .sidebar-row-actions,
.sidebar-row-actions[data-selected="true"] { opacity: 1; }
.sidebar-row-actions-trigger { display: inline-grid; width: 2.25rem; height: 2.25rem; place-items: center; }
.row-actions-popover { min-width: 12rem; padding: var(--space-2); border: 1px solid var(--color-rule); border-radius: var(--radius-control); background: var(--color-paper); box-shadow: var(--shadow-floating); }
.row-actions-popover > * { width: 100%; min-height: 2.5rem; }
```

Use the project's existing floating shadow token name found in `tokens.css`. At the mobile breakpoint, set the More trigger to `2.75rem` square and keep selected triggers visible.

- [ ] **Step 6: Verify disclosure, existing rename/move/delete flows, lint, and typecheck**

Run:

```bash
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "quiet explorer rows|selected mobile explorer rows|creates nested folders|exports a nested folder ZIP"
npm run lint
npm run typecheck
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/components/ui/RowActionsPopover.tsx src/components/mdez/Sidebar.tsx src/components/mdez/FolderTree.tsx src/components/mdez/DocumentList.tsx src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "feat: simplify the library explorer"
```

---

### Task 3: Replace Vertical Spines with Horizontal Shelf Tiles

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Modify: `src/components/mdez/ShelfPane.tsx`
- Modify: `src/app/styles/workspace.css`

**Interfaces:**
- Consumes: `folders`, `documents`, `selectedFolderId`, `onSelectFolder`, and `onSelectDocument` already passed to `ShelfPane`.
- Produces: Shelf root plus ordered book tiles, and recent-page cards with title, parent, and time hierarchy.

- [ ] **Step 1: Add failing tile and page-card tests**

Add:

```ts
test("Shelf uses horizontal book tiles including Shelf root", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Writing"));
  await clickShelfCommand(page, "New book");

  const shelf = page.getByRole("main");
  const root = shelf.getByRole("button", { name: /Shelf root, \d+ pages?, closed/ });
  const writing = shelf.getByRole("button", { name: /Writing book, 0 pages, open/ });

  await expect(root).toBeVisible();
  await expect(writing).toBeVisible();
  const geometry = await writing.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, writingMode: getComputedStyle(node).writingMode };
  });
  expect(geometry.width).toBeGreaterThan(geometry.height);
  expect(geometry.writingMode).toBe("horizontal-tb");
});

test("recent page cards expose title location and update time without nested card controls", async ({ page }) => {
  await clickShelfCommand(page, "Create page");
  await showShelfIfAvailable(page);

  const recent = page.getByRole("list", { name: "Recent pages" });
  const card = recent.getByRole("listitem").filter({ hasText: "untitled.md" });
  await expect(card.getByText("Shelf root", { exact: true })).toBeVisible();
  await expect(card.getByText(/^Updated (recently|\d+ (min|hr|day|days) ago)$/)).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(1);
});
```

The production mutations caught are restoring vertical writing, omitting Shelf root context, losing page location/time, or recreating nested controls.

- [ ] **Step 2: Run tile tests and verify RED**

Run:

```bash
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "horizontal book tiles|recent page cards expose"
```

Expected: FAIL because Shelf root is not a tile and `.book-spine` uses vertical writing and dynamic narrow dimensions.

- [ ] **Step 3: Render Shelf root and book tiles**

Replace the spine rail with:

```tsx
<div className="shelf-book-grid">
  <button
    type="button"
    aria-label={`Shelf root, ${rootPageCount} ${rootPageCount === 1 ? "page" : "pages"}, ${selectedFolderId === null ? "open" : "closed"}`}
    aria-pressed={selectedFolderId === null}
    onClick={() => onSelectFolder(null)}
    className={`shelf-book-tile ${selectedFolderId === null ? "is-open" : ""}`}
  >
    <span className="shelf-book-title">Shelf root</span>
    <span className="shelf-book-meta">{rootPageCount} {rootPageCount === 1 ? "page" : "pages"}</span>
    <span className="shelf-book-state">{selectedFolderId === null ? "Currently open" : "Open shelf"}</span>
  </button>
  {sortedFolders.map((folder) => {
    const pageCount = getBookPageCount(documents, folder.id);
    const isOpen = selectedFolderId === folder.id;
    return (
      <button
        key={folder.id}
        type="button"
        aria-label={`${folder.name} book, ${pageCount} ${pageCount === 1 ? "page" : "pages"}, ${isOpen ? "open" : "closed"}`}
        aria-pressed={isOpen}
        aria-expanded={isOpen}
        onClick={() => onSelectFolder(folder.id)}
        className={`shelf-book-tile ${isOpen ? "is-open" : ""}`}
      >
        <span className="shelf-book-title">{folder.name}</span>
        <span className="shelf-book-meta">{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
        <span className="shelf-book-state">{isOpen ? "Currently open" : "Open book"}</span>
      </button>
    );
  })}
</div>
```

Compute `rootPageCount` from documents whose `folderId === null`. Remove inline height/width calculations and `.writing-mode-vertical`.

- [ ] **Step 4: Restyle recent-page cards as one control per entity**

Use:

```tsx
<ul className="recent-page-grid" aria-label="Recent pages">
  {visiblePages.map((document) => (
    <li key={document.id} className="recent-page-item">
      <button
        type="button"
        aria-label={`${document.title} page in ${parentBook}, updated ${updated}`}
        aria-pressed={selectedDocumentId === document.id}
        onClick={() => onSelectDocument(document.id)}
        className="recent-page-card"
      >
        <span className="recent-page-title">{document.title}</span>
        <span className="recent-page-location">{parentBook}</span>
        <span className="recent-page-updated-label">Updated {updated}</span>
      </button>
    </li>
  ))}
</ul>
```

Keep the dog-ear pseudo-element only at its current subtle size. Do not add another bordered wrapper around the button.

- [ ] **Step 5: Replace spine CSS with horizontal responsive grids**

Implement:

```css
.shelf-book-grid,
.recent-page-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: var(--space-3); }
.shelf-book-tile { min-height: 7rem; padding: var(--space-4); border: 1px solid var(--color-rule); border-radius: var(--radius-surface); background: var(--color-paper); text-align: left; }
.shelf-book-tile.is-open { border-color: var(--color-shelf); background: color-mix(in srgb, var(--color-shelf) 7%, var(--color-paper)); }
.shelf-book-title,
.recent-page-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-display); font-weight: 800; }
.shelf-book-meta,
.recent-page-location { display: block; margin-top: var(--space-2); color: var(--color-muted); }
.shelf-book-state,
.recent-page-updated-label { display: block; margin-top: var(--space-3); color: var(--color-shelf); font-size: .8125rem; font-weight: 700; }
.recent-page-card { width: 100%; min-height: 7.375rem; padding: var(--space-4); border: 1px solid var(--color-rule); border-radius: var(--radius-surface); background: var(--color-paper); text-align: left; }
```

Remove the obsolete `.book-spine`, `.book-spine-open`, and vertical-writing rules.

- [ ] **Step 6: Run Shelf layout and context tests**

Run:

```bash
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "horizontal book tiles|recent page cards expose|one open book controls shelf context|root selection labels folder ZIP"
```

Expected: all selected tests PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/components/mdez/ShelfPane.tsx src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "feat: add scannable Shelf tiles"
```

---

### Task 4: Complete Responsive Layout and Regression Verification

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Modify: `src/app/styles/workspace.css`

**Interfaces:**
- Consumes: explorer, popover, Shelf tile, and page-card classes from Tasks 1–3.
- Produces: verified command wrapping, touch targets, and zero-overflow behavior across all supported widths.

- [ ] **Step 1: Add a failing responsive geometry test**

Add:

```ts
test("compact explorer and Shelf commands remain comfortable at key widths", async ({ page }) => {
  for (const width of [390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await showShelfIfAvailable(page);

    const metrics = await page.evaluate(() => {
      const commands = [...document.querySelectorAll<HTMLElement>(".shelf-section-actions button")];
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clippedCommands: commands.filter((button) => button.scrollWidth > button.clientWidth).length
      };
    });

    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.clippedCommands).toBe(0);
  }
});
```

The mutation this catches is an action group, tile, popover trigger, or long label causing clipping or document overflow at a supported breakpoint.

- [ ] **Step 2: Run the responsive test and verify RED**

Run:

```bash
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "compact explorer and Shelf commands remain comfortable"
```

Expected: FAIL until final breakpoint rules replace the removed command-bar grid and size the new controls.

- [ ] **Step 3: Add final breakpoint rules**

Use:

```css
.shelf-section-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.shelf-section-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); }
.shelf-section-actions > button { min-height: 2.5rem; white-space: nowrap; }

@media (max-width: 767px) {
  .shelf-section-header { align-items: stretch; flex-direction: column; }
  .shelf-section-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .shelf-section-actions > button { min-height: 2.75rem; width: 100%; }
  .shelf-book-grid,
  .recent-page-grid { grid-template-columns: minmax(0, 1fr); }
  .sidebar-row-actions-trigger { width: 2.75rem; height: 2.75rem; }
}

@media (max-width: 420px) {
  .shelf-section-actions { grid-template-columns: minmax(0, 1fr); }
}
```

Preserve the existing drawer, scrim, statusbar, and bottom-navigation rules.

- [ ] **Step 4: Update the existing touch-target and overflow suites**

Include `.sidebar-row-actions-trigger`, `.shelf-section-actions button`, `.shelf-book-tile`, and `.recent-page-card` in the current mobile target assertions. Preserve the existing mode-by-width overflow matrix and ensure the new long-book-name test selects its command from main Shelf.

- [ ] **Step 5: Run all targeted sidebar and Shelf tests**

Run:

```bash
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "Shelf owns|quiet explorer|selected mobile explorer|horizontal book tiles|recent page cards|compact explorer and Shelf commands|mobile workspace interactive targets|document overflow"
```

Expected: all selected desktop and mobile tests PASS.

- [ ] **Step 6: Run full automated verification**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
node .claude/skills/impeccable/scripts/detect.mjs --json src/components/mdez src/app
git diff --check
git diff e79f32b -- src/app/styles/tokens.css
```

Expected:

- 159 or more unit tests pass.
- lint and typecheck exit `0`.
- production build completes.
- the full Playwright suite passes in both projects.
- Impeccable reports no new findings; the existing Markdown blockquote `side-tab` warning may remain.
- `git diff --check` produces no output.
- brand-token diff produces no output.

- [ ] **Step 7: Inspect live desktop, tablet, and mobile renders**

Run the local app and inspect Shelf plus the open sidebar/drawer at:

- `1440 × 900`: one-line section headers where space allows, 240px calm explorer, multi-column tiles.
- `768 × 900`: drawer behavior preserved, two-column tiles where they fit, wrapped commands.
- `390 × 844`: one-column tiles, visible selected-row action trigger, 44px targets, no clipping.

Reset the browser viewport and stop the local server after inspection.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "test: verify compact explorer responsiveness"
```

---

## Completion Criteria

- Sidebar reads as a compact navigation explorer without global command cards.
- Every active Shelf command has one visible owner.
- Row management is progressively disclosed through one accessible More actions popover.
- Shelf root and books use horizontal, readable tiles.
- Recent pages communicate title, location, and update time in one card control.
- Existing create, import, export, rename, move, delete, nesting, drawer, editor, reader, split, and persistence flows remain green.
- Brand color tokens are unchanged.
- Automated verification and live viewport inspection are complete.
