# Mdez Shelf Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize Shelf layout and mobile hierarchy, replace native book prompts, clarify shelf content, and add a complete non-destructive workspace backup-and-restore flow.

**Architecture:** Keep `MdezWorkspace` as the coordinator and preserve the current Local Library/Key Group controller boundary. Add focused UI components for the Shelf action menu, book dialog, and storage trust; keep archive generation/parsing in a pure library module and perform restore through one IndexedDB transaction. Phase 2 search and unified-tree work is explicitly excluded from this plan.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind plus semantic CSS, Dexie, JSZip, Vitest, Testing Library, and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-mdez-shelf-improvements-design.md`

## Global Constraints

- Preserve the existing quiet pastel library identity and the `Shelf`, `Edit`, `Read`, `Split` mode contract.
- Preserve Local Library, Key Group, GitHub import/refresh, Shared Links, autosave, page `.md` export, and contextual book ZIP behavior.
- No new runtime dependency, backend endpoint, Dexie schema migration, production File System Access API, tags, stats, SEO route, or Phase 2 search/tree work.
- Workspace backup is versioned `.mdez.zip`; restore always creates new Local Library records and never overwrites or writes into a Key Group.
- All persistent status messages reuse the existing single polite live region.
- Text contrast remains at least 4.5:1, UI-component contrast at least 3:1, mobile targets at least 44×44px, and motion respects `prefers-reduced-motion`.
- Verify document geometry at 320, 390, 414, 768, 1024, 1243, 1280, 1440, and 1920 pixels.
- Do not modify or stage unrelated `.claude/`, `.codex/`, or existing `.impeccable/` files.

## File Responsibility Map

- Modify `src/app/styles/workspace.css`: shell width/grid, persistent mobile rows, Shelf responsive layout, menu/dialog/trust/rail states.
- Modify `src/components/mdez/MdezWorkspace.tsx`: coordinate action menu callbacks, book-dialog intent, workspace backup/restore, and status messages.
- Modify `src/components/mdez/ShelfPane.tsx`: compose the new action hierarchy, storage trust, clarified spines, empty-book action, and recent cards.
- Create `src/components/mdez/ShelfActionsMenu.tsx`: accessible secondary-action menu.
- Create `src/components/mdez/BookDialog.tsx`: create/rename UI with inline validation.
- Create `src/components/mdez/StorageTrust.tsx`: storage mode, backup recency, backup action, and explainer.
- Modify `src/components/mdez/FolderTree.tsx`: open book-dialog intents instead of native rename/create flows; remove unsupported expanded semantics from decorative Shelf spines only.
- Modify `src/hooks/useWorkspaceLibrary.ts`: accept validated book names from UI and expose a restore refresh path without owning dialog state.
- Modify `src/lib/repository.ts`: enforce book-name invariants and atomically restore prepared Local Library records.
- Create `src/lib/book-names.ts`: pure book-name normalization and validation.
- Create `src/types/backup.ts`: versioned backup, parsed archive, preview, and restore-result types.
- Create `src/lib/workspace-backup.ts`: pure archive creation, validation, parsing, and restore planning.
- Create `src/lib/backup-recency.ts`: versioned per-workspace local backup-recency storage.
- Modify `src/components/mdez/ImportDialog.tsx`: add Restore Backup source and orchestration.
- Create `src/components/mdez/import/BackupImportPanel.tsx`: choose, validate, preview, and confirm `.mdez.zip` restore.
- Add/modify unit tests under `tests/unit/` for book names, backup archive, restore transaction, recency, and UI contracts.
- Modify `tests/e2e/mdez.spec.ts`: geometry, responsive actions, dialogs, trust, archive/restore, and accessibility coverage.

---

### Task 1: Defend Shell Geometry and Mobile Persistent Rows

**Files:**
- Modify: `src/app/styles/workspace.css`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: existing `.workspace-shell`, `.workspace-content`, `.workspace-main`, `.workspace-status`, and `.mobile-mode-nav` selectors.
- Produces: a containing-block-sized shell and non-overlapping grid rows used by every later task.

- [ ] **Step 1: Add the failing multi-width containment test**

Add this helper and test matrix to `tests/e2e/mdez.spec.ts`:

```ts
async function expectNoHorizontalOverflow(page: Page) {
  const evidence = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && rect.width > 0 && rect.right > clientWidth + 1;
      })
      .map((element) => ({ selector: element.className, right: element.getBoundingClientRect().right }));
    return { clientWidth, scrollWidth: document.documentElement.scrollWidth, offenders };
  });
  expect(evidence.scrollWidth).toBe(evidence.clientWidth);
  expect(evidence.offenders).toEqual([]);
}

