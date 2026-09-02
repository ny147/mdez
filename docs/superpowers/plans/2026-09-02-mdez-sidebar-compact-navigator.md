# Mdez Sidebar Compact Navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Mdez sidebar's page cards and exposed management controls with a compact, searchable, accessible Books-and-Pages navigator.

**Architecture:** Keep `FolderTree` and `DocumentList` as separate contextual navigators, derive global title/name search through a pure library function, and isolate book/page disclosures in authored components. `MdezWorkspace` coordinates drawer/search shortcuts and a one-shot `TitleFocusRequest`; persistence remains in the existing library controllers.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, Tailwind CSS 3 plus workspace CSS tokens, Lucide React, Vitest/Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-02-mdez-sidebar-compact-navigator-design.md`

## Global Constraints

- Preserve the contextual Books → selected book → Pages model; do not introduce an ARIA tree.
- Keep visible copy `Pages without a book`; do not rename it to `Unfiled`.
- Keep desktop width `15rem` and drawer width `min(19rem, 86vw)`.
- Search book names and page titles only, locally, with no worker, dependency, persistence, or network request.
- Preserve nested books, Local Library, Key Groups, GitHub source feedback, autosave, Shelf action ownership, and existing delete confirmations.
- Page rows are 48–56px and three rows occupy no more than 168px.
- Small text contrast is at least 4.5:1; focus and component boundaries are at least 3:1.
- Hover-only disclosure is allowed only on fine pointers; touch controls stay visible and at least 44×44px.
- No native page rename prompt remains.
- All motion respects `prefers-reduced-motion` and geometry stays contained from 320–1920px.

---

### Task 1: Pure Sidebar Search

**Files:**
- Create: `src/lib/sidebar-search.ts`
- Create: `tests/unit/sidebar-search.test.ts`

**Interfaces:**
- Consumes: `Folder` and `Document` from `src/types/content.ts`.
- Produces: `normalizeSidebarQuery(value: string): string`, `getBookPath(folders: Folder[], folderId: string): string`, and `searchSidebar(folders: Folder[], documents: Document[], query: string): SidebarSearchResult`.

- [ ] **Step 1: Write the failing pure-function tests**

```ts
import { describe, expect, it } from "vitest";
import { normalizeSidebarQuery, searchSidebar } from "@/lib/sidebar-search";
import type { Document, Folder } from "@/types/content";

const at = "2026-09-02T00:00:00.000Z";
const folders: Folder[] = [
  { id: "writing", name: "Wríting", parentId: null, order: 0, createdAt: at, updatedAt: at },
  { id: "drafts", name: "Drafts", parentId: "writing", order: 0, createdAt: at, updatedAt: at }
];
const documents: Document[] = [
  { id: "old", title: "Alpha notes", body: "ignored", folderId: null, order: 0, createdAt: at, updatedAt: "2026-09-01T00:00:00.000Z" },
  { id: "new", title: "Launch plan", body: "alpha only in body", folderId: "drafts", order: 0, createdAt: at, updatedAt: "2026-09-02T00:00:00.000Z" }
];

