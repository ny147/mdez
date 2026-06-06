# Mdez UX Activation and Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved P0/P1 UX pass so fresh and no-document workspaces expose clear create/import actions, reader typography is comfortable, folder ZIP export is explicit, and Root-only folder guidance is calmer.

**Architecture:** Keep behavior in the existing `MdezWorkspace` state owner and pass existing create/import handlers down to presentational panes. Preserve the current repository, export, and IndexedDB logic; this is a UI affordance and CSS pass, not a data model change.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, lucide-react, Playwright.

---

## File Structure

- Modify `tests/e2e/mdez.spec.ts`: add behavior-first Playwright tests for fresh workspace CTAs, no-document recovery actions, Root ZIP disabled state, Root-only folder guidance, and preview typography.
- Modify `src/components/mdez/MdezWorkspace.tsx`: pass `onOpenImport` into `DocumentList` through `Sidebar`; pass `onCreateDocument` and `onOpenImport` into `EditorPane` and `PreviewPane`.
- Modify `src/components/mdez/Sidebar.tsx`: add `canExportSelectedFolder`, replace icon-only ZIP export with a labeled button, and pass import handler to `DocumentList`.
- Modify `src/components/mdez/DocumentList.tsx`: add visible `New document`, add empty-folder create/import actions, and keep the existing document list behavior.
- Modify `src/components/mdez/FolderTree.tsx`: add Root-only folder guidance and visible `New folder` action while preserving nested folder controls.
- Modify `src/components/mdez/EditorPane.tsx`: add no-document create/import actions.
- Modify `src/components/mdez/PreviewPane.tsx`: add no-document create/import actions and a stable class for preview-only measure.
- Modify `src/app/globals.css`: switch Markdown preview prose to Geist/system sans, keep code/pre monospaced, and add preview measure constraints.

---

### Task 1: Add Failing Playwright Coverage For Activation And Export Clarity

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append these tests after `showFilesIfAvailable` and before the existing import tests:

```ts
test("fresh workspace exposes visible create and import actions", async ({ page }) => {
  await expect(page.getByRole("button", { name: "New document" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create document" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import markdown" })).toBeVisible();
  await expect(page.getByText("Create folders when this library grows.")).toBeVisible();
  await expect(page.getByRole("button", { name: "New folder" })).toBeVisible();

  await page.getByRole("button", { name: "New document" }).click();

  await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue("Untitled Document");
});

test("no-document editor and reader states expose recovery actions", async ({ page }) => {
  await expect(page.getByText("No document selected")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Editor" }).getByRole("button", { name: "Create document" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Editor" }).getByRole("button", { name: "Import markdown" })).toBeVisible();

  await page.getByRole("button", { name: "Read" }).click();

  const reader = page.locator("article").filter({ hasText: "Reader" });
  await expect(reader.getByRole("button", { name: "Create document" })).toBeVisible();
  await expect(reader.getByRole("button", { name: "Import markdown" })).toBeVisible();
});

test("root selection labels folder ZIP export but keeps it disabled", async ({ page }) => {
  const sidebarZipButton = page.getByRole("button", { name: "Folder ZIP" }).first();

  await expect(sidebarZipButton).toBeVisible();
  await expect(sidebarZipButton).toBeDisabled();
});
```

Add this typography test after `imports markdown by paste and previews it`:

```ts
test("preview prose uses reader typography while markdown code stays monospaced", async ({ page }) => {
  await page.getByRole("button", { name: "Import" }).click();
  await page.getByLabel("Paste markdown").fill("# Typography\n\nReadable prose with `inlineCode`.\n\n```ts\nconst value = 1;\n```");
  await page.getByRole("button", { name: "Import Paste" }).click();
  await page.getByRole("button", { name: "Read" }).click();

  const preview = page.locator(".markdown-preview");
  const paragraph = preview.getByText("Readable prose with", { exact: false });
  const inlineCode = preview.locator("p code");
  const blockCode = preview.locator("pre code");

  const paragraphFamily = await paragraph.evaluate((node) => getComputedStyle(node).fontFamily);
  const inlineCodeFamily = await inlineCode.evaluate((node) => getComputedStyle(node).fontFamily);
  const blockCodeFamily = await blockCode.evaluate((node) => getComputedStyle(node).fontFamily);

  expect(paragraphFamily).not.toMatch(/JetBrains|Consolas|monospace/i);
  expect(inlineCodeFamily).toMatch(/JetBrains|Consolas|monospace/i);
  expect(blockCodeFamily).toMatch(/JetBrains|Consolas|monospace/i);
  await expect(page.locator(".markdown-preview")).toHaveCSS("max-width", "75ch");
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "fresh workspace exposes visible create and import actions|no-document editor and reader states expose recovery actions|root selection labels folder ZIP export but keeps it disabled|preview prose uses reader typography"
```

