# Mdez Renewed Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the production Next.js workspace into visual, responsive, interaction, and accessibility parity with `mdez-workspace_renew.html` while preserving Mdez's working local-first Markdown behavior.

**Architecture:** Keep `MdezWorkspace` as the state and repository coordinator. Put presentation behavior in focused shelf, reader, editor, sidebar, status, and split components; keep IndexedDB, imports, Markdown rendering, autosave, nesting, and ZIP generation behind their existing APIs. Treat the HTML as the approved visual and interaction contract, not as React code.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS plus semantic CSS, CodeMirror 6, React Markdown, Dexie, JSZip, Vitest, and Playwright.

## Implementation status (2026-07-13)

- [x] Task 1: visual foundation
- [x] Task 2: responsive shell, drawer, and status
- [x] Task 3: contextual bookshelf behavior
- [x] Task 4: editor, exports, imports, and empty states
- [x] Task 5: accessible reader table of contents
- [x] Task 6: resizable Split workspace
- [x] Task 7: responsive and accessibility parity
- [x] Verification: 50 unit tests, lint, typecheck, production build, and 48 desktop/mobile browser tests pass
- [x] Visual QA: desktop and 390px mobile layouts inspected; assigned Inter and Space Grotesk roles confirmed
- [x] Commit the reviewed implementation

**Next step:** Implementation complete. Use this plan and its acceptance suite as the baseline for the next product milestone.


---

## Approved Design Contract

- The product is a quiet pastel writing library, not a Cyber Kawaii console.
- Folders are books, Markdown documents are pages, and modes are `Shelf`, `Edit`, `Read`, and `Split`.
- Shelf uses berry, Edit lavender, Read mint, and Split a restrained blend of Edit and Read.
- Desktop uses a compact topbar, collapsible shelf sidebar, main surface, and statusbar.
- Mobile uses a left drawer and scrim, statusbar, and four-item bottom navigation.
- Read uses a centered long-form column and keyboard-safe table of contents.
- Split uses a vertical adjustable separator on desktop and horizontal separator on mobile.
- Empty states expose recovery actions. A page exports as Markdown; an open book exports as folder ZIP.
- Preserve IndexedDB persistence, paste/file imports, nested books, autosave, Markdown rendering, document download, and rooted ZIP export.
- PDF export, HTML export, cloud sync, accounts, landing pages, onboarding, theme controls, and viewport controls are out of scope.

## Semantic Tokens

Use these roles in `src/app/globals.css` and map Tailwind utilities to them in `tailwind.config.ts`:

```css
:root {
  color-scheme: light;
  --bg: #fff7fc;
  --panel: #fff0f8;
  --surface: #fffdfd;
  --surface-2: #f6edff;
  --fg: #2b2233;
  --muted: #725f7c;
  --border: #ead8f0;
  --accent: #8053c8;
  --accent-read: #177f71;
  --accent-files: #b8487a;
  --accent-on: #fffdfd;
  --topbar-h: 32px;
  --status-h: 24px;
  --sidebar-w: 240px;
  --rail-w: 44px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --font-display: var(--font-space-grotesk), "DM Sans", system-ui, sans-serif;
  --font-body: var(--font-inter), "DM Sans", system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;
  --font-reader: var(--font-shippori), Georgia, serif;
}
```

Do not reintroduce neon halos, scanlines, dark arcade panels, gradient text, beige canvases, fake metrics, or demo-only controls.

## File Responsibility Map

- Modify `src/app/layout.tsx`: load and expose the four font roles.
- Modify `src/app/globals.css` and `tailwind.config.ts`: own tokens, shell geometry, states, breakpoints, focus, and reduced motion.
- Modify `src/components/mdez/MdezWorkspace.tsx`: coordinate mode, selection, drawer/sidebar state, status, and existing data operations.
- Modify `src/components/mdez/Sidebar.tsx`, `FolderTree.tsx`, and `ShelfPane.tsx`: render the shelf tree, book spines, contextual commands, bookmarks, and export availability.
- Modify `src/components/mdez/EditorPane.tsx`, `PreviewPane.tsx`, `ExportControls.tsx`, and `ImportDialog.tsx`: implement the renewed editor, reader, TOC, imports, and exports.
- Create `src/components/mdez/SplitWorkspace.tsx`: own split size and separator interactions.
- Create `src/components/mdez/WorkspaceStatus.tsx`: own the single polite live status region.
- Create `src/lib/headings.ts` and `tests/unit/headings.test.ts`: derive stable TOC headings.
- Modify `tests/e2e/mdez.spec.ts`: cover shell, shelf, empty states, drawer, TOC, split, exports, and overflow.

