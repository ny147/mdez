# Mdez Workspace UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clarify Mdez's library model, remove duplicated and cramped controls, make phone Split truthful, improve formatting-tool discovery, and bring recovery surfaces into the workspace design language.

**Architecture:** Keep `MdezWorkspace` as the state and operation coordinator. Centralize user-facing workspace terms and relative-time formatting in one small utility, keep responsive Split state inside `SplitWorkspace`, and add focused components for progressive page and formatting actions. Preserve the existing local-first repository, import, export, autosave, and GitHub boundaries.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS plus `src/app/styles/workspace.css`, CodeMirror 6, lucide-react, Vitest, Testing Library, and Playwright.

## Global Constraints

- Preserve IndexedDB persistence, autosave, Markdown rendering, paste/file/GitHub import, nested books, `.md` export, and rooted book `.zip` export.
- Add no dependencies and no global state store.
- Use the visible terms **Library**, **Books**, **Pages without a book**, **Recent pages**, and **Import Markdown** consistently.
- Never show `Shelf root`, `Bookmarked pages`, `Import markdown`, or `Book ZIP` in user-visible copy.
- The Shelf canvas owns global create/import actions and selected-book export. The sidebar owns navigation and item management. Edit owns page export.
- At widths below 768px, Split uses an Edit/Preview switch and renders no resize separator. At 768px and above, Split retains its keyboard and pointer-resizable separator.
- Mobile interactive targets remain at least 44 by 44 CSS pixels.
- Disabled controls must explain their state in visible text; do not rely on hover titles.
- Preserve one `role="status" aria-live="polite"` region for save, import, export, and error feedback.
- Use semantic HTML before ARIA, preserve visible focus, and keep closed or inactive surfaces out of the focus order.
- Do not add gradient text, decorative side stripes, tiny uppercase tracked eyebrows, or centered recovery cards on tinted canvases.
- Keep existing color tokens and typography roles; this plan changes hierarchy and behavior, not the brand palette.

---

## Action Summary

1. `/impeccable clarify`: establish truthful library, import, export, and status copy.
2. `/impeccable distill` and `/impeccable layout`: assign commands one home and simplify page rows.
3. `/impeccable adapt`: replace phone Split with an Edit/Preview switch.
4. `/impeccable shape` and `/impeccable clarify`: progressively disclose formatting actions and add real shortcuts.
5. `/impeccable polish`: align recovery pages, remove the blockquote side stripe, and run the release gate.

## File Responsibility Map

- Create `src/lib/workspace-copy.ts`: canonical visible terms, relative-time formatting, and selected-book export copy.
- Create `tests/unit/workspace-copy.test.ts`: deterministic tests for shared copy helpers.
- Modify `src/components/mdez/MdezWorkspace.tsx`: coordinate operation-success messages, canonical context labels, action ownership, and compact Split.
- Modify `src/components/mdez/ShelfPane.tsx`: render the clarified Library hierarchy, canonical action row, Recent pages, and selected-book export explanation.
- Modify `src/components/mdez/FolderTree.tsx`: label the root-only scope and book creation clearly.
- Modify `src/components/mdez/DocumentList.tsx`: render concise page rows and delegate secondary operations.
- Create `src/components/mdez/DocumentActions.tsx`: progressively disclose Rename, Move, and Delete without an overlay that can be clipped.
- Modify `src/components/mdez/Sidebar.tsx`: remove duplicated top-level Import and Export controls while preserving navigation and contextual source feedback.
- Modify `src/components/mdez/ImportDialog.tsx` and `src/components/mdez/import/*`: clarify import labels, targets, actions, and recovery messages.
- Modify `src/components/mdez/ExportControls.tsx`: make the editor own page export only and report download success.
- Modify `src/components/mdez/WorkspaceStatus.tsx`: remove duplicated Local metadata and expose one trust statement.
- Modify `src/components/mdez/SplitWorkspace.tsx`: own the compact Edit/Preview pane state below 768px.
- Modify `src/components/mdez/EditorToolbar.tsx` and `src/components/mdez/EditorPane.tsx`: separate primary formatting actions from a More panel and add actual Bold, Italic, and Link shortcuts.
- Create `src/components/mdez/RecoveryPage.tsx`: shared quiet recovery layout for error and not-found routes.
- Modify `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/styles/workspace.css`, and `src/app/styles/markdown.css`: style responsive and recovery states without banned patterns.
- Modify `tests/e2e/mdez.spec.ts`: cover terminology, ownership, import, export, sidebar disclosure, compact Split, toolbar disclosure, shortcuts, and recovery routes.
- Create `tests/unit/recovery-pages.test.tsx`: verify recovery copy and actions.

---

### Task 1: Establish Canonical Workspace Language