Expected: FAIL because `New document`, no-document recovery buttons, disabled sidebar `Folder ZIP`, Root-only copy, and preview sans typography do not exist yet.

- [ ] **Step 3: Commit the failing tests only if the team wants red-test commits**

Preferred for this repo: do not commit the failing state. Keep the failing tests in the working tree and continue to Task 2.

---

### Task 2: Wire Existing Create And Import Handlers Through The Component Tree

**Files:**
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/Sidebar.tsx`
- Modify: `src/components/mdez/DocumentList.tsx`
- Modify: `src/components/mdez/EditorPane.tsx`
- Modify: `src/components/mdez/PreviewPane.tsx`

- [ ] **Step 1: Extend prop types**

In `src/components/mdez/DocumentList.tsx`, add the import callback to `DocumentListProps`:

```ts
  onCreateDocument: () => void;
  onOpenImport: () => void;
  onRenameDocument: (documentId: string, title: string) => void;
```

In the `DocumentList` parameter list, destructure it:

```ts
  onCreateDocument,
  onOpenImport,
  onRenameDocument,
```

In `src/components/mdez/EditorPane.tsx`, add callbacks to `EditorPaneProps`:

```ts
  onCreateDocument: () => void;
  onOpenImport: () => void;
  onViewModeChange: (viewMode: ViewMode) => void;
```

Destructure them from `EditorPane`:

```ts
  onCreateDocument,
  onOpenImport,
  onViewModeChange,
```

In `src/components/mdez/PreviewPane.tsx`, add callbacks to `PreviewPaneProps`:

```ts
  onCreateDocument: () => void;
  onOpenImport: () => void;