describe("sidebar search", () => {
  it("normalizes case, diacritics, and whitespace", () => {
    expect(normalizeSidebarQuery("  WRÍTING   ")).toBe("writing");
  });

  it("groups title and book-name matches without searching bodies", () => {
    const writing = searchSidebar(folders, documents, "writing");
    expect(writing.books.map((result) => result.folder.id)).toEqual(["writing"]);
    expect(writing.pages).toEqual([]);
    const alpha = searchSidebar(folders, documents, "alpha");
    expect(alpha.pages.map((result) => result.document.id)).toEqual(["old"]);
  });

  it("returns paths, counts, recency order, caps, and truncation", () => {
    const result = searchSidebar(folders, documents, "plan");
    expect(result.pages[0]).toMatchObject({ document: { id: "new" }, bookPath: "Wríting / Drafts" });
    expect(result.totalPageMatches).toBe(1);
    expect(result.truncated).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/sidebar-search.test.ts`

Expected: FAIL because `@/lib/sidebar-search` does not exist.

- [ ] **Step 3: Implement deterministic search**

```ts
import type { Document, Folder } from "@/types/content";

export type SidebarSearchResult = {
  books: Array<{ folder: Folder; path: string; directPageCount: number }>;
  pages: Array<{ document: Document; bookPath: string }>;
  totalBookMatches: number;
  totalPageMatches: number;
  truncated: boolean;
};

export function normalizeSidebarQuery(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function getBookPath(folders: Folder[], folderId: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(folderId);
  while (current && !visited.has(current.id)) {
    names.unshift(current.name);
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(" / ");
}
```

Implement `searchSidebar` with empty-result handling, book sorting by path then order, page sorting by descending `updatedAt` then title, 20/50 visible caps, direct-page counts, total counts, and `truncated` when either cap is exceeded. Match only normalized folder names and document titles. Normalize only `query.slice(0, 200)`.

- [ ] **Step 4: Run the focused test**

Run: `npm test -- tests/unit/sidebar-search.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sidebar-search.ts tests/unit/sidebar-search.test.ts
git commit -m "feat: add deterministic sidebar search"
```

---

### Task 2: Compact Book Navigator and Safe Book Actions

**Files:**
- Create: `src/components/mdez/BookActionsMenu.tsx`
- Create: `tests/unit/book-actions-menu.test.tsx`
- Modify: `src/components/mdez/FolderTree.tsx`
- Modify: `src/app/styles/tokens.css`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: existing `onCreateFolder`, `onRenameFolder`, and `onDeleteFolder` callbacks.
- Produces: `BookActionsMenu` with `folder`, `onCreateInside`, `onRename`, and `onDelete` props; compact root/book rows with direct-page counts.

- [ ] **Step 1: Write failing interaction and E2E assertions**

```tsx
render(<BookActionsMenu folder={folder} onCreateInside={create} onRename={rename} onDelete={remove} />);
fireEvent.click(screen.getByRole("button", { name: "Manage Writing" }));
expect(screen.getByRole("menuitem", { name: "Create book inside Writing" })).toBeVisible();
fireEvent.keyDown(screen.getByRole("menu", { name: "Writing actions" }), { key: "Escape" });
expect(screen.getByRole("button", { name: "Manage Writing" })).toHaveFocus();
```

Add Playwright assertions that `Pages without a book` exposes a page count, selected book context has `aria-pressed="true"`, `Delete [book]` is absent until `Manage [book]` opens, and no visible Trash icon button appears at rest.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/unit/book-actions-menu.test.tsx`

Expected: FAIL because `BookActionsMenu` does not exist.

- [ ] **Step 3: Implement the authored Book menu**

Follow `ShelfActionsMenu`'s proven focus model: trigger `aria-haspopup="menu"`, focus first enabled item on open, Arrow Up/Down and Home/End navigation, outside dismissal, Escape focus restoration, item-selection close, and cleanup. Render Create Inside, Rename, and a separated danger-styled Delete item. Do not render a Trash icon trigger.

- [ ] **Step 4: Refactor FolderTree rows**

Use semantic classes rather than card utility chains:

```tsx
<li className="sidebar-book-item">
  <div className="sidebar-book-row" style={{ "--tree-depth": Math.min(depth, 4) } as CSSProperties}>
    {hasChildren ? <button className="sidebar-disclosure" ... /> : <span className="sidebar-disclosure-spacer" />}
    <button className="sidebar-item-select" aria-pressed={isSelected} ...>
      <span className="sidebar-item-title">{folder.name}</span>
      <span className="sidebar-item-count" aria-hidden="true">{pageCount}</span>
    </button>
    <BookActionsMenu ... />
  </div>
</li>
```

Render total book count in the header, a direct root-page count, preserve nested `aria-controls` groups, cap visual indentation at four levels, and retain the current empty-book state.

- [ ] **Step 5: Add the semantic accent token and compact book CSS**

Add `--color-shelf-text: #96355f` in `tokens.css`. Add `.sidebar-section-header`, `.sidebar-book-row`, `.sidebar-item-select`, `.sidebar-item-count`, `.sidebar-item-actions`, selected leading accent/tint/weight, fine-pointer reveal, hoverless 44px targets, long-title truncation, and capped-depth indentation to `workspace.css`. Do not change `--sidebar-w`.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/unit/book-actions-menu.test.tsx`

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "book navigator|nested folders"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/mdez/BookActionsMenu.tsx src/components/mdez/FolderTree.tsx src/app/styles/tokens.css src/app/styles/workspace.css tests/unit/book-actions-menu.test.tsx tests/e2e/mdez.spec.ts
git commit -m "feat: compact sidebar book navigation"
```

---

### Task 3: Compact Page Rows and Authored Page Actions

**Files:**
- Modify: `src/components/mdez/DocumentActions.tsx`
- Modify: `src/components/mdez/DocumentList.tsx`
- Create: `tests/unit/document-actions.test.tsx`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: existing move/delete callbacks and a new navigation-only `onRequestRename(documentId: string)` callback.
- Produces: compact page list rows with `aria-current="page"` and a labelled action popover containing Rename, Move, and Delete.

- [ ] **Step 1: Write failing action-popover tests**

```tsx
render(<DocumentActions document={page} folders={folders} onRename={rename} onMove={move} onDelete={remove} />);
const trigger = screen.getByRole("button", { name: "Manage Notes" });
fireEvent.click(trigger);
expect(screen.getByRole("group", { name: "Manage Notes" })).toBeVisible();
fireEvent.change(screen.getByRole("combobox", { name: "Move Notes page" }), { target: { value: "book-2" } });
expect(move).toHaveBeenCalledWith("book-2");
fireEvent.keyDown(document, { key: "Escape" });
expect(trigger).toHaveFocus();
```

Add E2E assertions that page rows use `role="listitem"`, have `aria-current="page"` only when selected, expose `<time datetime>`, remain no taller than 56px, and hide Rename/Move/Delete until Manage opens.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/unit/document-actions.test.tsx`

Expected: FAIL because the current `<details>` has no labelled group or focus restoration.

- [ ] **Step 3: Replace `<details>` with a controlled popover**

Use trigger `aria-expanded`/`aria-controls`; panel `role="group"` and `aria-label="Manage [title]"`; outside and Escape dismissal; trigger focus restoration; and close after Rename, Move, or Delete invocation. Keep the existing destination select and `Pages without a book` option. Separate Delete visually and do not expose a trash trigger at rest.

- [ ] **Step 4: Replace page cards with one list and compact rows**

```tsx
<ul className="sidebar-page-list" aria-label={`Pages in ${contextName}`}>
  {visibleDocuments.map((document) => (
    <li key={document.id} className="sidebar-page-row">
      <FileText aria-hidden="true" className="sidebar-page-icon" />
      <button aria-current={selectedDocumentId === document.id ? "page" : undefined} className="sidebar-page-select" ...>
        <span className="sidebar-item-title" title={document.title}>{document.title}</span>
        <time dateTime={document.updatedAt} title={absoluteDate}>{`Updated ${formatRelativeTime(document.updatedAt)}`}</time>
      </button>
      <DocumentActions ... />
    </li>
  ))}
</ul>
```

Move the contextual Create Page action into the Pages header, add the direct-page count, retain repository order/title tie-break, and provide `No pages here yet` or `No pages in [book] yet` with `Add first page`.

- [ ] **Step 5: Add compact page CSS**

Add one outer list border, row dividers, 48–56px row sizing, title/time layout, selected leading accent/tint/weight, overflow-trigger reveal, focus-within rules, and hoverless 44px controls. Remove obsolete `.sidebar-create-button`, `.page-actions`, and `.page-title-clamp` rules when no longer referenced.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/unit/document-actions.test.tsx tests/unit/workspace-copy.test.ts`

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "sidebar page rows|compact page rows"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/mdez/DocumentActions.tsx src/components/mdez/DocumentList.tsx src/app/styles/workspace.css tests/unit/document-actions.test.tsx tests/e2e/mdez.spec.ts
git commit -m "feat: replace sidebar page cards with rows"
```

---

### Task 4: Page Title Focus Handoff

**Files:**
- Modify: `src/types/content.ts`
- Modify: `src/hooks/useWorkspaceLibrary.ts`
- Modify: `src/hooks/useKeyGroupLibrary.ts`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/EditorPane.tsx`
- Create: `tests/unit/editor-title-focus.test.tsx`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Produces: exported `TitleFocusRequest = { documentId: string; requestId: number } | null` and both controllers' `createPage(): Promise<Document | null>`.
- Consumes: `DocumentList.onRequestRename(documentId)` from Task 3.

- [ ] **Step 1: Write the failing EditorPane focus test**

```tsx
const { rerender } = render(<EditorPane {...props} titleFocusRequest={null} />);
rerender(<EditorPane {...props} titleFocusRequest={{ documentId: page.id, requestId: 1 }} />);
const title = screen.getByRole("textbox", { name: "Page title" });
expect(title).toHaveFocus();
expect((title as HTMLInputElement).selectionStart).toBe(0);
expect((title as HTMLInputElement).selectionEnd).toBe(page.title.length);
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- tests/unit/editor-title-focus.test.tsx`

Expected: FAIL because EditorPane has no `titleFocusRequest` prop.

- [ ] **Step 3: Return created documents from both controllers**

Change `WorkspaceLibraryController.createPage` to `() => Promise<Document | null>`. Return the new Local document after `loadContent`; in Key Group return `documentView(created)` and return `null` when the group is unavailable.

- [ ] **Step 4: Add one-shot focus coordination**

Add `TitleFocusRequest` to `src/types/content.ts`. In MdezWorkspace keep a monotonically increasing ref and state request. After Create resolves, request title focus for its document. Replace sidebar rename persistence with `handleRequestRenameDocument(documentId)`: select the page, switch to Edit, close the drawer, and request title focus. Normal typing continues through `useDocumentDrafts`; do not call persistence merely to enter rename mode.

In EditorPane, attach `titleInputRef`; when `titleFocusRequest.documentId === document?.id`, run `focus()` and `select()` in an effect keyed by document ID and request ID. Do not infer behavior from `untitled.md`.

- [ ] **Step 5: Add E2E coverage**

Assert Create Page enters Edit with the complete `untitled.md` title selected. Open a page's Manage disclosure, choose Rename Page, and assert the same selected title. Repeat Rename on the same page to prove `requestId` retriggers focus.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/unit/editor-title-focus.test.tsx tests/unit/useWorkspaceLibrary.test.tsx`

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "title focus|Rename page"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/content.ts src/hooks/useWorkspaceLibrary.ts src/hooks/useKeyGroupLibrary.ts src/components/mdez/MdezWorkspace.tsx src/components/mdez/EditorPane.tsx tests/unit/editor-title-focus.test.tsx tests/e2e/mdez.spec.ts
git commit -m "feat: focus page titles after create and rename"
```

---

### Task 5: Sidebar Search UI and Global Shortcut

**Files:**
- Create: `src/components/mdez/SidebarSearch.tsx`
- Create: `tests/unit/sidebar-search-ui.test.tsx`
- Modify: `src/components/mdez/Sidebar.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: `searchSidebar`, folder/page selection callbacks, active `workspaceKey`, and a forwarded search-input ref.
- Produces: persistent search field, grouped result mode, query clearing, and shortcut focus behavior.

- [ ] **Step 1: Write failing UI tests**

```tsx
render(<SidebarSearch folders={folders} documents={documents} query="plan" onQueryChange={setQuery} onSelectFolder={selectFolder} onSelectDocument={selectPage} />);
expect(screen.getByRole("heading", { name: "Pages" })).toBeVisible();
expect(screen.getByRole("button", { name: /Launch plan/ })).toHaveTextContent("Writing / Drafts");
fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
expect(setQuery).toHaveBeenCalledWith("");
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- tests/unit/sidebar-search-ui.test.tsx`

Expected: FAIL because SidebarSearch does not exist.

- [ ] **Step 3: Implement SidebarSearch**

Render a controlled input with maxLength 200, Search icon, conditional clear button, result counts, Books/Pages result lists, path context, truncated-results hint, and quoted no-results message. Results are ordinary buttons/lists, not combobox options. Book selection calls the existing folder callback; page selection calls the existing document callback; both clear query first.

- [ ] **Step 4: Integrate search into Sidebar**

Keep query state in Sidebar and reset it when `workspaceKey` changes. Place the field above the scroll region. When normalized query is empty, render GitHub source feedback, FolderTree, and DocumentList. Otherwise render SidebarSearch result groups. Pass `isReady`; disable search and show `Loading library…` until ready. Ensure an error remains visible without adding a live-region role.

- [ ] **Step 5: Implement guarded global shortcut**

In MdezWorkspace, handle `metaKey || ctrlKey` plus `k` only when the event target is not an input, textarea, select, contenteditable element, CodeMirror editor, dialog, or element with a local keyboard handler. Prevent default, show the desktop sidebar or open the tablet/mobile drawer, then focus the forwarded search ref after layout. Preserve CodeMirror `Mod-k` link insertion by returning early for editor targets.

- [ ] **Step 6: Add search and shortcut E2E coverage**

Cover book/page matching, nested paths, body-only non-match, no results and Clear Search, selected-result navigation, workspace-query reset, desktop collapsed-sidebar focus, mobile drawer opening, and no shortcut theft from Page title/CodeMirror/dialog.

- [ ] **Step 7: Run focused tests**

Run: `npm test -- tests/unit/sidebar-search.test.ts tests/unit/sidebar-search-ui.test.tsx`

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "sidebar search|search shortcut"`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/mdez/SidebarSearch.tsx src/components/mdez/Sidebar.tsx src/components/mdez/MdezWorkspace.tsx src/app/styles/workspace.css tests/unit/sidebar-search-ui.test.tsx tests/e2e/mdez.spec.ts
git commit -m "feat: add searchable sidebar navigation"
```

---

### Task 6: Responsive, Accessibility, and Regression Verification

**Files:**
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: all preceding sidebar components and state contracts.
- Produces: final responsive/focus behavior and regression evidence without changing persistence APIs.

- [ ] **Step 1: Add the final failing regression matrix**

Add Playwright tests at 320, 390, 768, 1024, 1243, 1440, and 1920px that assert no document-level horizontal overflow; sidebar/drawer bounds stay in the viewport; long Thai, RTL, emoji, and unbroken titles do not widen rows; 200% zoom remains operable; touch Manage controls are 44px; reduced motion removes sidebar/action transitions; selected state has leading accent, tint, and increased weight; computed small-text contrast is at least 4.5:1.

- [ ] **Step 2: Run the matrix to expose remaining defects**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "compact sidebar|sidebar search|sidebar geometry"`

Expected: FAIL only on unhandled responsive or accessibility details.

- [ ] **Step 3: Apply one bounded CSS/markup correction batch**

Fix the observed batch in `workspace.css` and affected sidebar markup. Keep the 15rem/19rem widths, do not add hidden document overflow, do not change Shelf/Edit/Read/Split composition, and remove obsolete sidebar rules that have no remaining references.

- [ ] **Step 4: Run focused and full verification**

Run: `npm test`

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run build`

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "compact sidebar|sidebar search|sidebar geometry|desktop sidebar|mobile drawer|nested folders"`

Expected: all commands PASS.

- [ ] **Step 5: Perform bounded visual QA**

Inspect desktop and mobile together with empty, populated, selected, nested, long-title, open-popover, search-results, and no-results states. Fix the complete observed batch once, then confirm once. Do not continue open-ended polishing.

- [ ] **Step 6: Commit**

```bash
git add src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "test: verify compact sidebar experience"
```