**Files:**
- Create: `src/lib/workspace-copy.ts`
- Create: `tests/unit/workspace-copy.test.ts`
- Modify: `src/components/mdez/MdezWorkspace.tsx:411-451`
- Modify: `src/components/mdez/ShelfPane.tsx:19-185`
- Modify: `src/components/mdez/FolderTree.tsx:33-67`
- Modify: `src/components/mdez/DocumentList.tsx:33-83,119-134`
- Modify: `tests/e2e/mdez.spec.ts:184-236`

**Interfaces:**
- Consumes: `Folder.name`, `Document.updatedAt`, and the existing `selectedFolderId` state.
- Produces: `WORKSPACE_COPY`, `formatRelativeTime(value: string, now?: number): string`, and `getBookExportCopy(bookName: string | null): { label: string; hint: string; disabled: boolean }`.

- [ ] **Step 1: Write failing unit tests for terminology helpers**

Create `tests/unit/workspace-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { WORKSPACE_COPY, formatRelativeTime, getBookExportCopy } from "@/lib/workspace-copy";

describe("workspace copy", () => {
  it("defines one user-facing vocabulary", () => {
    expect(WORKSPACE_COPY).toMatchObject({
      library: "Library",
      books: "Books",
      pagesWithoutBook: "Pages without a book",
      recentPages: "Recent pages",
      importMarkdown: "Import Markdown"
    });
  });

  it("formats update times without raw timestamps", () => {
    const now = Date.parse("2026-08-08T12:00:00.000Z");
    expect(formatRelativeTime("2026-08-08T11:58:00.000Z", now)).toBe("2 minutes ago");
    expect(formatRelativeTime("2026-08-08T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("not-a-date", now)).toBe("Recently updated");
  });

  it("names the active book in export copy", () => {
    expect(getBookExportCopy(null)).toEqual({
      label: "Export book (.zip)",
      hint: "Open a book to export its Markdown pages and metadata.",
      disabled: true
    });
    expect(getBookExportCopy("Writing")).toEqual({
      label: "Export Writing (.zip)",
      hint: "Downloads the Markdown pages and metadata in Writing.",
      disabled: false
    });
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npm test -- tests/unit/workspace-copy.test.ts`

Expected: FAIL because `@/lib/workspace-copy` does not exist.

- [ ] **Step 3: Implement the shared copy utility**

Create `src/lib/workspace-copy.ts`:

```ts
export const WORKSPACE_COPY = {
  library: "Library",
  books: "Books",
  pagesWithoutBook: "Pages without a book",
  recentPages: "Recent pages",
  importMarkdown: "Import Markdown"
} as const;

export function formatRelativeTime(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Recently updated";

  const minutes = Math.max(1, Math.round((now - timestamp) / 60_000));
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function getBookExportCopy(bookName: string | null) {
  return bookName
    ? {
        label: `Export ${bookName} (.zip)`,
        hint: `Downloads the Markdown pages and metadata in ${bookName}.`,
        disabled: false
      }
    : {
        label: "Export book (.zip)",
        hint: "Open a book to export its Markdown pages and metadata.",
        disabled: true
      };
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npm test -- tests/unit/workspace-copy.test.ts`

Expected: PASS.

- [ ] **Step 5: Add a failing end-to-end terminology test**

Replace the old fresh-workspace and open-book label expectations in `tests/e2e/mdez.spec.ts` with:

```ts
test("library copy explains page and book scope", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
  await openShelfDrawerIfAvailable(page);

  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await expect(sidebar.getByRole("treeitem", { name: "Pages without a book" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Recent pages" })).toBeVisible();
  await expect(page.getByText("No books yet. Create a book to group related pages.").last()).toBeVisible();
  await expect(page.getByText("Shelf root", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Bookmarked pages", { exact: true })).toHaveCount(0);
});

test("an open book explains filtering and export scope", async ({ page }) => {
  await openShelfDrawerIfAvailable(page);
  page.once("dialog", (dialog) => dialog.accept("Writing"));
  await page.getByRole("button", { name: "Create book" }).first().click();
  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await sidebar.getByRole("button", { name: "Create page in Writing", exact: true }).click();
  await showShelfIfAvailable(page);

  await expect(page.getByText("Showing recent pages in Writing. Return to Library to view recent pages from every book.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export Writing (.zip)" })).toBeEnabled();
});
```

- [ ] **Step 6: Run the focused end-to-end tests to verify they fail**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "library copy|open book explains"`

Expected: FAIL on the old `Bookshelf`, `Shelf root`, `Bookmarked pages`, and export labels.

- [ ] **Step 7: Apply the vocabulary across the Shelf and sidebar**

In `MdezWorkspace.tsx`, use `Library` for the no-book context, the `h1`, and the no-page status label. In `FolderTree.tsx`, change the root tree item to `Pages without a book`, change `New book` to `Create book`, and use:

```tsx
<p className="rounded border border-border bg-panel px-3 py-2 text-xs font-semibold leading-5 text-muted">
  No books yet. Create a book to group related pages.