---

### Task 1: Establish the visual foundation

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `tests/e2e/mdez.spec.ts`

- [ ] **Step 1: Add a failing shell test**

```ts
test("uses the renewed light library shell and mode accents", async ({ page }) => {
  const shell = page.getByTestId("workspace-shell");
  await expect(shell).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspace modes" })).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Workspace status" })).toBeVisible();
  const colors = await shell.evaluate((node) => {
    const style = getComputedStyle(node);
    return ["--bg", "--accent", "--accent-read", "--accent-files"].map((name) =>
      style.getPropertyValue(name).trim()
    );
  });
  expect(colors).toEqual(["#fff7fc", "#8053c8", "#177f71", "#b8487a"]);
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "renewed light library shell"`

Expected: FAIL because the shell landmarks and test id do not exist.

- [ ] **Step 3: Implement tokens, fonts, and shell geometry**

Load Space Grotesk, Inter, JetBrains Mono, and Shippori Mincho B1 in `layout.tsx`. Apply the token contract and this shell:

```css
.workspace-shell {
  display: grid;
  grid-template-rows: var(--topbar-h) minmax(0, 1fr) var(--status-h);
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  color: var(--fg);
  background:
    radial-gradient(circle at 16% 12%, rgb(223 111 159 / 20%), transparent 28%),
    radial-gradient(circle at 78% 26%, rgb(141 99 216 / 18%), transparent 34%),
    linear-gradient(135deg, rgb(255 255 255 / 72%), rgb(246 237 255 / 58%) 46%, rgb(255 240 248 / 72%)),
    var(--bg);
}
.workspace-shell[data-mode="shelf"] { --mode-accent: var(--accent-files); }
.workspace-shell[data-mode="editor"] { --mode-accent: var(--accent); }
.workspace-shell[data-mode="preview"] { --mode-accent: var(--accent-read); }
.workspace-shell[data-mode="split"] {
  --mode-accent: color-mix(in oklch, var(--accent) 52%, var(--accent-read));
}
```

Keep one shared `:focus-visible` ring and the reduced-motion override. Remove touched `cyber-*`, `holo-*`, and `sticker-*` naming.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "renewed light library shell"`

Expected: PASS.

Run: `npm run lint && npm run typecheck`

Expected: both exit 0.

```bash
git add src/app/layout.tsx src/app/globals.css tailwind.config.ts tests/e2e/mdez.spec.ts
git commit -m "style: establish renewed workspace foundation"
```

### Task 2: Build the responsive shell, drawer, and status

**Files:**
- Create: `src/components/mdez/WorkspaceStatus.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/Sidebar.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/mdez.spec.ts`

- [ ] **Step 1: Add failing interaction tests**

```ts
test("desktop sidebar state is restored", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const toggle = page.getByRole("button", { name: "Toggle sidebar" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.getByRole("button", { name: "Toggle sidebar" }))
    .toHaveAttribute("aria-expanded", "false");
});

test("mobile drawer makes the workspace inert", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open library shelf" }).click();
  await expect(page.getByRole("complementary", { name: "Library shelf" }))
    .toHaveAttribute("aria-hidden", "false");
  await expect(page.getByRole("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Library shelf" }))
    .toHaveAttribute("aria-hidden", "true");
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "sidebar|drawer"`

Expected: FAIL because the current mobile layout swaps panels instead of opening an inert drawer.

- [ ] **Step 3: Implement shell state**

Add `isSidebarVisible`, `isDrawerOpen`, and one status message in `MdezWorkspace`. Restore desktop visibility from `localStorage`. Mode changes close the drawer and TOC. Top and bottom controls share `viewMode`, use `aria-selected`, and order modes Shelf, Edit, Read, Split.

While the mobile drawer is open, the main panel, statusbar, and bottom nav are inert; the drawer is not. Scrim click and Escape close it. Focus moves to the first tree control and Escape restores the drawer trigger.

Create:

```ts
type WorkspaceStatusProps = {
  message: string;
  state: "saved" | "saving" | "loading" | "error";
  activePage: string;
};
```

Render one `role="status" aria-live="polite"`, a truncating page name, `UTF-8`, and `Local`. Map operations to explicit messages: `Saved`, `Saving`, `Indexing markdown`, `Import failed`, `Prepared book ZIP`, and the existing repository/export errors.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "sidebar|drawer"`