for (const width of [320, 390, 414, 768, 1024, 1243, 1280, 1440, 1920]) {
  test(`Shelf contains every visible element at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
  });
}
```

- [ ] **Step 2: Add the failing mobile-row overlap test**

```ts
test("mobile status and mode navigation occupy separate shell rows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const rectangles = await page.evaluate(() => {
    const main = document.querySelector("main")!.getBoundingClientRect();
    const status = document.querySelector('footer[aria-label="Workspace status"]')!.getBoundingClientRect();
    const nav = document.querySelector('.mobile-mode-nav')!.getBoundingClientRect();
    return { mainBottom: main.bottom, statusTop: status.top, statusBottom: status.bottom, navTop: nav.top };
  });
  expect(rectangles.mainBottom).toBeLessThanOrEqual(rectangles.statusTop + 1);
  expect(rectangles.statusBottom).toBeLessThanOrEqual(rectangles.navTop + 1);
});
```

- [ ] **Step 3: Run the focused tests and confirm the 1243px or mobile-row assertion fails**

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "contains every visible element|separate shell rows"`

Expected: FAIL against the current `width: 100vw` and fixed mobile chrome.

- [ ] **Step 4: Implement the shell grid contract**

Change the shell to containing-block sizing and mobile grid rows:

```css
.workspace-shell {
  display: grid;
  grid-template-rows: var(--topbar-h) minmax(0, 1fr) var(--status-h);
  width: 100%;
  max-width: 100%;
  height: 100dvh;
  overflow: hidden;
}

@media (max-width: 767px) {
  .workspace-shell {
    grid-template-rows:
      var(--topbar-h)
      minmax(0, 1fr)
      var(--status-h)
      calc(3.25rem + env(safe-area-inset-bottom));
  }
  .workspace-status,
  .mobile-mode-nav {
    position: relative;
    inset: auto;
    height: auto;
  }
  .mobile-mode-nav {
    padding-bottom: max(0.25rem, env(safe-area-inset-bottom));
  }
}
```

Remove the mobile fixed positioning and update sidebar/scrim bottom geometry to use the content row instead of fixed pixel subtraction. Add `aria-label="Workspace toolbar"` to the topbar header.

- [ ] **Step 5: Run the focused tests**

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "contains every visible element|separate shell rows"`

Expected: PASS at all nine widths.

- [ ] **Step 6: Run existing shell regressions**

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "workspace polish|desktop sidebar|mobile drawer|interactive targets|without document overflow"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/styles/workspace.css src/components/mdez/MdezWorkspace.tsx tests/e2e/mdez.spec.ts
git commit -m "fix: contain workspace shell geometry"
```

---

### Task 2: Build the Shelf Action Hierarchy and Accessible More Menu

**Files:**
- Create: `src/components/mdez/ShelfActionsMenu.tsx`
- Modify: `src/components/mdez/ShelfPane.tsx`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: `getBookExportCopy`, current Shelf callbacks, existing primary/secondary button classes.
- Produces:

```ts
type ShelfActionsMenuProps = {
  bookExportLabel: string;
  bookExportDescription: string;
  bookExportDisabled: boolean;
  onCreateBook: () => void;
  onImportMarkdown: () => void;
  onExportBook: () => void;
  onBackupWorkspace: () => void;
};
```

- [ ] **Step 1: Add failing responsive hierarchy assertions**

```ts
test("Shelf progressively discloses secondary actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Create page", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create book", exact: true })).toBeHidden();
  const more = page.getByRole("button", { name: "More Shelf actions" });
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menuitem", { name: /Create book/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Import Markdown/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(more).toBeFocused();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "progressively discloses secondary actions"`

Expected: FAIL because all four actions are visible and no menu exists.

- [ ] **Step 3: Implement `ShelfActionsMenu`**

Use local `open` state, a trigger ref, a menu ref, and document listeners active only while open. Implement Escape/outside/item dismissal, focus restoration, Arrow Up/Down, Home/End, and Enter/Space over menu items. Render visible title and description spans for each menu item. `Create book` is menu-only below 768px and remains a visible secondary button above 768px.

The menu order is:

1. Create book — `Add a new book to the root shelf.`
2. Import Markdown — `Add files, pasted text, or a public GitHub repository.`
3. Contextual book ZIP — existing label and hint.
4. Download workspace backup — `Create a restorable copy of this workspace.`

- [ ] **Step 4: Wire the menu through `ShelfPane`**

Add `onBackupWorkspace: () => void` to `ShelfPaneProps`. Keep Create Page as the only primary action. Remove the standalone helper paragraph because its content now belongs to the book-export menu item.

- [ ] **Step 5: Run the focused test**

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "progressively discloses secondary actions"`

Expected: PASS.

- [ ] **Step 6: Add and run keyboard-menu coverage**

Add assertions that ArrowDown changes focus, End focuses the final menu item, outside click closes the menu, and selecting Import closes before the import dialog appears.

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "Shelf action menu"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/mdez/ShelfActionsMenu.tsx src/components/mdez/ShelfPane.tsx src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "feat: clarify Shelf action hierarchy"
```

---

### Task 3: Replace Native Book Prompts with an Authored Dialog

**Files:**
- Create: `src/lib/book-names.ts`
- Create: `src/components/mdez/BookDialog.tsx`
- Create: `tests/unit/book-names.test.ts`
- Create: `tests/unit/book-dialog.test.tsx`
- Modify: `src/lib/repository.ts`
- Modify: `src/hooks/useWorkspaceLibrary.ts`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/FolderTree.tsx`
- Modify: `src/components/mdez/ShelfPane.tsx`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Produces:

```ts
export const MAX_BOOK_NAME_LENGTH = 120;
export function normalizeBookName(value: string): string;
export function validateBookName(
  value: string,
  folders: Folder[],
  parentId: string | null,
  excludeFolderId?: string
): string | null;

export type BookDialogIntent =
  | { mode: "create"; parentId: string | null; parentName: string | null }
  | { mode: "rename"; folderId: string; parentId: string | null; currentName: string };
```

- Controller signatures become:

```ts
createBook: (parentId: string | null, name: string) => Promise<Folder>;
renameBook: (folderId: string, name: string) => Promise<Folder>;
```

- [ ] **Step 1: Write pure validation tests**

```ts
function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "folder-1",
    name: "Book",
    parentId: null,
    order: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides
  };
}

it("trims valid book names", () => {
  expect(normalizeBookName("  Research  ")).toBe("Research");
});

it.each(["", "   "])("rejects empty name %j", (name) => {
  expect(validateBookName(name, [], null)).toBe("Enter a book name.");
});

it("rejects a case-insensitive sibling duplicate", () => {
  expect(validateBookName("research", [folder({ id: "a", name: "Research", parentId: null })], null))
    .toBe("A book named Research already exists here.");
});
```

- [ ] **Step 2: Run the unit test and verify it fails**

Run: `cmd /c npm test -- tests/unit/book-names.test.ts`

Expected: FAIL because `book-names.ts` does not exist.

- [ ] **Step 3: Implement validation and repository enforcement**

`normalizeBookName` returns `value.trim()`. `validateBookName` returns the exact empty, length, or duplicate message, otherwise `null`. Inside `createFolder` and `renameFolder`, load sibling folders in the existing Dexie transaction, call the same validator, and throw `new Error(message)` before writing.

Update the controller methods to return the created/renamed `Folder`. On failure set the existing workspace error and rethrow the original `Error` so `BookDialog` can preserve its input and show the specific validation or repository message.

- [ ] **Step 4: Run validation tests**

Run: `cmd /c npm test -- tests/unit/book-names.test.ts tests/unit/repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing dialog interaction test**

```tsx
it("preserves input and reports duplicate sibling names", async () => {
  render(<BookDialog intent={{ mode: "create", parentId: null, parentName: null }} folders={[folder({ name: "Research" })]} busy={false} onClose={onClose} onSubmit={onSubmit} />);
  const input = screen.getByRole("textbox", { name: "Book name" });
  fireEvent.change(input, { target: { value: "research" } });
  fireEvent.click(screen.getByRole("button", { name: "Create book" }));
  expect(screen.getByRole("alert")).toHaveTextContent("A book named Research already exists here.");
  expect(input).toHaveValue("research");
  expect(onSubmit).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Implement `BookDialog` using `ModalDialog`**

The dialog owns input and validation-message state. It receives `busy`, disables dismissal during submission, uses `data-autofocus` on the field, and calls `onSubmit(normalizedName)`. On an async rejection it shows the thrown message and preserves input. Button labels are `Create book` or `Save name`.

- [ ] **Step 7: Move dialog intent to `MdezWorkspace`**

Replace direct `library.createBook` and `library.renameBook` callbacks with intent setters. On submit, call the revised controller method, close on success, and leave the dialog open on failure. `FolderTree` receives `onRequestCreateFolder(parentId)` and `onRequestRenameFolder(folder)`; remove its `window.prompt` code.

- [ ] **Step 8: Add the empty-book action**

In `ShelfPane`, when the open book has zero direct pages, render a visible `Add first page to [book]` button inside the empty state and call the existing Create Page callback.

- [ ] **Step 9: Run focused unit and E2E tests**

Run: `cmd /c npm test -- tests/unit/book-names.test.ts tests/unit/book-dialog.test.tsx tests/unit/repository.test.ts`

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "book dialog|Add first page"`

Expected: PASS with no native prompt event.

- [ ] **Step 10: Commit**

```bash
git add src/lib/book-names.ts src/components/mdez/BookDialog.tsx src/lib/repository.ts src/hooks/useWorkspaceLibrary.ts src/components/mdez/MdezWorkspace.tsx src/components/mdez/FolderTree.tsx src/components/mdez/ShelfPane.tsx tests/unit/book-names.test.ts tests/unit/book-dialog.test.tsx tests/unit/repository.test.ts tests/e2e/mdez.spec.ts
git commit -m "feat: add authored book management dialog"
```

---

### Task 4: Clarify Book Spines, Rail Overflow, and Recent Pages

**Files:**
- Modify: `src/components/mdez/ShelfPane.tsx`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: current `Folder`, `Document`, `formatRelativeTime`, and Shelf selection callbacks.
- Produces: exact count labels, full-value captions, semantic timestamps, intentional overflow evidence, and a clear open affordance.

- [ ] **Step 1: Add failing copy and semantic tests**

```ts
async function createBookWithPages(page: Page, name: string, pageCount: number) {
  await page.getByRole("button", { name: "Create book", exact: true }).click();
  await page.getByRole("textbox", { name: "Book name" }).fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Create book" }).click();
  for (let index = 0; index < pageCount; index += 1) {
    await page.getByRole("button", { name: `Create page in ${name}` }).click();
    await showShelfIfAvailable(page);
  }
}

test("Shelf exposes complete book and timestamp values", async ({ page }) => {
  await createBookWithPages(page, "Research notes for the September launch", 2);
  const book = page.getByRole("button", { name: /Research notes for the September launch book, 2 pages/ });
  await expect(book).toContainText("2 pages");
  await expect(page.getByText("Research notes for the September launch", { exact: true })).toBeVisible();
  const updated = page.locator("time[datetime]").first();
  await expect(updated).toHaveAttribute("title", /\d{4}/);
});
```

- [ ] **Step 2: Add failing rail-overflow tests**

For two books at desktop width, assert `scrollWidth === clientWidth`. Seed enough books to overflow at 390px and assert `scrollWidth > clientWidth`, `tabindex="0"`, and `aria-label="Bookshelf"` on the scroll region.

- [ ] **Step 3: Run the tests and verify they fail**

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "complete book and timestamp|book rail"`

Expected: FAIL on `2p`, missing caption/time/title, or scroll-region semantics.

- [ ] **Step 4: Implement Shelf clarity**

- Render `Empty`, `1 page`, or `${count} pages`.
- Put a horizontal `.book-caption` after each spine and its full value in `title` and the accessible name.
- Remove `truncate` from the vertical text; allow the spine to clip presentation while the caption carries the visible full-value contract.
- Remove `aria-expanded` from Shelf spines because they select a book but do not directly control an expandable region.
- Give the rail `aria-label="Bookshelf"` and `tabIndex={hasOverflow ? 0 : undefined}` based on a measured `ResizeObserver` state in a focused `useOverflowState` hook local to `ShelfPane`.
- On ArrowLeft/ArrowRight while the rail itself is focused, scroll one spine width.
- Replace the dog-ear pseudo-element with Lucide `ArrowUpRight` inside each page card.
- Render `<time dateTime={document.updatedAt} title={absoluteDate}>Updated {relative}</time>` using `Intl.DateTimeFormat`.

- [ ] **Step 5: Run focused tests**

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "complete book and timestamp|book rail"`

Expected: PASS.

- [ ] **Step 6: Run localization and touch regressions**

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "localized titles|interactive targets|reduced motion"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/mdez/ShelfPane.tsx src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "fix: clarify Shelf books and recent pages"
```

---

### Task 5: Create and Validate Versioned Workspace Backups

**Files:**
- Create: `src/types/backup.ts`
- Create: `src/lib/workspace-backup.ts`
- Create: `tests/unit/workspace-backup.test.ts`
- Modify: `src/lib/export.ts`

**Interfaces:**
- Produces:

```ts
export type WorkspaceBackupManifestV1 = {
  app: "Mdez";
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  workspace: { kind: "local" | "group"; id: string | null; name: string };
  folders: Folder[];
  documents: Array<Omit<Document, "body"> & { path: string }>;
  githubSources: GitHubSource[];
};

export type ParsedWorkspaceBackup = {
  manifest: WorkspaceBackupManifestV1;
  documents: Array<Omit<Document, "body"> & { body: string; path: string }>;
};

export type WorkspaceBackupPreview = {
  workspaceName: string;
  workspaceKind: "local" | "group";
  exportedAt: string;
  folderCount: number;
  documentCount: number;
  warnings: string[];
  parsed: ParsedWorkspaceBackup;
};

export function createWorkspaceBackupBlob(input: {
  appVersion: string;
  workspace: WorkspaceBackupManifestV1["workspace"];
  folders: Folder[];
  documents: Document[];
  githubSources: GitHubSource[];
}): Promise<Blob>;

export function previewWorkspaceBackup(file: File): Promise<WorkspaceBackupPreview>;
```

- [ ] **Step 1: Write failing archive round-trip tests**

Cover nested books, unbooked pages, empty books, duplicate page titles, Thai/emoji names, GitHub source attribution, and deterministic collision-safe Markdown paths. Assert the archive contains `manifest.json`, all declared Markdown files, and no access key, management token, or Shared Link token fields.

```ts
it("round-trips nested and unbooked Markdown", async () => {
  const fixture = {
    appVersion: "0.1.0",
    workspace: { kind: "local" as const, id: null, name: "Local Library" },
    folders: [
      { id: "root", name: "Research", parentId: null, order: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
      { id: "nested", name: "Launch", parentId: "root", order: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }
    ],
    documents: [
      { id: "booked", title: "Brief.md", body: "# Launch", folderId: "nested", order: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
      { id: "loose", title: "Scratch.md", body: "Loose note", folderId: null, order: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }
    ],
    githubSources: []
  };
  const blob = await createWorkspaceBackupBlob(fixture);
  const preview = await previewWorkspaceBackup(new File([blob], "library.mdez.zip"));
  expect(preview.folderCount).toBe(fixture.folders.length);
  expect(preview.documentCount).toBe(fixture.documents.length);
  expect(preview.parsed.documents.map((item) => item.body)).toEqual(expect.arrayContaining(fixture.documents.map((item) => item.body)));
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cmd /c npm test -- tests/unit/workspace-backup.test.ts`

Expected: FAIL because the backup types/module do not exist.

- [ ] **Step 3: Implement deterministic backup creation**

Reuse and generalize the collision-safe path helpers in `export.ts`. Put unbooked pages below `pages-without-book/`; keep booked pages below collision-safe folder paths. Write `manifest.json` at archive root. Do not mutate input arrays.

- [ ] **Step 4: Add failing hostile/corrupt archive tests**

Assert rejection with exact safe messages for:

- filename not ending `.mdez.zip`;
- missing or invalid `manifest.json`;
- `schemaVersion !== 1`;
- duplicate folder/document IDs;
- missing declared Markdown files;
- undeclared Markdown files;
- `..`, absolute, backslash, or NUL-containing paths;
- a document whose folder ID is absent;
- folder cycles;
- archive larger than 100MB compressed or more than 10,000 entries.

- [ ] **Step 5: Implement validation before body extraction**

Parse JSON as `unknown`; use explicit type guards rather than casts. Normalize ZIP paths to `/`, reject unsafe paths, validate folder ancestry with a visited set, then read only declared Markdown files. Return user-facing `Error` messages without leaking JSZip internals.

- [ ] **Step 6: Run backup tests**

Run: `cmd /c npm test -- tests/unit/workspace-backup.test.ts tests/unit/export.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/backup.ts src/lib/workspace-backup.ts src/lib/export.ts tests/unit/workspace-backup.test.ts tests/unit/export.test.ts
git commit -m "feat: add versioned workspace backups"
```

---

### Task 6: Restore Backups Atomically into Local Library

**Files:**
- Modify: `src/types/backup.ts`
- Modify: `src/lib/workspace-backup.ts`
- Modify: `src/lib/repository.ts`
- Create: `tests/unit/workspace-restore.test.ts`
- Modify: `tests/unit/repository.test.ts`

**Interfaces:**
- Produces:

```ts
export type PreparedWorkspaceRestore = {
  rootLabel: string;
  folders: Folder[];
  documents: Document[];
  githubSources: GitHubSource[];
  firstDocumentId: string | null;
};

export function prepareWorkspaceRestore(
  parsed: ParsedWorkspaceBackup,
  existingFolders: Folder[],
  now?: string
): PreparedWorkspaceRestore;

export async function restoreWorkspaceBackup(
  prepared: PreparedWorkspaceRestore
): Promise<{ folderCount: number; documentCount: number; firstDocumentId: string | null }>;
```

- [ ] **Step 1: Write failing restore-plan tests**

Verify every imported folder, document, and source receives a new ID; all parent/folder/source references are remapped; timestamps remain valid; root sibling collisions become `Name (restored 2)`, `Name (restored 3)`; and the input is unchanged.

- [ ] **Step 2: Run the test and verify it fails**

Run: `cmd /c npm test -- tests/unit/workspace-restore.test.ts`

Expected: FAIL because restore preparation is absent.

- [ ] **Step 3: Implement pure restore preparation**

Create old-to-new ID maps before producing records. Wrap all imported roots under one generated root book named from `manifest.workspace.name`, with collision-safe restored suffixes. Place originally unbooked pages directly in that root. Remap safe GitHub attribution; omit a source when its declared root folder is missing after validation.

- [ ] **Step 4: Write the failing atomic repository test**

Use a dedicated fake IndexedDB database. Force the second table write to reject and assert folders, documents, and GitHub sources all remain at their pre-restore counts.

- [ ] **Step 5: Implement one Dexie transaction**

```ts
export async function restoreWorkspaceBackup(prepared: PreparedWorkspaceRestore) {
  return db.transaction("rw", db.folders, db.documents, db.githubSources, async () => {
    await db.folders.bulkAdd(prepared.folders);
    await db.documents.bulkAdd(prepared.documents);
    if (prepared.githubSources.length > 0) await db.githubSources.bulkAdd(prepared.githubSources);
    return {
      folderCount: prepared.folders.length,
      documentCount: prepared.documents.length,
      firstDocumentId: prepared.firstDocumentId
    };
  });
}
```

- [ ] **Step 6: Run restore tests**

Run: `cmd /c npm test -- tests/unit/workspace-restore.test.ts tests/unit/repository.test.ts`

Expected: PASS, including rollback.

- [ ] **Step 7: Commit**

```bash
git add src/types/backup.ts src/lib/workspace-backup.ts src/lib/repository.ts tests/unit/workspace-restore.test.ts tests/unit/repository.test.ts
git commit -m "feat: restore workspace backups safely"
```

---

### Task 7: Integrate Backup Restore, Trust, and Recency into the Shelf

**Files:**
- Create: `src/lib/backup-recency.ts`
- Create: `src/components/mdez/StorageTrust.tsx`
- Create: `src/components/mdez/import/BackupImportPanel.tsx`
- Create: `tests/unit/backup-recency.test.ts`
- Create: `tests/unit/backup-import-panel.test.tsx`
- Modify: `src/components/mdez/ImportDialog.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/ShelfPane.tsx`
- Modify: `src/hooks/useWorkspaceLibrary.ts`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Produces:

```ts
export type BackupRecency = { preparedAt: string };
export function backupRecencyKey(workspace: { kind: "local" | "group"; id: string | null }): string;
export function readBackupRecency(workspace: { kind: "local" | "group"; id: string | null }): BackupRecency | null;
export function writeBackupRecency(workspace: { kind: "local" | "group"; id: string | null }, preparedAt: string): void;
```

- `ImportDialogProps` adds:

```ts
onRestoreBackup: (parsed: ParsedWorkspaceBackup) => Promise<{ folderCount: number; documentCount: number }>;
```

- [ ] **Step 1: Write and run failing recency tests**

Test Local Library and two group IDs as distinct keys, corrupt JSON as `null`, future/invalid timestamps as `null`, and successful ISO timestamps as data.

Run: `cmd /c npm test -- tests/unit/backup-recency.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement versioned recency storage**

Use keys `mdez:backup-recency:v1:local` and `mdez:backup-recency:v1:group:<id>`. Parse defensively and never throw from read/write; storage failure leaves the UI at `No workspace backup yet` and reports completion only through the existing status region.

- [ ] **Step 3: Write the failing backup-import-panel test**

Verify file validation produces a preview before restore, shows workspace name/export time/book/page counts, requires explicit `Restore to Local Library`, preserves the preview after a repository error, and never calls restore for invalid files.

- [ ] **Step 4: Implement the fourth Import source**

Add `{ value: "backup", label: "Restore backup", icon: ArchiveRestore }`. `BackupImportPanel` owns file/preview/message/busy state and calls `previewWorkspaceBackup` before enabling restore. Update the source tab grid to reflow as two columns on mobile and four on desktop rather than squeezing labels.

- [ ] **Step 5: Implement `StorageTrust`**

Props:

```ts
type StorageTrustProps = {
  workspaceKind: "local" | "group";
  lastBackupAt: string | null;
  busy: boolean;
  onBackup: () => void;
};
```

Render exact states `No workspace backup yet`, `Last workspace backup [relative]`, and append `· Backup recommended` when older than seven days. The explainer is an accessible disclosure, not a second modal. Local copy is `Stored in this browser`; group copy is `Shared workspace · access key saved in this browser`.

Use this factual explainer copy: `Local Library pages are stored in this browser. Clearing site data can remove them. A workspace backup downloads a restorable copy. Key Group pages are stored by the group service and are available to anyone with its access key. Shared Links publish selected pages to anyone with the link.`

- [ ] **Step 6: Wire backup and restore in `MdezWorkspace`**

Derive workspace identity as `{ kind: "local", id: null, name: "Local Library" }` or `{ kind: "group", id: activeGroupId, name: groupLibrary.group?.name ?? "Key Group" }`.

Backup flow:

1. Set status `Preparing workspace backup` with loading state.
2. Call `createWorkspaceBackupBlob` with active folders/documents and Local GitHub sources only.
3. Download `[slug].mdez.zip`.
4. Write recency only after `downloadBlob` returns.
5. Set status `Workspace backup ready`.
6. On failure, do not change recency and show `Mdez could not prepare the workspace backup. Try again.`

Restore flow always uses Local Library repository APIs, even while a Key Group is active. After success switch to Local Library, refresh content using the returned first document ID, close Import, and announce `Restored N pages to Local Library`.

- [ ] **Step 7: Add E2E trust and restore coverage**

```ts
test("workspace backup recency changes only after a successful backup", async ({ page }) => {
  await expect(page.getByText("No workspace backup yet")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up now" }).click();
  await download;
  await expect(page.getByText(/Last workspace backup/)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Workspace backup ready" })).toBeVisible();
});
```

Add a restore test using a generated fixture archive and assert the preview, explicit confirmation, Local Library switch, restored counts, and no replacement of existing content.

- [ ] **Step 8: Run focused tests**

Run: `cmd /c npm test -- tests/unit/backup-recency.test.ts tests/unit/backup-import-panel.test.tsx tests/unit/workspace-backup.test.ts tests/unit/workspace-restore.test.ts`

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "workspace backup|Restore backup|storage trust"`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/backup-recency.ts src/components/mdez/StorageTrust.tsx src/components/mdez/import/BackupImportPanel.tsx src/components/mdez/ImportDialog.tsx src/components/mdez/MdezWorkspace.tsx src/components/mdez/ShelfPane.tsx src/hooks/useWorkspaceLibrary.ts src/app/styles/workspace.css tests/unit/backup-recency.test.ts tests/unit/backup-import-panel.test.tsx tests/e2e/mdez.spec.ts
git commit -m "feat: add Shelf backup and restore experience"
```

---

### Task 8: Run Phase 1 Integrated Verification and Bounded Visual QA

**Files:**
- Modify only files implicated by failing checks or the first visual defect batch.
- Test: `tests/unit/**/*.test.*`
- Test: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: all Phase 1 deliverables.
- Produces: verified Phase 1 release candidate and an evidence-backed handoff.

- [ ] **Step 1: Run all unit tests**

Run: `cmd /c npm test`

Expected: all tests pass with zero unhandled errors.

- [ ] **Step 2: Run static checks**

Run: `cmd /c npm run lint`

Run: `cmd /c npm run typecheck`

Expected: both exit 0 with no warnings.

- [ ] **Step 3: Run the production build**

Run: `cmd /c npm run build`

Expected: exit 0. If the existing lockfile dependencies are absent locally, restore them from `package-lock.json` without adding or upgrading packages, then rerun this exact build.

- [ ] **Step 4: Run the targeted Shelf suite**

Run: `cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "Shelf|workspace backup|Restore backup|book dialog|overflow|interactive targets|reduced motion|contrast"`

Expected: all targeted desktop/mobile tests pass.

- [ ] **Step 5: Run the full E2E suite**

Run: `cmd /c npm run test:e2e`

Expected: all Mdez, Key Group, and Quick Share browser tests pass.

- [ ] **Step 6: Run one Impeccable detector pass**

Run: `node C:/Users/Neary/.agents/skills/impeccable/scripts/detect.mjs --json src/components/mdez src/app/styles/workspace.css`

Expected: no untriaged P0/P1 mechanical findings. Fix deterministic violations in one batch and do not rerun the detector.

- [ ] **Step 7: Inspect desktop and mobile together**

Capture populated, empty-book, long-title, genuine-rail-overflow, stale-backup, More-menu, backup-preview, restore-error, and maximum-scroll states at 1280×800 and 390×844. Check contrast, containment, grouping, copy, touch targets, focus, reduced motion, and content/status/nav non-overlap.

- [ ] **Step 8: Apply one visual defect batch and confirm once**

Fix all material findings from the first inspection together. Recapture the same states once. Stop polishing after this confirmation pass and record any remaining non-blocking findings honestly.

- [ ] **Step 9: Commit the integrated fixes**

```bash
git add src/app/styles/workspace.css src/components/mdez/MdezWorkspace.tsx src/components/mdez/ShelfPane.tsx src/components/mdez/ShelfActionsMenu.tsx src/components/mdez/BookDialog.tsx src/components/mdez/StorageTrust.tsx src/components/mdez/FolderTree.tsx src/components/mdez/ImportDialog.tsx src/components/mdez/import/BackupImportPanel.tsx src/hooks/useWorkspaceLibrary.ts src/lib/book-names.ts src/lib/workspace-backup.ts src/lib/backup-recency.ts src/lib/repository.ts src/lib/export.ts src/types/backup.ts tests/unit/book-names.test.ts tests/unit/book-dialog.test.tsx tests/unit/workspace-backup.test.ts tests/unit/workspace-restore.test.ts tests/unit/backup-recency.test.ts tests/unit/backup-import-panel.test.tsx tests/unit/repository.test.ts tests/unit/export.test.ts tests/e2e/mdez.spec.ts
git commit -m "fix: finish Shelf phase one verification"
```

- [ ] **Step 10: Report evidence**

Report exact unit/E2E totals, lint/typecheck/build exit status, detector result, inspected viewports, remaining findings, and commit hashes. Do not claim Phase 1 complete if any required command failed or any P0/P1 visual finding remains open.