</p>
```

In `ShelfPane.tsx`:

- import `WORKSPACE_COPY`, `formatRelativeTime`, and `getBookExportCopy`;
- remove its private `formatRelativeTime` function;
- render `Recent pages` for the heading and list accessible name;
- use `Pages without a book` as the parent label for root pages;
- render `No pages yet. Create a page or import Markdown to begin.` in the Library empty state;
- render `No pages in this book yet. Create a page or import Markdown here.` in an open empty book;
- render the exact open-book helper from the failing test;
- display `exportCopy.hint` next to the export button so the reason remains available on touch.

In `DocumentList.tsx`, use `Pages without a book` in the move select and `Import Markdown` in the empty-state action. Do not change filtering behavior.

- [ ] **Step 8: Run focused tests and terminology scan**

Run: `npm test -- tests/unit/workspace-copy.test.ts`

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "library copy|open book explains"`

Run: `rg -n "Shelf root|Bookmarked pages|Import markdown|Book ZIP" src`

Expected: unit and E2E tests PASS; `rg` may still find import/export strings in files scheduled for Task 2, but it must find none in `MdezWorkspace.tsx`, `ShelfPane.tsx`, `FolderTree.tsx`, or `DocumentList.tsx`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/workspace-copy.ts tests/unit/workspace-copy.test.ts src/components/mdez/MdezWorkspace.tsx src/components/mdez/ShelfPane.tsx src/components/mdez/FolderTree.tsx src/components/mdez/DocumentList.tsx tests/e2e/mdez.spec.ts
git commit -m "fix: clarify library hierarchy"
```

---

### Task 2: Give Commands One Home and Improve Operation Feedback

**Files:**
- Modify: `src/components/mdez/Sidebar.tsx:1-118`
- Modify: `src/components/mdez/DocumentList.tsx:8-85`
- Modify: `src/components/mdez/ShelfPane.tsx:68-105`
- Modify: `src/components/mdez/ExportControls.tsx:7-86`
- Modify: `src/components/mdez/WorkspaceStatus.tsx:1-26`
- Modify: `src/components/mdez/MdezWorkspace.tsx:128-278,365-456`
- Modify: `src/components/mdez/ImportDialog.tsx:26-323`
- Modify: `src/components/mdez/import/ImportDialogShell.tsx:81-90`
- Modify: `src/components/mdez/import/PasteImportPanel.tsx:26-41`
- Modify: `src/components/mdez/import/FileImportPanel.tsx:43-64`
- Modify: `src/components/mdez/EditorPane.tsx:67-86`
- Modify: `src/components/mdez/PreviewPane.tsx:120-135`
- Modify: `tests/e2e/mdez.spec.ts:184-221,445-560,730-820`

**Interfaces:**
- Consumes: `WORKSPACE_COPY` and `getBookExportCopy` from Task 1.
- Produces: `ExportControlsProps.onSuccess(message: string): void`; Shelf-owned book export; operation status messages `Saved in this browser`, `Saving changes...`, `Imported N pages`, and `Downloaded filename`.

- [ ] **Step 1: Add failing tests for command ownership and clarified import copy**

Add to `tests/e2e/mdez.spec.ts`:

```ts
test("global actions have one visible home", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Import Markdown", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Export book (.zip)", exact: true })).toHaveCount(1);

  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  await expect(sidebar.getByRole("button", { name: "Import Markdown", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: /Export .*\.zip/ })).toHaveCount(0);
});