Expected: PASS.

```bash
git add src/components/mdez/WorkspaceStatus.tsx src/components/mdez/MdezWorkspace.tsx src/components/mdez/Sidebar.tsx src/app/globals.css tests/e2e/mdez.spec.ts
git commit -m "feat: add responsive workspace shell"
```

### Task 3: Match contextual bookshelf behavior

**Files:**
- Modify: `src/components/mdez/ShelfPane.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/Sidebar.tsx`
- Modify: `src/components/mdez/FolderTree.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/mdez.spec.ts`

- [ ] **Step 1: Strengthen the failing shelf test**

```ts
test("one open book controls shelf context", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("Writing"));
  await page.getByRole("button", { name: "New book - create shelf book" }).click();
  await page.getByRole("button", { name: "Create page in Writing", exact: true }).click();
  await showShelfIfAvailable(page);
  await expect(page.getByRole("button", { name: /Writing book, 1 page, open/ }).first())
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "New book on shelf" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Book ZIP for open book in Shelf" }).first())
    .toBeEnabled();
  await expect(page.getByRole("list", { name: "Bookmarked pages" }).getByRole("listitem"))
    .toHaveCount(1);
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "open book|shelf context"`

Expected: FAIL on a label, list semantic, or context transition.

- [ ] **Step 3: Implement the shelf contract**

Render root books in a horizontal shelf rail, scaling spine size from direct page count with usable caps. Nested books remain in `FolderTree`, but selecting any book opens it and updates context. Exactly one spine has `aria-pressed="true"` and `aria-expanded="true"`. Names follow `[Book] book, [N] page(s), open|closed`.

Render bookmarked pages as a named list. Filter to the open book; with no open book show the eight most recently updated pages. Names follow `[filename] page in [Book], updated [relative time]`. Keep `role="tree"`/`role="treeitem"` in the sidebar, preserve expansion state and nested-book controls, and make every row keyboard reachable.

Use exact context copy:

```ts
const createPageLabel = openBook ? `Create page in ${openBook.name}` : "Create page";
const createBookLabel = openBook ? "New book on shelf" : "New book";
const exportHint = openBook
  ? `${openBook.name} is open. Book ZIP includes its markdown pages and metadata.`
  : "Open a book before exporting its folder ZIP. Root export is not available in V1.";
```

- [ ] **Step 4: Verify and commit**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "shelf|book|folder ZIP"`

Expected: PASS, including nested folder ZIP rooting.

```bash
git add src/components/mdez/ShelfPane.tsx src/components/mdez/MdezWorkspace.tsx src/components/mdez/Sidebar.tsx src/components/mdez/FolderTree.tsx src/app/globals.css tests/e2e/mdez.spec.ts
git commit -m "feat: implement contextual bookshelf"
```

### Task 4: Renew the editor, exports, and empty states

**Files:**
- Modify: `src/components/mdez/EditorPane.tsx`
- Modify: `src/components/mdez/ExportControls.tsx`
- Modify: `src/components/mdez/ImportDialog.tsx`
- Modify: `src/components/mdez/PreviewPane.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/mdez.spec.ts`

- [ ] **Step 1: Add a failing toolbar test**

```ts
test("editor exposes the renewed markdown toolbar", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).first().click();
  const toolbar = page.getByRole("toolbar", { name: "Markdown toolbar" });
  for (const name of ["Bold", "Italic", "Insert link", "Insert image", "Code", "Heading 1", "Heading 2", "Divider", "Export .md"]) {
    await expect(toolbar.getByRole("button", { name })).toBeVisible();
  }
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "renewed markdown toolbar"`

Expected: FAIL because the toolbar contract is incomplete.

- [ ] **Step 3: Implement real CodeMirror actions**

Give the toolbar `role="toolbar"`. Bold wraps with `**`, italic with `_`, link inserts `[text](url)`, image inserts `![alt](url)`, code wraps inline with backticks and multiline with fences, headings prefix the selected line, and divider inserts `\n---\n`.

Keep title/body save queues. Move save feedback into `WorkspaceStatus`; do not add competing live regions. Rename page export to `Export .md` and preserve Blob download behavior. Book ZIP stays visible but disabled without an open book.

Edit and Read with no page render `No page selected`, `Create page`, and `Import markdown`. Shelf additionally includes `New book`.

Keep the sidebar import control as both a native button and drop target. Click opens the existing `ImportDialog`; drag-over sets a visible `data-drop-state="active"` state; dropping reads real files through the existing Markdown validation/import path. Reject a drop containing a non-Markdown file with `Choose a .md file`, announce the error through `WorkspaceStatus`, and never partially import a mixed invalid batch.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "toolbar|no-document|imports markdown|exports the selected document|persistence"`