```

Destructure them from `PreviewPane`:

```ts
export function PreviewPane({ document, title, body, previewOnly, onCreateDocument, onOpenImport }: PreviewPaneProps) {
```

- [ ] **Step 2: Pass callbacks from `MdezWorkspace`**

In `src/components/mdez/MdezWorkspace.tsx`, update the `EditorPane` usage:

```tsx
                  <EditorPane
                    document={selectedDocument}
                    title={draftTitle}
                    body={draftBody}
                    saveStatus={saveStatus}
                    viewMode={viewMode}
                    rightSlot={
                      <ExportControls
                        folders={folders}
                        documents={liveDocuments}
                        selectedDocument={liveSelectedDocument}
                        selectedFolderId={selectedFolderId}
                        onError={setError}
                      />
                    }
                    onCreateDocument={handleCreateDocument}
                    onOpenImport={() => {
                      setIsImportOpen(true);
                    }}
                    onViewModeChange={setViewMode}
                    onBodyChange={handleDraftBodyChange}
                    onRename={handleDraftTitleChange}
                  />
```

Update the `PreviewPane` usage:

```tsx
                  <PreviewPane
                    document={selectedDocument}
                    title={draftTitle}
                    body={draftBody}
                    previewOnly={viewMode === "preview"}
                    onCreateDocument={handleCreateDocument}
                    onOpenImport={() => {
                      setIsImportOpen(true);
                    }}
                  />
```

In `src/components/mdez/Sidebar.tsx`, pass import to `DocumentList`:

```tsx
                onCreateDocument={onCreateDocument}
                onOpenImport={onOpenImport}
                onRenameDocument={onRenameDocument}
```

- [ ] **Step 3: Run typecheck to verify only expected UI gaps remain**

Run:

```bash
npm run typecheck
```

Expected: PASS. If TypeScript fails, fix prop typing before adding markup.

---

### Task 3: Implement Files Tab Activation CTAs

**Files:**
- Modify: `src/components/mdez/DocumentList.tsx`
- Modify: `src/components/mdez/FolderTree.tsx`
- Modify: `src/components/mdez/Sidebar.tsx`

- [ ] **Step 1: Replace the icon-only create affordance with a visible document button**

In `src/components/mdez/DocumentList.tsx`, replace the heading action block:

```tsx
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-black text-ink">Documents</h3>
        <button
          type="button"
          onClick={onCreateDocument}
          className="holo-button min-h-9 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-holo-blue"
        >
          <FilePlus aria-hidden="true" className="h-4 w-4" />
          New document
        </button>
      </div>
```

- [ ] **Step 2: Add empty document list actions**

Replace the existing empty paragraph with:

```tsx
        <div className="rounded border border-markdown-gray/15 bg-deep-void/35 p-3">
          <p className="text-sm font-semibold leading-6 text-ink-muted">
            Create a document in {selectedFolderId ? "this folder" : "Root"} or import markdown here.
          </p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={onCreateDocument}
              className="holo-button w-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-holo-blue"
            >
              <FilePlus aria-hidden="true" className="h-4 w-4" />
              Create document
            </button>
            <button
              type="button"
              onClick={onOpenImport}
              className="holo-ghost-button w-full px-3 py-2 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-holo-blue"
            >
              Import markdown
            </button>
          </div>
        </div>
```

- [ ] **Step 3: Add Root-only folder guidance**

In `src/components/mdez/FolderTree.tsx`, replace the section heading action with:

```tsx
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-black text-ink">Folders</h3>
        <button
          type="button"
          onClick={() => onCreateFolder(null)}
          className="holo-ghost-button inline-flex min-h-9 items-center justify-center gap-2 px-3 py-1.5 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-holo-blue"
        >
          <FolderPlus aria-hidden="true" className="h-4 w-4" />
          New folder
        </button>
      </div>
```

After the Root button and before `tree.map`, add:

```tsx
        {tree.length === 0 ? (
          <p className="rounded border border-markdown-gray/15 bg-deep-void/25 px-3 py-2 text-xs font-semibold leading-5 text-ink-muted">
            Create folders when this library grows.
          </p>
        ) : null}
```

- [ ] **Step 4: Add labeled disabled sidebar ZIP export**

In `src/components/mdez/Sidebar.tsx`, remove the `IconButton` import if it is no longer used:

```ts
import { Download, Upload } from "lucide-react";
```

Inside `Sidebar`, before `return`, add:

```ts
  const canExportSelectedFolder = selectedFolderId !== null;
```

Replace the export `IconButton` with:

```tsx
          <button
            type="button"
            onClick={onExportFolder}
            disabled={!canExportSelectedFolder}
            className="holo-ghost-button inline-flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:border-markdown-gray/15 disabled:bg-deep-void/25 disabled:text-ink-muted/60 disabled:hover:bg-deep-void/25 disabled:hover:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-holo-blue"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Folder ZIP
          </button>
```

- [ ] **Step 5: Run the activation/export tests**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "fresh workspace exposes visible create and import actions|root selection labels folder ZIP export but keeps it disabled"
```

Expected: PASS for these two tests.

---

### Task 4: Implement No-Document Editor And Reader Recovery Actions

**Files:**
- Modify: `src/components/mdez/EditorPane.tsx`
- Modify: `src/components/mdez/PreviewPane.tsx`

- [ ] **Step 1: Add editor empty-state actions**

In `src/components/mdez/EditorPane.tsx`, replace the no-document empty content inside `max-w-sm` with:

```tsx
          <div className="max-w-sm">
            <p className="font-display text-lg font-black text-ink">Choose a document or start a new draft.</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink-muted">
              Create a local markdown file or import existing notes into the selected folder.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCreateDocument}
                className="holo-button px-3 py-2 focus:outline-none focus:ring-2 focus:ring-holo-blue"
              >
                Create document
              </button>
              <button
                type="button"
                onClick={onOpenImport}
                className="holo-ghost-button px-3 py-2 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-holo-blue"
              >
                Import markdown
              </button>
            </div>
          </div>
```

- [ ] **Step 2: Add reader empty-state actions**

In `src/components/mdez/PreviewPane.tsx`, replace the fallback paragraph:

```tsx
            <div className="rounded border border-dashed border-[#8fb9c8] bg-white/55 p-5 text-center">
              <p className="font-display text-lg font-black text-deep-void">Preview a document or start one here.</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#42545b]">
                The reader will render markdown as soon as a document is selected.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onCreateDocument}
                  className="holo-button px-3 py-2 focus:outline-none focus:ring-2 focus:ring-holo-blue"
                >
                  Create document
                </button>
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="rounded border border-[#006689]/35 bg-white px-3 py-2 text-sm font-extrabold text-[#004c68] transition hover:border-[#006689] hover:bg-[#e7fbff] focus:outline-none focus:ring-2 focus:ring-holo-blue"
                >
                  Import markdown
                </button>
              </div>
            </div>
```

- [ ] **Step 3: Run no-document recovery test**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "no-document editor and reader states expose recovery actions"
```

Expected: PASS.

---

### Task 5: Implement Preview Typography And Measure

**Files:**
- Modify: `src/components/mdez/PreviewPane.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add a preview-only measure class**

In `src/components/mdez/PreviewPane.tsx`, update the rendered markdown wrapper:

```tsx
        <div className={`markdown-preview min-w-0 ${previewOnly ? "markdown-preview-readable" : ""}`}>
```

- [ ] **Step 2: Change prose font and preserve code font**

In `src/app/globals.css`, replace the `.markdown-preview` block with:

```css
.markdown-preview {
  color: #17252b;
  font-family: var(--font-geist), Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.75;
}

.markdown-preview-readable {
  max-width: 75ch;
}
```

Update `.markdown-preview code`:

```css
.markdown-preview code {
  border-radius: 0.25rem;
  background: #e7fbff;
  padding: 0.1rem 0.35rem;
  font-family: var(--font-jetbrains-mono), Consolas, monospace;
}
```

Update `.markdown-preview pre`:

```css
.markdown-preview pre {
  overflow-x: auto;
  max-width: 100%;
  border-radius: 0.375rem;
  background: #001429;
  padding: 1rem;
  color: #f8fbff;
  font-family: var(--font-jetbrains-mono), Consolas, monospace;
}
```

Keep `.markdown-preview pre code` as:

```css
.markdown-preview pre code {
  background: transparent;
  padding: 0;
  font-family: inherit;
}
```

- [ ] **Step 3: Run preview typography test**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "preview prose uses reader typography while markdown code stays monospaced"
```

Expected: PASS.

---

### Task 6: Run Full Verification And Commit

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full e2e suite**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts
```

Expected: PASS for all tests in `tests/e2e/mdez.spec.ts`.

- [ ] **Step 2: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with zero warnings.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Review git diff**

Run:

```bash
git diff -- tests/e2e/mdez.spec.ts src/components/mdez/MdezWorkspace.tsx src/components/mdez/Sidebar.tsx src/components/mdez/DocumentList.tsx src/components/mdez/FolderTree.tsx src/components/mdez/EditorPane.tsx src/components/mdez/PreviewPane.tsx src/app/globals.css
```

Expected: diff only contains the approved UX activation, export clarity, and preview typography changes.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/e2e/mdez.spec.ts src/components/mdez/MdezWorkspace.tsx src/components/mdez/Sidebar.tsx src/components/mdez/DocumentList.tsx src/components/mdez/FolderTree.tsx src/components/mdez/EditorPane.tsx src/components/mdez/PreviewPane.tsx src/app/globals.css docs/superpowers/plans/2026-06-06-mdez-ux-activation-readability.md
git commit -m "feat: improve mdez activation and reader ux"
```

Expected: commit succeeds.

---

## Self-Review Notes

- Spec coverage: tasks cover visible document creation, empty-state actions, reader typography, labeled/disabled folder ZIP export, Root-only folder guidance, and no new export formats.
- Scope control: desktop resizable split, PDF/HTML export, zoom controls, sidebar collapse, and broad visual restyling are excluded.
- TDD order: Task 1 writes failing Playwright tests before component or CSS changes.