test("import dialog uses specific labels and recovery copy", async ({ page }) => {
  await page.getByRole("button", { name: "Import Markdown", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add Markdown to your library" });

  await expect(dialog.getByRole("tab", { name: "Paste text" })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Choose files" })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "GitHub repository" })).toBeVisible();
  await expect(dialog.getByLabel("Add pages to")).toHaveValue("");
  await expect(dialog.getByLabel("Add pages to").getByRole("option", { name: "No book" })).toHaveCount(1);

  await dialog.getByRole("button", { name: "Import pasted text" }).click();
  await expect(dialog.getByText("Paste Markdown before importing.")).toBeVisible();
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "one visible home|specific labels and recovery"`

Expected: FAIL because actions are duplicated and the dialog still uses old labels.

- [ ] **Step 3: Remove duplicate sidebar and editor book-export controls**

In `Sidebar.tsx`:

- remove the top Import/Book ZIP action row;
- remove `Download` and `Upload` imports;
- remove the `onExportFolder` prop;
- remove the `onOpenImport` prop and stop passing it to `DocumentList`.

In `DocumentList.tsx`, remove `onOpenImport` and the empty-state Import button. Keep the contextual Create page action. Shelf remains the canonical Library-level import surface; the Edit and Read no-page states retain Import Markdown as a recovery action.

In `ExportControls.tsx`, reduce the public props to:

```ts
type ExportControlsProps = {
  selectedDocument: Document | null;
  onError: (message: string | null) => void;
  onSuccess: (message: string) => void;
};
```

Keep only the page export button. After `downloadBlob`, call:

```ts
const fileName = getDocumentExportName(selectedDocument);
downloadBlob(new Blob([selectedDocument.body], { type: "text/markdown;charset=utf-8" }), fileName);
onError(null);
onSuccess(`Downloaded ${fileName}`);
```

In `MdezWorkspace.tsx`, remove `folders`, `documents`, and `selectedFolderId` from `ExportControls`; pass `onSuccess={(message) => setOperationStatus({ message, state: "saved" })}`. Remove `onExportFolder` and `onOpenImport` from `Sidebar`.

- [ ] **Step 4: Clarify the import dialog and errors**

Change the import source options to:

```ts
const sourceOptions = [
  { value: "paste", label: "Paste text", icon: ClipboardPaste },
  { value: "files", label: "Choose files", icon: FileText },
  { value: "github", label: "GitHub repository", icon: Github }
] satisfies { value: ImportSource; label: string; icon: typeof ClipboardPaste }[];
```

Use the following exact strings:

```ts
"Paste Markdown before importing."
"Choose Markdown files ending in .md or .markdown."
`We could not read ${file.name}. Choose the file again or try another file.`
"We could not import the Markdown. Your existing pages were not changed."
```

In `ImportDialogShell.tsx`, render `Import Markdown` and `Add Markdown to your library`. In `ImportDialog.tsx`, change `Target book` to `Add pages to`, `Shelf root` to `No book`, `Import Paste` to `Import pasted text`, `Importing...` to `Importing Markdown...`, and `Cancel` to `Close import`. Capitalize Markdown in `PasteImportPanel`, `FileImportPanel`, `EditorPane`, and `PreviewPane`.

- [ ] **Step 5: Add explicit import, export, and save feedback**

In `handleImport`, set the operation status after `library.importPages`:

```ts
const count = items.length;
setOperationStatus({
  message: `Imported ${count} ${count === 1 ? "page" : "pages"}`,
  state: "saved"
});
```

After the Shelf book download succeeds, calculate the filename once and set:

```ts
setOperationStatus({ message: `Downloaded ${fileName}`, state: "saved" });
```

Clear stale operation success when a new save starts:

```ts
useEffect(() => {
  if (saveStatus === "Saving...") setOperationStatus(null);
}, [saveStatus]);
```

Map status copy to:

```ts
const statusMessage = library.error
  ?? (saveStatus === "Saving..."
    ? "Saving changes..."
    : operationStatus?.message ?? "Saved in this browser");
```

Remove the top-bar `Local` text. In `WorkspaceStatus.tsx`, remove the `Local` badge, retain `UTF-8`, and change its accessible label to `UTF-8 document`.

- [ ] **Step 6: Update import and export tests to the new labels and feedback**

Mechanically replace old exact labels in `tests/e2e/mdez.spec.ts`, then strengthen the download and persistence assertions:

```ts
await expect(page.getByRole("status").filter({ hasText: "Downloaded export-me.md" })).toBeVisible();
await expect(page.getByRole("status").filter({ hasText: /^Saved in this browser$/ })).toBeVisible({ timeout: 3000 });
```

For successful paste import, assert:

```ts
await expect(page.getByRole("status").filter({ hasText: "Imported 1 page" })).toBeVisible();
```

- [ ] **Step 7: Run focused tests and the visible-copy scan**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "one visible home|specific labels and recovery|imports markdown by paste|exports the selected|persistence|content refresh"`

Run: `rg -n "Shelf root|Bookmarked pages|Import markdown|Book ZIP|Bring notes into Mdez|Import Paste" src`

Expected: focused tests PASS and the scan returns no user-visible legacy strings.

- [ ] **Step 8: Commit**

```bash
git add src/components/mdez/Sidebar.tsx src/components/mdez/DocumentList.tsx src/components/mdez/ShelfPane.tsx src/components/mdez/ExportControls.tsx src/components/mdez/WorkspaceStatus.tsx src/components/mdez/MdezWorkspace.tsx src/components/mdez/ImportDialog.tsx src/components/mdez/import/ImportDialogShell.tsx src/components/mdez/import/PasteImportPanel.tsx src/components/mdez/import/FileImportPanel.tsx src/components/mdez/EditorPane.tsx src/components/mdez/PreviewPane.tsx tests/e2e/mdez.spec.ts
git commit -m "fix: clarify workspace actions and feedback"
```

---

### Task 3: Distill Sidebar Page Management

**Files:**
- Create: `src/components/mdez/DocumentActions.tsx`
- Modify: `src/components/mdez/DocumentList.tsx:1-147`
- Modify: `tests/e2e/mdez.spec.ts:223-239,743-760`

**Interfaces:**
- Consumes: `formatRelativeTime` from Task 1 and the existing rename, move, and delete callbacks.
- Produces: `DocumentActionsProps` with `document`, `folders`, `onRename`, `onMove`, and `onDelete`; one in-flow disclosure per page row.

- [ ] **Step 1: Add a failing end-to-end test for progressive page actions**

Add:

```ts
test("sidebar page rows reveal management actions on demand", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  await showShelfIfAvailable(page);
  await openShelfDrawerIfAvailable(page);

  const sidebar = page.getByRole("complementary", { name: "Library shelf" });
  const pageRow = sidebar.getByRole("article").filter({ hasText: "untitled.md" });
  await expect(pageRow.getByText(/minute ago|Recently updated/)).toBeVisible();
  await expect(pageRow.getByRole("button", { name: "Rename untitled.md" })).toBeHidden();

  await pageRow.getByRole("button", { name: "Manage untitled.md" }).click();
  await expect(pageRow.getByRole("button", { name: "Rename untitled.md" })).toBeVisible();
  await expect(pageRow.getByRole("combobox", { name: "Move untitled.md page" })).toBeVisible();
  await expect(pageRow.getByRole("button", { name: "Delete untitled.md" })).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "reveal management actions"`

Expected: FAIL because page actions are always visible and no Manage control exists.

- [ ] **Step 3: Create the in-flow page action disclosure**

Create `DocumentActions.tsx` using native `<details>` so the controls expand inside the scrolling sidebar rather than being clipped by an absolute menu:

```tsx
"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";

import type { Document, Folder } from "@/types/content";

type DocumentActionsProps = {
  document: Document;
  folders: Folder[];
  onRename: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
};

export function DocumentActions({ document, folders, onRename, onMove, onDelete }: DocumentActionsProps) {
  return (
    <details className="mt-2 rounded border border-border bg-panel">
      <summary
        aria-label={`Manage ${document.title}`}
        className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-muted"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        Manage page
      </summary>
      <div className="grid gap-2 border-t border-border p-2">
        <button type="button" onClick={onRename} aria-label={`Rename ${document.title}`} className="secondary-button px-3 py-2 text-xs">
          Rename page
        </button>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Move page to
          <select
            value={document.folderId ?? ""}
            onChange={(event) => onMove(event.currentTarget.value || null)}
            aria-label={`Move ${document.title} page`}
            className="workspace-input min-w-0 px-2 py-2 text-xs"
          >
            <option value="">Pages without a book</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={onDelete} aria-label={`Delete ${document.title}`} className="secondary-button px-3 py-2 text-xs text-accent-files">
          <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete page
        </button>
      </div>
    </details>
  );
}
```

Sort a copied `folders` array inside the component before mapping so the select retains current order without mutating props.

- [ ] **Step 4: Reduce each document row to recognition information**

In `DocumentList.tsx`:

- import `DocumentActions` and `formatRelativeTime`;
- keep the page-selection button as title plus `Updated ${formatRelativeTime(document.updatedAt)}`;
- remove the permanent Rename button, move select, Delete `IconButton`, and unused `Trash2`/`IconButton` imports;
- render `DocumentActions` below the selection button;
- keep the current prompt-backed rename callback for this task;
- keep Delete confirmation in the library hook unchanged.

- [ ] **Step 5: Run the focused test and existing nested-book flow**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "reveal management actions|creates nested folders|one open book"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/mdez/DocumentActions.tsx src/components/mdez/DocumentList.tsx tests/e2e/mdez.spec.ts
git commit -m "refactor: simplify sidebar page actions"
```

---

### Task 4: Replace Phone Split with an Edit/Preview Switch

**Files:**
- Modify: `src/components/mdez/SplitWorkspace.tsx:1-81`
- Modify: `src/components/mdez/MdezWorkspace.tsx:433-438`
- Modify: `src/app/styles/workspace.css:475-490,584-613,692-730`
- Modify: `tests/e2e/mdez.spec.ts:822-861,877-932`

**Interfaces:**
- Consumes: `isMobileLayout` from `useWorkspaceViewport`.
- Produces: `SplitWorkspaceProps.compact: boolean` and local `CompactPane = "editor" | "reader"` state. The resize separator remains unchanged when `compact` is false.

- [ ] **Step 1: Replace the mobile separator test with a failing compact-pane test**

Replace `mobile split separator resizes from vertical pointer movement` with:

```ts
test("mobile Split switches between editor and preview without a separator", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  await clickViewportModeTab(page, "Split");

  const split = page.locator(".split-workspace");
  const editorPanel = split.locator("#compact-split-editor-panel");
  const previewPanel = split.locator("#compact-split-reader-panel");
  await expect(split.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
  await expect(editorPanel).toBeVisible();
  await expect(previewPanel).toBeHidden();
  await expect(split.getByRole("separator", { name: "Resize editor and reader panes" })).toHaveCount(0);

  await split.getByRole("tab", { name: "Preview" }).click();
  await expect(split.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");
  await expect(previewPanel).toBeVisible();
  await expect(editorPanel).toBeHidden();
  await expect(page.locator(".markdown-preview")).toBeVisible();
});
```

- [ ] **Step 2: Run the mobile Split test to verify it fails**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "mobile Split switches"`

Expected: FAIL because mobile still renders a horizontal separator and both stacked panes.

- [ ] **Step 3: Add compact pane state to `SplitWorkspace`**

Extend the props and branch before the existing resizable markup:

```tsx
type CompactPane = "editor" | "reader";

type SplitWorkspaceProps = {
  editor: ReactNode;
  reader: ReactNode;
  orientation: "horizontal" | "vertical";
  compact: boolean;
};

const compactOptions: { value: CompactPane; label: string }[] = [
  { value: "editor", label: "Edit" },
  { value: "reader", label: "Preview" }
];
```

Inside the component, add `const [compactPane, setCompactPane] = useState<CompactPane>("editor");`. When `compact` is true, return:

```tsx
<div className="split-workspace split-workspace-compact" data-orientation="compact">
  <div role="tablist" aria-label="Split workspace pane" className="compact-split-tabs">
    {compactOptions.map((option) => (
      <button
        key={option.value}
        type="button"
        role="tab"
        id={`compact-split-${option.value}-tab`}
        aria-controls={`compact-split-${option.value}-panel`}
        aria-selected={compactPane === option.value}
        onClick={() => setCompactPane(option.value)}
        className="compact-split-tab"
      >
        {option.label}
      </button>
    ))}
  </div>
  <div
    id="compact-split-editor-panel"
    role="tabpanel"
    aria-label="Edit"
    aria-labelledby="compact-split-editor-tab"
    hidden={compactPane !== "editor"}
    className="min-h-0 min-w-0"
  >
    {editor}
  </div>
  <div
    id="compact-split-reader-panel"
    role="tabpanel"
    aria-label="Preview"
    aria-labelledby="compact-split-reader-tab"
    hidden={compactPane !== "reader"}
    className="min-h-0 min-w-0"
  >
    {reader}
  </div>
</div>
```

Both nodes remain mounted; `hidden` removes the inactive pane from layout and focus without discarding editor state.

- [ ] **Step 4: Pass the mobile breakpoint and style the compact switch**

Pass `compact={isMobileLayout}` from `MdezWorkspace.tsx`.

In `workspace.css`, remove the phone-only 70rem stacked Split requirement and add:

```css
.split-workspace-compact {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
}

.compact-split-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
  margin-bottom: var(--space-2);
  padding: 0.25rem;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-control);
  background: var(--color-panel);
}

.compact-split-tab {
  min-height: 2.75rem;
  border: 1px solid transparent;
  border-radius: calc(var(--radius-control) - 0.125rem);
  background: transparent;
  color: var(--color-muted);
  font-weight: 750;
}

.compact-split-tab[aria-selected="true"] {
  border-color: var(--color-rule);
  background: var(--color-paper);
  color: var(--mode-accent);
}
```

- [ ] **Step 5: Verify phone, tablet, and desktop Split behavior**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "mobile Split switches|split separator resizes|tablet split"`

Expected: phone switch PASS, desktop separator PASS, tablet stacked/resizable behavior PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/mdez/SplitWorkspace.tsx src/components/mdez/MdezWorkspace.tsx src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "fix: adapt split workspace for phones"
```

---

### Task 5: Progressively Disclose Formatting and Add Real Shortcuts

**Files:**
- Modify: `src/components/mdez/EditorToolbar.tsx:1-42`
- Modify: `src/components/mdez/EditorPane.tsx:1-107`
- Modify: `src/app/styles/workspace.css:669-730`
- Modify: `tests/e2e/mdez.spec.ts:240-303`

**Interfaces:**
- Consumes: existing `FormatAction` and `onFormat(action)` behavior.
- Produces: primary actions Bold, Italic, and Insert link; a `More formatting` disclosure for Image, Code, Heading 1, Heading 2, and Divider; actual `Control/Meta+B`, `Control/Meta+I`, and `Control/Meta+K` CodeMirror shortcuts.

- [ ] **Step 1: Replace toolbar visibility tests with progressive-disclosure assertions**

Replace the existing toolbar tests with:

```ts
test("editor keeps primary formatting visible and discloses secondary actions", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  const toolbar = page.getByRole("toolbar", { name: "Markdown toolbar" });

  for (const name of ["Bold", "Italic", "Insert link", "More formatting", "Export .md"]) {
    await expect(toolbar.getByRole("button", { name })).toBeVisible();
  }
  for (const name of ["Insert image", "Code", "Heading 1", "Heading 2", "Divider"]) {
    await expect(toolbar.getByRole("button", { name })).toBeHidden();
  }

  await toolbar.getByRole("button", { name: "More formatting" }).click();
  for (const name of ["Insert image", "Code", "Heading 1", "Heading 2", "Divider"]) {
    await expect(toolbar.getByRole("button", { name })).toBeVisible();
  }
});

test("editor formatting shortcuts apply Markdown", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  const editor = page.locator(".cm-content");
  await editor.fill("Shortcut text");
  await editor.press("Control+A");
  await editor.press("Control+B");
  await expect(editor).toContainText("**Shortcut text**");
});
```

In the existing 390px test, assert `formatStrip.scrollWidth === formatStrip.clientWidth` after More is closed.

- [ ] **Step 2: Run the toolbar tests to verify they fail**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "primary formatting|formatting shortcuts|mobile editor"`

Expected: FAIL because all actions render in one scrolling strip and shortcuts are not registered.

- [ ] **Step 3: Split toolbar actions into primary and secondary groups**

Add `"use client"`, import `useState`, and define:

```ts
type FormatActionConfig = {
  action: FormatAction;
  label: string;
  glyph: string;
  ariaKeyShortcuts?: string;
  shortcutLabel?: string;
};

const primaryActions: FormatActionConfig[] = [
  { action: "bold", label: "Bold", glyph: "B", ariaKeyShortcuts: "Control+B Meta+B", shortcutLabel: "Ctrl/⌘ B" },
  { action: "italic", label: "Italic", glyph: "I", ariaKeyShortcuts: "Control+I Meta+I", shortcutLabel: "Ctrl/⌘ I" },
  { action: "link", label: "Insert link", glyph: "↗", ariaKeyShortcuts: "Control+K Meta+K", shortcutLabel: "Ctrl/⌘ K" }
];

const secondaryActions: FormatActionConfig[] = [
  { action: "image", label: "Insert image", glyph: "▧" },
  { action: "code", label: "Code", glyph: "</>" },
  { action: "h1", label: "Heading 1", glyph: "H1" },
  { action: "h2", label: "Heading 2", glyph: "H2" },
  { action: "divider", label: "Divider", glyph: "---" }
];
```

Render a `More formatting` button with `aria-expanded`, `aria-controls="secondary-format-actions"`, and a visible `More` label. Render the secondary group only when expanded. Each primary button receives `aria-keyshortcuts` and a title containing its shortcut label.

- [ ] **Step 4: Register matching CodeMirror key bindings**

In `EditorPane.tsx`:

- import `keymap` from `@codemirror/view`;
- convert `applyFormat` to `useCallback` with an empty dependency array because it reads only `editorRef`;
- create the shortcut extension with `useMemo`:

```ts
const formattingShortcuts = useMemo(
  () => keymap.of([
    { key: "Mod-b", run: () => { applyFormat("bold"); return true; } },
    { key: "Mod-i", run: () => { applyFormat("italic"); return true; } },
    { key: "Mod-k", run: () => { applyFormat("link"); return true; } }
  ]),
  [applyFormat]
);
```

Pass `extensions={[markdown(), formattingShortcuts]}` to CodeMirror. Do not advertise shortcuts that are not registered.

- [ ] **Step 5: Remove horizontal scrolling from the default toolbar state**

Update `.editor-format-actions` to wrap the three primary actions without overflow. Add `.editor-secondary-actions` as a wrapping row below the primary strip. Keep document actions in their current row and preserve 44px targets under 768px.

- [ ] **Step 6: Run toolbar tests and typecheck**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "primary formatting|formatting shortcuts|mobile editor"`

Run: `npm run typecheck`

Expected: all commands PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/mdez/EditorToolbar.tsx src/components/mdez/EditorPane.tsx src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "feat: improve markdown toolbar discovery"
```

---

### Task 6: Align Recovery Surfaces and Complete the Release Gate

**Files:**
- Create: `src/components/mdez/RecoveryPage.tsx`
- Create: `tests/unit/recovery-pages.test.tsx`
- Modify: `src/app/error.tsx:1-29`
- Modify: `src/app/not-found.tsx:1-18`
- Modify: `src/app/styles/markdown.css:55-68`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: existing app tokens and action nodes supplied by `error.tsx` and `not-found.tsx`.
- Produces: `RecoveryPageProps { title: string; description: ReactNode; action: ReactNode }` and recovery pages without centered cards, uppercase eyebrows, or decorative side stripes.

- [ ] **Step 1: Write failing unit tests for recovery copy and actions**

Create `tests/unit/recovery-pages.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";

describe("recovery pages", () => {
  it("keeps local-library reassurance and retries the failed view", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("failed")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Mdez could not open this view" })).toBeInTheDocument();
    expect(screen.getByText(/local library stays in this browser/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try opening Mdez again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("returns a missing route to the Library", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "This page is not in your Library" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Library" })).toHaveAttribute("href", "/");
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npm test -- tests/unit/recovery-pages.test.tsx`

Expected: FAIL on the old headings and action labels.

- [ ] **Step 3: Create a shared quiet recovery layout**

Create `RecoveryPage.tsx`:

```tsx
import type { ReactNode } from "react";

type RecoveryPageProps = {
  title: string;
  description: ReactNode;
  action: ReactNode;
};

export function RecoveryPage({ title, description, action }: RecoveryPageProps) {
  return (
    <main className="recovery-page text-ink">
      <section className="recovery-content" aria-labelledby="recovery-title">
        <p className="font-display text-base font-bold text-accent-files">Mdez</p>
        <h1 id="recovery-title" className="mt-5 max-w-xl font-display text-3xl font-black leading-tight sm:text-4xl">
          {title}
        </h1>
        <div className="mt-4 max-w-xl text-base leading-7 text-muted">{description}</div>
        <div className="mt-7 flex flex-wrap gap-3">{action}</div>
      </section>
    </main>
  );
}
```

Add CSS that uses a full-height two-column-capable workspace grid, one top rule, no floating card, and no tiny uppercase eyebrow:

```css
.recovery-page {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: clamp(1.5rem, 6vw, 5rem);
  background: var(--color-canvas);
}

.recovery-content {
  width: min(100%, 48rem);
  border-top: 1px solid var(--color-rule);
  padding-top: clamp(2rem, 8vw, 6rem);
}
```

- [ ] **Step 4: Use `RecoveryPage` from both routes**

In `error.tsx`, render:

```tsx
<RecoveryPage
  title="Mdez could not open this view"
  description={<>Your local library stays in this browser. Try opening Mdez again.</>}
  action={<button type="button" className="primary-button px-5 py-3" onClick={reset}>Try opening Mdez again</button>}
/>
```

Append the digest in a separate muted sentence only when it exists. In `not-found.tsx`, render `This page is not in your Library`, explain that the Markdown library remains available, and use `Return to Library`.

- [ ] **Step 5: Replace the Markdown blockquote side stripe**

In `markdown.css`, replace `border-left: 4px solid var(--color-read)` with a full 1px border, a subtle background tint, and balanced padding:

```css
.markdown-preview blockquote {
  margin-inline: 0;
  border: 1px solid color-mix(in srgb, var(--color-read) 32%, var(--color-rule));
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--color-read) 6%, var(--color-paper));
  padding: 0.85rem 1rem;
  color: var(--color-reader-muted);
}
```

- [ ] **Step 6: Run unit tests and the deterministic detector**

Run: `npm test -- tests/unit/recovery-pages.test.tsx tests/unit/workspace-copy.test.ts`

Run: `node C:\Users\Neary\.codex\skills\impeccable\scripts\detect.mjs --json src`

Expected: unit tests PASS. The 4px `markdown.css` side-stripe finding is gone; the detector may retain the known false positive for the 1px structural sidebar divider.

- [ ] **Step 7: Run the full automated release gate**

Run: `npm test`

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run build`

Run: `npm run test:e2e`

Expected: every command exits 0 with no warnings or failing tests.

- [ ] **Step 8: Inspect representative live states**

Start the existing dev server and inspect these states with the browser:

1. 1280x800: Library with no books, an open book, Edit toolbar collapsed and expanded, Read, and resizable Split.
2. 900x1024: drawer, page action disclosure, import dialog, and tablet horizontal Split.
3. 390x844: Library actions, drawer page rows, import dialog, Edit toolbar with no default horizontal overflow, compact Split Edit, and compact Split Preview.
4. `/missing-page`: full-bleed recovery page with visible return action.

For every state, verify no horizontal page overflow, no clipped labels, visible focus, one live status region, and no inactive focus targets.

- [ ] **Step 9: Commit**

```bash
git add src/components/mdez/RecoveryPage.tsx src/app/error.tsx src/app/not-found.tsx src/app/styles/markdown.css src/app/styles/workspace.css tests/unit/recovery-pages.test.tsx tests/e2e/mdez.spec.ts
git commit -m "style: align workspace recovery surfaces"
```

---

## Final Acceptance

- First-time users see Library, Books, Pages without a book, and Recent pages with no `Shelf root` or false bookmark language.
- One selected book visibly controls the recent-page filter and the only book export action.
- Import, book export, and page export each have one canonical location.
- Save, import, and download results use the single workspace status region.
- Sidebar page rows show title and relative time by default; Rename, Move, and Delete appear only after `Manage page` is opened.
- Phone Split switches between Edit and Preview without rendering a separator or requiring a long scroll.
- Tablet and desktop Split retain keyboard and pointer resizing from 30% to 70%.
- Bold, Italic, Link, More formatting, and page export remain immediately visible; secondary formatting actions are progressively disclosed.
- `Control/Meta+B`, `Control/Meta+I`, and `Control/Meta+K` perform the actions advertised by `aria-keyshortcuts`.
- Error and not-found routes use the workspace's quiet full-bleed layout instead of a centered fallback card.
- The blockquote side-stripe detector finding is removed.
- Unit tests, lint, typecheck, production build, full Playwright suite, and desktop/tablet/mobile visual inspection pass.