Expected: PASS.

```bash
git add src/components/mdez/EditorPane.tsx src/components/mdez/ExportControls.tsx src/components/mdez/ImportDialog.tsx src/components/mdez/PreviewPane.tsx src/components/mdez/MdezWorkspace.tsx src/app/globals.css tests/e2e/mdez.spec.ts
git commit -m "feat: renew editor and empty states"
```

### Task 5: Generate an accessible reader TOC

**Files:**
- Create: `src/lib/headings.ts`
- Create: `tests/unit/headings.test.ts`
- Modify: `src/components/mdez/PreviewPane.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/mdez.spec.ts`

- [ ] **Step 1: Write failing unit tests**

```ts
import { describe, expect, it } from "vitest";
import { extractHeadings } from "@/lib/headings";

describe("extractHeadings", () => {
  it("extracts headings and suffixes duplicate slugs", () => {
    expect(extractHeadings("# Quiet shell\n\n## Mode behavior\n\n## Mode behavior")).toEqual([
      { depth: 1, text: "Quiet shell", id: "quiet-shell" },
      { depth: 2, text: "Mode behavior", id: "mode-behavior" },
      { depth: 2, text: "Mode behavior", id: "mode-behavior-2" }
    ]);
  });
  it("ignores headings inside fenced code", () => {
    expect(extractHeadings("# Visible\n\n~~~md\n# Hidden\n~~~"))
      .toEqual([{ depth: 1, text: "Visible", id: "visible" }]);
  });
});
```

- [ ] **Step 2: Run them**

Run: `npm test -- tests/unit/headings.test.ts`

Expected: FAIL because `src/lib/headings.ts` does not exist.

- [ ] **Step 3: Implement extraction and TOC behavior**

Parse ATX headings outside fenced blocks, strip trailing hashes, slug visible text, and suffix duplicates from `-2`. Apply matching IDs through React Markdown heading renderers.

The TOC is a dismissible `nav`: closed means `aria-hidden="true"` and `inert`; opening focuses the current or first link; Escape/outside click closes; the close button restores trigger focus; selected links use `aria-current="location"`.

Reader prose uses `--font-reader`, centered `680px` width, and comfortable spacing. Headings use display; code uses mono.

- [ ] **Step 4: Add E2E behavior and verify**

```ts
test("reader TOC is inert when closed and keyboard safe when open", async ({ page }) => {
  await page.getByRole("button", { name: "Import markdown", exact: true }).first().click();
  await page.getByLabel("Paste markdown").fill("# Quiet shell\n\n## Mode behavior");
  await page.getByRole("button", { name: "Import Paste" }).click();
  await clickVisibleButtonIfAvailable(page, "Read");
  const toc = page.getByRole("navigation", { name: "Table of contents" });
  await expect(toc).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Open table of contents" }).click();
  await expect(toc).not.toHaveAttribute("inert", "");
  await expect(toc.getByRole("link", { name: "Quiet shell" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toc).toHaveAttribute("inert", "");
});
```

Run: `npm test -- tests/unit/headings.test.ts && npm run test:e2e -- tests/e2e/mdez.spec.ts -g "table of contents|reader typography"`

Expected: PASS.

```bash
git add src/lib/headings.ts tests/unit/headings.test.ts src/components/mdez/PreviewPane.tsx src/app/globals.css tests/e2e/mdez.spec.ts
git commit -m "feat: add accessible reader contents"
```

### Task 6: Implement the resizable Split workspace

**Files:**
- Create: `src/components/mdez/SplitWorkspace.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/EditorPane.tsx`
- Modify: `src/components/mdez/PreviewPane.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/mdez.spec.ts`

- [ ] **Step 1: Add a failing resize test**

```ts
test("split separator resizes from 30 to 70 percent", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).first().click();
  await clickVisibleButtonIfAvailable(page, "Split");
  const separator = page.getByRole("separator", { name: "Resize editor and reader panes" });
  await expect(separator).toHaveAttribute("aria-valuenow", "50");
  await separator.focus();
  await page.keyboard.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "55");
  await page.keyboard.press("End");
  await expect(separator).toHaveAttribute("aria-valuenow", "70");
  await page.keyboard.press("Home");
  await expect(separator).toHaveAttribute("aria-valuenow", "30");
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "split separator"`

Expected: FAIL because Split is a fixed grid.

- [ ] **Step 3: Implement `SplitWorkspace`**

```ts
type SplitWorkspaceProps = {
  editor: React.ReactNode;
  reader: React.ReactNode;
};
```

Store integer percentage `50`, clamped to `30..70`. Desktop columns are `${value}% 8px ${100 - value}%`; mobile rows are `${value}% 32px ${100 - value}%`.

The separator exposes orientation, min/max/value, and `Editor [N] percent width|height`. ArrowLeft/Up subtract 5; ArrowRight/Down add 5; Home sets 30; End sets 70. Pointer drag resizes desktop. Release capture on pointer up and cancel. Do not duplicate title inputs or live regions in Split.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "split separator|switches editor"`

Expected: PASS with vertical desktop and horizontal mobile orientation.

```bash
git add src/components/mdez/SplitWorkspace.tsx src/components/mdez/MdezWorkspace.tsx src/components/mdez/EditorPane.tsx src/components/mdez/PreviewPane.tsx src/app/globals.css tests/e2e/mdez.spec.ts
git commit -m "feat: add resizable split workspace"
```

### Task 7: Prove responsive and accessibility parity

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/Sidebar.tsx`
- Modify: `src/components/mdez/ShelfPane.tsx`
- Modify: `tests/e2e/mdez.spec.ts`

- [ ] **Step 1: Add viewport and inertness tests**

```ts
for (const width of [390, 430, 768, 1024, 1440]) {
  test(`workspace has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await showShelfIfAvailable(page);
    const size = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth
    ]);
    expect(size[1]).toBe(size[0]);
  });
}

test("inactive screens are hidden from interaction", async ({ page }) => {
  await clickVisibleButtonIfAvailable(page, "Read");
  await expect(page.getByTestId("screen-editor")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("screen-editor")).toHaveAttribute("inert", "");
  await expect(page.getByTestId("screen-reader")).toHaveAttribute("aria-hidden", "false");
});
```

- [ ] **Step 2: Run them**

Run: `npm run test:e2e -- tests/e2e/mdez.spec.ts -g "horizontal overflow|hidden from interaction"`

Expected: any overflow or inactive-screen exposure fails explicitly.

- [ ] **Step 3: Finish responsive and semantic rules**

- `>=1024px`: persistent/collapsible sidebar and top tabs; no bottom nav.
- `768px..1023px`: compact sidebar treatment and two-column bookmark grid.
- `<768px`: drawer, stacked actions, one-column cards, bottom nav, status above nav, horizontal split.
- `<=430px`: compact brand and tabs without clipping.

Each active surface has one `h1`. Inactive screens, closed TOC, and closed mobile drawer are inert. Icon-only controls are named. Decorative SVGs and mascot pieces are hidden. Book ZIP stays visible when unavailable and explains why. Hover, focus, active, disabled, loading, error, selected, and open states remain distinct without animation.

- [ ] **Step 4: Run the full suite**

Run: `npm test`

Expected: all Vitest tests pass.

Run: `npm run lint && npm run typecheck && npm run build`

Expected: all exit 0 without warnings.

Run: `npm run test:e2e`

Expected: all Playwright tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/mdez/MdezWorkspace.tsx src/components/mdez/Sidebar.tsx src/components/mdez/ShelfPane.tsx tests/e2e/mdez.spec.ts
git commit -m "test: verify renewed workspace parity"
```

---

## Final Acceptance

- Shelf, Edit, Read, and Split share one mode state across desktop and mobile.
- One open book controls bookmark filtering, create labels, and Book ZIP; root never exports ZIP.
- Nested books, import, autosave, Markdown export, and rooted ZIP export retain passing tests.
- Toolbar controls operate on real CodeMirror selections.
- Read has a generated, inert-when-closed, keyboard-safe TOC.
- Split resizes from 30% to 70% by keyboard and pointer with correct orientation metadata.
- One polite live region announces save, import, export, and error state.
- Closed drawers/overlays and inactive screens cannot receive focus.
- No horizontal overflow occurs at 390, 430, 768, 1024, or 1440px.
- Reader, display, body, and code typography use their assigned roles.
- The final UI matches `mdez-workspace_renew.html` and contains no Cyber Kawaii presentation.
