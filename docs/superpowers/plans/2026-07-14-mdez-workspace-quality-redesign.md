# Mdez Workspace Quality Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Mdez workspace around a quiet editorial grid, dependable tablet/mobile composition, and focused client modules while preserving every local-first Markdown behavior and the existing playful pastel brand.

**Architecture:** Keep `MdezWorkspace` as a thin composition root. Move responsive state, draft/autosave coordination, and repository-backed library actions into focused hooks; split the import dialog and editor toolbar by responsibility; and replace the layered-card styling with one tokenized workspace system. Lock behavior with unit and browser tests before each structural or visual change.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3, semantic CSS, CodeMirror 6, React Markdown, Dexie, JSZip, Vitest, Testing Library, and Playwright.

## Global Constraints

- Preserve the four workspace modes and their order: `Shelf`, `Edit`, `Read`, `Split`.
- Preserve IndexedDB persistence, debounced autosave, nested books, paste/file/public-GitHub import, manual GitHub refresh, Markdown rendering, page `.md` export, and rooted book ZIP export.
- Preserve the brand personality: **Playful, Precise, Calm.**
- Preserve the existing palette roles: berry for Shelf, lavender for Edit, mint for Read, and a restrained Edit/Read blend for Split.
- Use Space Grotesk for workspace hierarchy, Inter for UI text, Shippori Mincho B1 for reader prose, and JetBrains Mono only for code and technical metadata.
- Keep one document identity dominant per mode; do not show the same visible title in both the workspace frame and the active work surface.
- Use quiet rules and shared alignment tracks instead of nested bordered, rounded, shadowed cards.
- Reserve shadows for overlays, drawers, the table of contents, and other genuinely floating UI.
- At widths `<= 1023px`, use the shelf as a drawer and stack Split vertically.
- At widths `<= 767px`, retain the four-item bottom navigation and mobile status placement.
- Interactive touch targets must render at least `44px` by `44px` at widths `<= 767px`.
- Do not add dependencies for responsive state, focus management, styling, or code splitting.
- Maintain WCAG AA contrast, semantic landmarks, visible focus, inert overlays, Escape behavior, focus return, and `prefers-reduced-motion` support.
- Use test-driven development: every behavior or visual contract change begins with a failing focused test.
- Do not modify repository persistence schemas or migrate existing IndexedDB data.

---

## File Responsibility Map

### Create

- `src/hooks/useMediaQuery.ts` — shared, hydration-safe media-query state.
- `src/hooks/useWorkspaceViewport.ts` — the only React-level workspace breakpoint contract.
- `src/lib/latest-save-queue.ts` — framework-independent latest-value-wins serialization.
- `src/hooks/useDocumentDrafts.ts` — draft maps, debounce, save status, and autosave integration.
- `src/hooks/useWorkspaceLibrary.ts` — repository-backed folders, documents, sources, selection, and content mutations.
- `src/components/mdez/import/ImportDialogShell.tsx` — dialog semantics, focus trap, Escape, and focus return.
- `src/components/mdez/import/PasteImportPanel.tsx` — paste-source fields and submission.
- `src/components/mdez/import/FileImportPanel.tsx` — file/drop validation and submission.
- `src/components/mdez/import/GitHubImportPanel.tsx` — preview, retry, and repository import UI.
- `src/components/mdez/EditorToolbar.tsx` — touch-safe formatting and export composition.
- `src/app/styles/tokens.css` — single semantic token source.
- `src/app/styles/workspace.css` — shell, grid, surfaces, responsive transformation, toolbar, TOC, and split geometry.
- `src/app/styles/markdown.css` — reader and CodeMirror typography/content styles.
- `tests/unit/latest-save-queue.test.ts` — queue ordering, supersession, and error recovery.
- `tests/unit/useDocumentDrafts.test.tsx` — debounce, rapid edits, switching, and failure retention.
- `tests/unit/useWorkspaceViewport.test.tsx` — breakpoint subscription and cleanup.

### Modify

- `src/components/mdez/MdezWorkspace.tsx` — become a thin composition root using the new hooks and responsive contract.
- `src/components/mdez/SplitWorkspace.tsx` — receive orientation from the composition root and support both pointer axes.
- `src/components/mdez/ImportDialog.tsx` — coordinate source state and compose the extracted shell/panels.
- `src/components/mdez/EditorPane.tsx` — compose `EditorToolbar` and keep CodeMirror formatting behavior.
- `src/components/mdez/PreviewPane.tsx` — own the visible reader title and reader-prose hierarchy.
- `src/components/mdez/ShelfPane.tsx` — use rule-based sections and the shared grid.
- `src/components/mdez/Sidebar.tsx` — adopt tablet drawer behavior and simplified surfaces.
- `src/components/mdez/WorkspaceStatus.tsx` — retain behavior while aligning to the grid.
- `src/app/globals.css` — retain Tailwind entry points and import the three focused style sheets.
- `tests/e2e/mdez.spec.ts` — add mode/viewport usability, title hierarchy, touch, and surface contracts.
- `docs/uxui_improve/mdez_ux_review.md` — record resolved findings and verification evidence.

---

### Task 1: Lock the responsive and hierarchy contracts

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: existing workspace roles, mode tabs, `data-testid="workspace-main"`, and `role="separator"`.
- Produces: failing acceptance tests that Tasks 2, 7, and 8 must satisfy.

- [ ] **Step 1: Add helpers for visible geometry**

Add below the existing browser-test helpers:

```ts
async function expectInsideViewport(locator: Locator, viewportWidth: number) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
}

async function expectMinimumTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}
```

Update the Playwright import to include the exact type:

```ts
import { expect, test, type Locator } from "@playwright/test";
```

- [ ] **Step 2: Add the failing tablet Split test**

```ts
test("tablet split stacks full-width panes and keeps the shelf in a drawer", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.getByRole("tab", { name: "Split" }).click();

  await expect(page.getByRole("button", { name: "Open library shelf" })).toBeVisible();
  const separator = page.getByRole("separator", { name: "Resize editor and reader panes" });
  await expect(separator).toHaveAttribute("aria-orientation", "horizontal");

  const articles = page.locator("main article");
  await expect(articles).toHaveCount(2);
  for (const article of await articles.all()) {
    const box = await article.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(680);
  }
});
```

- [ ] **Step 3: Add failing mobile toolbar and title tests**

```ts
test("mobile editor keeps document actions visible and touch safe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.getByRole("tab", { name: "Edit" }).click();

  const toolbar = page.getByRole("toolbar", { name: "Markdown toolbar" });
  for (const name of ["Bold", "Italic", "Insert link", "Insert image", "Code", "Heading 1", "Heading 2", "Divider"]) {
    await expectMinimumTouchTarget(toolbar.getByRole("button", { name }));
  }
  await expectInsideViewport(toolbar.getByRole("button", { name: "Export .md" }), 390);
});

test("read mode exposes one workspace-level document heading", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.getByRole("tab", { name: "Read" }).click();

  const main = page.getByRole("main");
  const identity = main.getByRole("heading", { name: "Untitled Document", exact: true });
  await expect(identity).toHaveCount(1);
  await expect(identity).toHaveJSProperty("tagName", "H1");
});
```

- [ ] **Step 4: Run the focused tests and confirm the reviewed failures**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "tablet split|mobile editor|workspace-level document heading"
```

Expected: FAIL because 768px still uses the desktop sidebar and vertical Split, toolbar controls are 36px, export begins outside the initial toolbar viewport, and Read exposes repeated document headings.

- [ ] **Step 5: Commit the failing contracts**

```bash
git add tests/e2e/mdez.spec.ts
git commit -m "test: lock workspace quality contracts"
```

---

### Task 2: Establish one responsive workspace contract

**Files:**
- Create: `src/hooks/useMediaQuery.ts`
- Create: `src/hooks/useWorkspaceViewport.ts`
- Create: `tests/unit/useWorkspaceViewport.test.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/SplitWorkspace.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Produces: `useWorkspaceViewport(): { isTabletLayout: boolean; isMobileLayout: boolean }`.
- Produces: `SplitWorkspace({ editor, reader, orientation })` where `orientation` is `"horizontal" | "vertical"` and describes the separator.
- Consumes: the Task 1 tablet acceptance test.

- [ ] **Step 1: Write the failing viewport-hook unit test**

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceViewport } from "@/hooks/useWorkspaceViewport";

describe("useWorkspaceViewport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("separates tablet shell behavior from mobile navigation behavior", () => {
    const listeners = new Map<string, () => void>();
    const matches = new Map([
      ["(max-width: 1023px)", true],
      ["(max-width: 767px)", false]
    ]);

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: matches.get(query) ?? false,
      media: query,
      onchange: null,
      addEventListener: (_name: string, listener: () => void) => listeners.set(query, listener),
      removeEventListener: (_name: string) => listeners.delete(query),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    const { result } = renderHook(() => useWorkspaceViewport());
    expect(result.current).toEqual({ isTabletLayout: true, isMobileLayout: false });

    matches.set("(max-width: 767px)", true);
    act(() => listeners.get("(max-width: 767px)")?.());
    expect(result.current).toEqual({ isTabletLayout: true, isMobileLayout: true });
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run:

```bash
npm test -- tests/unit/useWorkspaceViewport.test.tsx
```

Expected: FAIL because `@/hooks/useWorkspaceViewport` does not exist.

- [ ] **Step 3: Implement the shared hooks**

Create `src/hooks/useMediaQuery.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);

  return matches;
}
```

Create `src/hooks/useWorkspaceViewport.ts`:

```ts
"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";

export const TABLET_LAYOUT_QUERY = "(max-width: 1023px)";
export const MOBILE_LAYOUT_QUERY = "(max-width: 767px)";

export function useWorkspaceViewport() {
  return {
    isTabletLayout: useMediaQuery(TABLET_LAYOUT_QUERY),
    isMobileLayout: useMediaQuery(MOBILE_LAYOUT_QUERY)
  };
}
```

- [ ] **Step 4: Replace duplicated viewport state in the composition root**

In `MdezWorkspace.tsx`, remove the local `isMobile` state and its `matchMedia` effect. Import the hook and derive both shell decisions:

```ts
import { useWorkspaceViewport } from "@/hooks/useWorkspaceViewport";

const { isTabletLayout, isMobileLayout } = useWorkspaceViewport();
const sidebarIsHidden = isTabletLayout ? !isDrawerOpen : !isSidebarVisible;
```

Use `isTabletLayout` for drawer visibility, scrim rendering, drawer inertness, and focus return. Use `isMobileLayout` only for bottom-navigation/status behavior. Pass the responsive composition to Split:

```tsx
<SplitWorkspace
  editor={editorPane}
  reader={readerPane}
  orientation={isTabletLayout ? "horizontal" : "vertical"}
/>
```

- [ ] **Step 5: Make Split pointer resizing axis-aware**

Replace `SplitWorkspace` with this public shape and axis calculation:

```tsx
type SplitWorkspaceProps = {
  editor: ReactNode;
  reader: ReactNode;
  orientation: "horizontal" | "vertical";
};

export function SplitWorkspace({ editor, reader, orientation }: SplitWorkspaceProps) {
  const [value, setValue] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isHorizontal = orientation === "horizontal";

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const position = isHorizontal ? event.clientY - rect.top : event.clientX - rect.left;
    const extent = isHorizontal ? rect.height : rect.width;
    setValue(clampSplit((position / extent) * 100));
  }

  const style = isHorizontal
    ? { gridTemplateRows: `${value}% 2rem ${100 - value}%` }
    : { gridTemplateColumns: `${value}% 0.5rem ${100 - value}%` };

  return (
    <div ref={containerRef} className="split-workspace" data-orientation={orientation} style={style}>
      <div className="min-h-0 min-w-0 overflow-hidden">{editor}</div>
      <button
        type="button"
        role="separator"
        aria-label="Resize editor and reader panes"
        aria-orientation={orientation}
        aria-valuemin={30}
        aria-valuemax={70}
        aria-valuenow={value}
        aria-valuetext={`Editor ${value} percent ${isHorizontal ? "height" : "width"}`}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
        onPointerCancel={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
        className="split-separator"
      />
      <div className="min-h-0 min-w-0 overflow-hidden">{reader}</div>
    </div>
  );
}
```

Keep the existing `clampSplit` and keyboard handler unchanged.

- [ ] **Step 6: Recompose the tablet shell in CSS**

Move drawer/grid rules from the current `767px` media query into a new tablet query and keep bottom navigation in the mobile query:

```css
@media (max-width: 1023px) {
  .workspace-topbar {
    grid-template-columns: max-content minmax(0, 1fr) max-content;
  }

  .desktop-sidebar-toggle { display: none; }
  .mobile-drawer-trigger { display: inline-grid; }
  .workspace-content { grid-template-columns: minmax(0, 1fr); }

  .workspace-sidebar {
    position: fixed;
    inset: var(--topbar-h) auto var(--status-h) 0;
    z-index: 70;
    width: min(19rem, 86vw);
    transform: translateX(0);
  }

  .workspace-sidebar[aria-hidden="true"] { transform: translateX(-105%); }
  .workspace-scrim { display: block; inset: var(--topbar-h) 0 var(--status-h); }

  .split-workspace[data-orientation="horizontal"] {
    min-height: 70rem;
    grid-template-columns: minmax(0, 1fr);
  }

  .split-workspace[data-orientation="horizontal"] .split-separator {
    min-height: 2rem;
    cursor: row-resize;
  }
}

@media (max-width: 767px) {
  .workspace-mode-nav { display: none; }
  .mobile-mode-nav { display: grid; }
}
```

- [ ] **Step 7: Run focused verification**

Run:

```bash
npm test -- tests/unit/useWorkspaceViewport.test.tsx
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "tablet split|mobile drawer|split separator"
```

Expected: all selected tests PASS; at 768px the shelf is a drawer, Split is vertical, and the separator remains keyboard and pointer adjustable.

- [ ] **Step 8: Commit the responsive contract**

```bash
git add src/hooks/useMediaQuery.ts src/hooks/useWorkspaceViewport.ts tests/unit/useWorkspaceViewport.test.tsx src/components/mdez/MdezWorkspace.tsx src/components/mdez/SplitWorkspace.tsx src/app/globals.css tests/e2e/mdez.spec.ts
git commit -m "refactor: unify responsive workspace behavior"
```

---

### Task 3: Extract and test the latest-value save queue

**Files:**
- Create: `src/lib/latest-save-queue.ts`
- Create: `tests/unit/latest-save-queue.test.ts`

**Interfaces:**
- Produces: `LatestSaveQueue<Value, Result>` with `enqueue(key, value): Promise<Result | null>` and `clear(key): void`.
- Consumes: no React state or browser APIs.

- [ ] **Step 1: Write queue tests for supersession and recovery**

```ts
import { describe, expect, it, vi } from "vitest";

import { LatestSaveQueue } from "@/lib/latest-save-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("LatestSaveQueue", () => {
  it("serializes one key and persists only the newest waiting value", async () => {
    const first = deferred<string>();
    const persist = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce("saved newest");
    const queue = new LatestSaveQueue(persist);

    const firstResult = queue.enqueue("page-1", "first");
    const supersededResult = queue.enqueue("page-1", "second");
    const newestResult = queue.enqueue("page-1", "newest");
    first.resolve("saved first");

    await expect(firstResult).resolves.toBe("saved first");
    await expect(supersededResult).resolves.toBeNull();
    await expect(newestResult).resolves.toBe("saved newest");
    expect(persist).toHaveBeenNthCalledWith(1, "page-1", "first");
    expect(persist).toHaveBeenNthCalledWith(2, "page-1", "newest");
  });

  it("rejects the failed value and continues with the newest waiting value", async () => {
    const first = deferred<string>();
    const persist = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce("recovered");
    const queue = new LatestSaveQueue(persist);

    const failed = queue.enqueue("page-1", "bad");
    const recovered = queue.enqueue("page-1", "good");
    const failedExpectation = expect(failed).rejects.toThrow("offline");
    first.reject(new Error("offline"));

    await failedExpectation;
    await expect(recovered).resolves.toBe("recovered");
  });
});
```

- [ ] **Step 2: Run the queue test to verify it fails**

Run:

```bash
npm test -- tests/unit/latest-save-queue.test.ts
```

Expected: FAIL because `LatestSaveQueue` does not exist.

- [ ] **Step 3: Implement the framework-independent queue**

```ts
type Request<Value, Result> = {
  value: Value;
  resolve: (result: Result | null) => void;
  reject: (error: unknown) => void;
};

type Entry<Value, Result> = {
  running: boolean;
  latest: Request<Value, Result> | null;
};

export class LatestSaveQueue<Value, Result> {
  private readonly entries = new Map<string, Entry<Value, Result>>();

  constructor(private readonly persist: (key: string, value: Value) => Promise<Result>) {}

  enqueue(key: string, value: Value) {
    const entry = this.entries.get(key) ?? { running: false, latest: null };
    this.entries.set(key, entry);
    entry.latest?.resolve(null);

    const result = new Promise<Result | null>((resolve, reject) => {
      entry.latest = { value, resolve, reject };
    });

    if (!entry.running) {
      entry.running = true;
      void this.drain(key, entry);
    }

    return result;
  }

  clear(key: string) {
    const entry = this.entries.get(key);
    entry?.latest?.resolve(null);
    this.entries.delete(key);
  }

  private async drain(key: string, entry: Entry<Value, Result>) {
    while (entry.latest) {
      const request = entry.latest;
      entry.latest = null;
      try {
        request.resolve(await this.persist(key, request.value));
      } catch (error) {
        request.reject(error);
      }
    }

    entry.running = false;
    if (entry.latest) {
      entry.running = true;
      void this.drain(key, entry);
    } else if (this.entries.get(key) === entry) {
      this.entries.delete(key);
    }
  }
}
```

- [ ] **Step 4: Run the queue tests**

Run:

```bash
npm test -- tests/unit/latest-save-queue.test.ts
```

Expected: both tests PASS.

- [ ] **Step 5: Commit the queue primitive**

```bash
git add src/lib/latest-save-queue.ts tests/unit/latest-save-queue.test.ts
git commit -m "refactor: isolate latest value save queue"
```

---

### Task 4: Extract document drafts and autosave from the workspace

**Files:**
- Create: `src/hooks/useDocumentDrafts.ts`
- Create: `tests/unit/useDocumentDrafts.test.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`

**Interfaces:**
- Consumes: `LatestSaveQueue<string, Document>` from Task 3.
- Produces: `useDocumentDrafts(options): DocumentDraftController`.
- Produces: `DocumentDraftController` fields `liveDocuments`, `draftBody`, `draftTitle`, `saveStatus`, `changeBody`, and `changeTitle`.

- [ ] **Step 1: Write focused autosave-hook tests**

Use fake timers and a deferred persist call:

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDocumentDrafts } from "@/hooks/useDocumentDrafts";
import type { Document } from "@/types/content";

const page: Document = {
  id: "page-1",
  folderId: null,
  title: "Page",
  body: "Initial",
  order: 0,
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z"
};

describe("useDocumentDrafts", () => {
  it("debounces rapid body edits and persists the newest body", async () => {
    vi.useFakeTimers();
    const persistBody = vi.fn(async (_id: string, body: string) => ({ ...page, body }));
    const setDocuments = vi.fn();
    const setError = vi.fn();
    const { result } = renderHook(() => useDocumentDrafts({
      documents: [page],
      selectedDocumentId: page.id,
      setDocuments,
      setError,
      persistBody,
      persistTitle: vi.fn()
    }));

    act(() => {
      result.current.changeBody("One");
      result.current.changeBody("Two");
      result.current.changeBody("Newest");
      vi.advanceTimersByTime(650);
    });
    await act(async () => Promise.resolve());

    expect(persistBody).toHaveBeenCalledOnce();
    expect(persistBody).toHaveBeenCalledWith(page.id, "Newest");
    vi.useRealTimers();
  });

  it("retains the visible draft and reports the standard message after failure", async () => {
    vi.useFakeTimers();
    const setError = vi.fn();
    const { result } = renderHook(() => useDocumentDrafts({
      documents: [page],
      selectedDocumentId: page.id,
      setDocuments: vi.fn(),
      setError,
      persistBody: vi.fn().mockRejectedValue(new Error("offline")),
      persistTitle: vi.fn()
    }));

    act(() => {
      result.current.changeBody("Still visible");
      vi.advanceTimersByTime(650);
    });
    await act(async () => Promise.resolve());

    expect(result.current.draftBody).toBe("Still visible");
    expect(setError).toHaveBeenCalledWith("Mdez could not save this page. Your current text remains visible in the editor.");
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the hook tests to verify they fail**

Run:

```bash
npm test -- tests/unit/useDocumentDrafts.test.tsx
```

Expected: FAIL because `useDocumentDrafts` does not exist.

- [ ] **Step 3: Extract the autosave state with an explicit public interface**

Create the hook with these exact public types:

```ts
"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LatestSaveQueue } from "@/lib/latest-save-queue";
import type { Document, SaveStatus } from "@/types/content";

export const SAVE_ERROR_MESSAGE = "Mdez could not save this page. Your current text remains visible in the editor.";

type Options = {
  documents: Document[];
  selectedDocumentId: string | null;
  setDocuments: Dispatch<SetStateAction<Document[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  persistBody: (id: string, body: string) => Promise<Document>;
  persistTitle: (id: string, title: string) => Promise<Document>;
};

export type DocumentDraftController = {
  liveDocuments: Document[];
  draftBody: string;
  draftTitle: string;
  saveStatus: SaveStatus;
  changeBody: (body: string) => void;
  changeTitle: (title: string) => void;
};
```

Move `syncDraftMap` into this file. Replace the component-owned queue refs with one memoized `LatestSaveQueue` for body and one for title. Keep the existing `650ms` debounce and canonical title returned by `renameDocument`. The change methods must update both state and their corresponding refs synchronously:

```ts
function updateDraft(
  id: string,
  value: string,
  draftsRef: React.MutableRefObject<Record<string, string>>,
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>
) {
  setDrafts((current) => {
    const next = { ...current, [id]: value };
    draftsRef.current = next;
    return next;
  });
}
```

Return the selected values and status through one object:

```ts
return {
  liveDocuments,
  draftBody,
  draftTitle,
  saveStatus,
  changeBody: (body) => {
    if (selectedDocumentId) updateDraft(selectedDocumentId, body, bodyDraftsRef, setBodyDrafts);
  },
  changeTitle: (title) => {
    if (selectedDocumentId) updateDraft(selectedDocumentId, title, titleDraftsRef, setTitleDrafts);
  }
};
```

- [ ] **Step 4: Integrate the hook and delete component-owned save machinery**

In `MdezWorkspace`, replace the four draft/saving state maps, eight save refs, queue helpers, two autosave effects, and two draft handlers with:

```ts
const {
  liveDocuments,
  draftBody,
  draftTitle,
  saveStatus,
  changeBody: handleDraftBodyChange,
  changeTitle: handleDraftTitleChange
} = useDocumentDrafts({
  documents,
  selectedDocumentId,
  setDocuments,
  setError,
  persistBody: updateDocumentBody,
  persistTitle: renameDocument
});
```

Keep the existing `EditorPane`, `PreviewPane`, status, and selection props unchanged.

- [ ] **Step 5: Run unit and persistence tests**

Run:

```bash
npm test -- tests/unit/useDocumentDrafts.test.tsx tests/unit/repository.test.ts
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "persistence|Saved|Saving"
```

Expected: all selected tests PASS; failed saves retain the draft and rapid edits persist only the newest value.

- [ ] **Step 6: Commit the autosave extraction**

```bash
git add src/hooks/useDocumentDrafts.ts tests/unit/useDocumentDrafts.test.tsx src/components/mdez/MdezWorkspace.tsx
git commit -m "refactor: extract document draft autosave"
```

---

### Task 5: Extract repository-backed library orchestration

**Files:**
- Create: `src/hooks/useWorkspaceLibrary.ts`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `tests/unit/repository.test.ts`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: repository functions from `src/lib/repository.ts` and `DocumentDraftController.liveDocuments` from Task 4.
- Produces: `WorkspaceLibraryController` with content state, selection state, source state, and named mutation methods.

- [ ] **Step 1: Add a behavior test for selection continuity after refresh**

Add to the repository/workspace browser coverage:

```ts
test("content refresh keeps the selected page when it still exists", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  const title = page.getByRole("textbox", { name: "Page title" });
  await title.fill("Selection survives refresh");
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.reload();
  await clickVisibleButtonIfAvailable(page, "Edit");
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue("Selection survives refresh");
});
```

- [ ] **Step 2: Define the controller contract**

Create `src/hooks/useWorkspaceLibrary.ts` with these exports:

```ts
export type WorkspaceLibraryController = {
  folders: Folder[];
  documents: Document[];
  sources: GitHubSource[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  expandedFolderIds: Set<string>;
  selectedFolder: Folder | null;
  selectedDocument: Document | null;
  isReady: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setDocuments: Dispatch<SetStateAction<Document[]>>;
  selectFolder: (folderId: string | null) => void;
  selectDocument: (documentId: string) => void;
  toggleFolder: (folderId: string) => void;
  createBook: (parentId: string | null) => Promise<void>;
  renameBook: (folderId: string, name: string) => Promise<void>;
  deleteBook: (folderId: string) => Promise<void>;
  createPage: () => Promise<void>;
  importPages: (items: { title: string; body: string }[], folderId: string | null) => Promise<void>;
  renamePage: (documentId: string, title: string) => Promise<void>;
  movePage: (documentId: string, folderId: string | null) => Promise<void>;
  deletePage: (documentId: string) => Promise<void>;
  refreshContent: (preferredDocumentId?: string | null) => Promise<void>;
};
```

- [ ] **Step 3: Move library state and mutations without changing repository calls**

Move the existing content-loading effect, ancestor expansion helpers, `refreshContent`, and handlers for folder/page selection and CRUD into the hook. Preserve every user-facing error string exactly. Accept the GitHub import functions through the hook only if they mutate library content; keep dialog visibility and export downloads in `MdezWorkspace`.

The composition root integration must reduce to:

```ts
const library = useWorkspaceLibrary();
const drafts = useDocumentDrafts({
  documents: library.documents,
  selectedDocumentId: library.selectedDocumentId,
  setDocuments: library.setDocuments,
  setError: library.setError,
  persistBody: updateDocumentBody,
  persistTitle: renameDocument
});
```

Render props must use named controller fields, for example:

```tsx
<Sidebar
  folders={library.folders}
  documents={drafts.liveDocuments}
  selectedFolderId={library.selectedFolderId}
  selectedDocumentId={library.selectedDocumentId}
  expandedFolderIds={library.expandedFolderIds}
  error={library.error}
  onSelectFolder={library.selectFolder}
  onSelectDocument={library.selectDocument}
  onCreateFolder={library.createBook}
  onCreateDocument={library.createPage}
/>
```

- [ ] **Step 4: Run library and persistence verification**

Run:

```bash
npm test -- tests/unit/repository.test.ts tests/unit/tree.test.ts
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "selection continuity|nested folders|persistence|one open book"
```

Expected: all selected tests PASS and `MdezWorkspace.tsx` no longer owns repository CRUD implementation.

- [ ] **Step 5: Commit the library extraction**

```bash
git add src/hooks/useWorkspaceLibrary.ts src/components/mdez/MdezWorkspace.tsx tests/unit/repository.test.ts tests/e2e/mdez.spec.ts
git commit -m "refactor: isolate workspace library controller"
```

---

### Task 6: Decompose the import dialog by responsibility

**Files:**
- Create: `src/components/mdez/import/ImportDialogShell.tsx`
- Create: `src/components/mdez/import/PasteImportPanel.tsx`
- Create: `src/components/mdez/import/FileImportPanel.tsx`
- Create: `src/components/mdez/import/GitHubImportPanel.tsx`
- Modify: `src/components/mdez/ImportDialog.tsx`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Produces: `ImportDialogShell({ labelledBy, initialFocusRef, returnFocus, onClose, children })`.
- Produces: panel components that emit validated domain values through callbacks and do not call repository functions directly.
- Consumes: existing `GitHubImportSession`, folder list, import callbacks, and exact user-facing copy.

- [ ] **Step 1: Add a focused modal-shell test**

```ts
test("import dialog traps focus and returns it to its trigger", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Import markdown" }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Import markdown" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Close import dialog" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Import Paste" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
```

- [ ] **Step 2: Run it and verify the current monolith remains behaviorally green**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "traps focus"
```

Expected: PASS. This is a characterization test that protects the decomposition.

- [ ] **Step 3: Create the dialog shell**

Use this exact public type:

```tsx
type ImportDialogShellProps = {
  labelledBy: string;
  initialFocusRef: RefObject<HTMLElement | null>;
  returnFocus: () => void;
  onClose: () => void;
  children: ReactNode;
};
```

Move the current backdrop, `role="dialog"`, `aria-modal`, Escape handler, Tab/Shift+Tab focus wrapping, close button, and focus-return behavior into `ImportDialogShell`. Keep source-tab arrow-key behavior in `ImportDialog` because it coordinates which panel is active.

- [ ] **Step 4: Create source-specific panels with explicit props**

```ts
export type PasteImportPanelProps = {
  body: string;
  message: string;
  busy: boolean;
  onBodyChange: (body: string) => void;
  onSubmit: () => void;
};

export type FileImportPanelProps = {
  dragging: boolean;
  message: string;
  busy: boolean;
  onFiles: (files: FileList | File[]) => void;
  onDraggingChange: (dragging: boolean) => void;
};

export type GitHubImportPanelProps = {
  url: string;
  preview: GitHubImportSession | null;
  message: string;
  busyAction: "preview" | "github" | null;
  onUrlChange: (url: string) => void;
  onPreview: () => void;
  onImport: () => void;
};
```

Move only rendering and source-local event translation into the panels. Keep `importFiles`, GitHub preview requests, validation messages, and final callback coordination in `ImportDialog`.

- [ ] **Step 5: Verify all import paths**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "import source tabs|imports markdown|GitHub repository|traps focus"
npm test -- tests/unit/github-import.test.ts tests/unit/github.test.ts
```

Expected: all selected tests PASS and `ImportDialog.tsx` becomes a source-state coordinator rather than a 500-line modal implementation.

- [ ] **Step 6: Commit the import decomposition**

```bash
git add src/components/mdez/import src/components/mdez/ImportDialog.tsx tests/e2e/mdez.spec.ts
git commit -m "refactor: decompose markdown import dialog"
```

---

### Task 7: Consolidate tokens, typography, and workspace surfaces

**Files:**
- Create: `src/app/styles/tokens.css`
- Create: `src/app/styles/workspace.css`
- Create: `src/app/styles/markdown.css`
- Modify: `src/app/globals.css`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/ShelfPane.tsx`
- Modify: `src/components/mdez/PreviewPane.tsx`
- Modify: `src/components/mdez/Sidebar.tsx`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Produces: one semantic token source and one visual thesis: “a quiet local library organized by an exposed editorial grid, with one paper-like work surface and mode color used as navigation.”
- Consumes: Task 1 heading contract and Task 2 responsive contract.

- [ ] **Step 1: Add failing typography and elevation tests**

```ts
test("reader prose uses the reader token and only overlays receive elevation", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.getByRole("tab", { name: "Read" }).click();

  const evidence = await page.evaluate(() => {
    const prose = document.querySelector(".markdown-preview");
    const surface = document.querySelector(".workspace-surface");
    const panel = document.querySelector("main article");
    return {
      readerFamily: prose ? getComputedStyle(prose).fontFamily : "",
      surfaceShadow: surface ? getComputedStyle(surface).boxShadow : "",
      panelShadow: panel ? getComputedStyle(panel).boxShadow : ""
    };
  });

  expect(evidence.readerFamily).toContain("Shippori");
  expect(evidence.surfaceShadow).toBe("none");
  expect(evidence.panelShadow).toBe("none");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "reader prose uses the reader token"
```

Expected: FAIL because prose hardcodes Georgia and workspace surfaces use stacked shadows.

- [ ] **Step 3: Create the single token source**

Create `src/app/styles/tokens.css`:

```css
:root {
  color-scheme: light;
  --color-canvas: #fff7fc;
  --color-panel: #fff0f8;
  --color-paper: #fffdfd;
  --color-lavender: #f6edff;
  --color-ink: #2b2233;
  --color-muted: #725f7c;
  --color-rule: #ead8f0;
  --color-edit: #8053c8;
  --color-read: #177f71;
  --color-shelf: #b8487a;
  --color-on-accent: #fffdfd;
  --color-warning: #c98622;
  --color-error: #a93966;
  --font-display: var(--font-space-grotesk), "DM Sans", system-ui, sans-serif;
  --font-ui: var(--font-inter), "DM Sans", system-ui, sans-serif;
  --font-reader: var(--font-shippori), Georgia, serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --radius-control: 0.5rem;
  --radius-surface: 0.75rem;
  --topbar-h: 3rem;
  --status-h: 1.75rem;
  --sidebar-w: 15rem;
  --rail-w: 2.75rem;
}
```

Delete both existing `:root` blocks and the legacy `--font-geist`/`--font-sora` aliases.

- [ ] **Step 4: Split global CSS by responsibility**

Replace `globals.css` with the import and Tailwind entry structure:

```css
@import "./styles/tokens.css";
@import "./styles/workspace.css";
@import "./styles/markdown.css";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

Move shell/grid/controls/surfaces/status/TOC/Split rules into `workspace.css`. Move `.markdown-preview` and `.editor-frame` rules into `markdown.css`. Use `var(--font-reader)` for `.markdown-preview` and `var(--font-display)` for headings.

- [ ] **Step 5: Replace nested elevation with rules and one paper surface**

Use this surface contract in `workspace.css`:

```css
.workspace-main { padding: var(--space-4); }

.workspace-surface {
  min-height: 100%;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-surface);
  background: color-mix(in srgb, var(--color-paper) 94%, transparent);
  box-shadow: none;
  padding: var(--space-4);
}

.workspace-section {
  min-width: 0;
  border: 0;
  border-top: 1px solid var(--color-rule);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding-block: var(--space-5);
}

.workspace-section:first-child { border-top: 0; }

.floating-surface {
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-surface);
  background: var(--color-paper);
  box-shadow: 0 18px 46px rgb(83 45 92 / 16%);
}
```

Apply `workspace-section` to Shelf sections and remove their Tailwind border/radius/shadow utilities. Keep `floating-surface` only on the drawer, import dialog, and TOC.

- [ ] **Step 6: Make one document title dominant**

In `MdezWorkspace`, render the visible `h1` only for Shelf mode. For document modes, render a compact breadcrumb with the book name and current mode:

```tsx
<div className="workspace-context">
  <p className="workspace-context-label">
    {selectedFolder ? `${selectedFolder.name} book` : "Shelf root"}
  </p>
  {showShelf ? <h1 className="workspace-title">Bookshelf</h1> : null}
</div>
```

In `PreviewPane`, promote the document title to the only visible workspace-level heading:

```tsx
<h1 className="reader-document-title">{title}</h1>
```

In Edit mode, keep the title input visually dominant and add a screen-reader heading immediately before its label:

```tsx
<h1 className="sr-only">Edit {title}</h1>
```

- [ ] **Step 7: Run visual-contract tests**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "reader prose uses the reader token|workspace-level document heading|renewed light library shell|preview prose"
npm run lint
npm run typecheck
```

Expected: all selected tests, lint, and typecheck PASS.

- [ ] **Step 8: Commit the design-system consolidation**

```bash
git add src/app/globals.css src/app/styles src/components/mdez/MdezWorkspace.tsx src/components/mdez/ShelfPane.tsx src/components/mdez/PreviewPane.tsx src/components/mdez/Sidebar.tsx tests/e2e/mdez.spec.ts
git commit -m "style: establish editorial workspace system"
```

---

### Task 8: Build a touch-safe editor toolbar

**Files:**
- Create: `src/components/mdez/EditorToolbar.tsx`
- Modify: `src/components/mdez/EditorPane.tsx`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Produces: `EditorToolbar({ onFormat, actions })`.
- Consumes: the existing eight `FormatAction` values and export controls supplied by `EditorPane.rightSlot`.

- [ ] **Step 1: Define and implement the toolbar component**

```tsx
import type { ReactNode } from "react";

export type FormatAction = "bold" | "italic" | "link" | "image" | "code" | "h1" | "h2" | "divider";

const actions: { action: FormatAction; label: string; glyph: string }[] = [
  { action: "bold", label: "Bold", glyph: "B" },
  { action: "italic", label: "Italic", glyph: "I" },
  { action: "link", label: "Insert link", glyph: "↗" },
  { action: "image", label: "Insert image", glyph: "▧" },
  { action: "code", label: "Code", glyph: "</>" },
  { action: "h1", label: "Heading 1", glyph: "H1" },
  { action: "h2", label: "Heading 2", glyph: "H2" },
  { action: "divider", label: "Divider", glyph: "---" }
];

type EditorToolbarProps = {
  onFormat: (action: FormatAction) => void;
  documentActions?: ReactNode;
};

export function EditorToolbar({ onFormat, documentActions }: EditorToolbarProps) {
  return (
    <div role="toolbar" aria-label="Markdown toolbar" className="editor-toolbar">
      <div className="editor-format-actions">
        {actions.map((item) => (
          <button
            key={item.action}
            type="button"
            aria-label={item.label}
            title={item.label}
            onClick={() => onFormat(item.action)}
            className="workspace-icon-button font-mono text-xs font-bold"
          >
            {item.glyph}
          </button>
        ))}
      </div>
      <div className="editor-document-actions">{documentActions}</div>
    </div>
  );
}
```

- [ ] **Step 2: Compose it from `EditorPane`**

Export `FormatAction` from `EditorToolbar`, remove the local toolbar array, retain `applyFormat` unchanged, and replace the toolbar JSX with:

```tsx
<EditorToolbar onFormat={applyFormat} documentActions={rightSlot} />
```

- [ ] **Step 3: Add responsive toolbar geometry**

```css
.editor-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: var(--space-2);
  margin-top: var(--space-3);
  border-top: 1px solid var(--color-rule);
  border-bottom: 1px solid var(--color-rule);
  padding-block: var(--space-2);
}

.editor-format-actions {
  display: flex;
  min-width: 0;
  gap: var(--space-1);
  overflow-x: auto;
}

.editor-document-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

@media (max-width: 767px) {
  .workspace-icon-button { width: 2.75rem; height: 2.75rem; }
  .editor-toolbar { grid-template-columns: minmax(0, 1fr); }
  .editor-document-actions { grid-row: 1; justify-content: flex-end; }
  .editor-format-actions { grid-row: 2; }
}
```

- [ ] **Step 4: Run toolbar verification**

Run:

```bash
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "mobile editor|renewed markdown toolbar|exports the selected document"
```

Expected: all selected tests PASS; export actions are initially visible and every mobile formatting target is at least 44px square.

- [ ] **Step 5: Commit the toolbar**

```bash
git add src/components/mdez/EditorToolbar.tsx src/components/mdez/EditorPane.tsx src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "feat: add touch safe markdown toolbar"
```

---

### Task 9: Lazy-load mode-heavy workspace code

**Files:**
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `tests/unit/production-readiness.test.tsx`

**Interfaces:**
- Consumes: named exports `EditorPane`, `PreviewPane`, and `ImportDialog`.
- Produces: client-only dynamic boundaries with accessible loading text.

- [ ] **Step 1: Add source-level readiness assertions**

Extend `production-readiness.test.tsx`:

```tsx
it("keeps editor, reader, and import features behind dynamic boundaries", () => {
  const workspace = readFileSync(resolve(process.cwd(), "src/components/mdez/MdezWorkspace.tsx"), "utf8");
  expect(workspace).toMatch(/dynamic\(\s*\(\) => import\("@\/components\/mdez\/EditorPane"\)/);
  expect(workspace).toMatch(/dynamic\(\s*\(\) => import\("@\/components\/mdez\/PreviewPane"\)/);
  expect(workspace).toMatch(/dynamic\(\s*\(\) => import\("@\/components\/mdez\/ImportDialog"\)/);
});
```

- [ ] **Step 2: Run the readiness test to verify it fails**

Run:

```bash
npm test -- tests/unit/production-readiness.test.tsx
```

Expected: FAIL because all three modules are statically imported.

- [ ] **Step 3: Add named dynamic imports**

```tsx
import dynamic from "next/dynamic";

const EditorPane = dynamic(
  () => import("@/components/mdez/EditorPane").then((module) => module.EditorPane),
  { ssr: false, loading: () => <p role="status">Loading editor…</p> }
);
const PreviewPane = dynamic(
  () => import("@/components/mdez/PreviewPane").then((module) => module.PreviewPane),
  { ssr: false, loading: () => <p role="status">Loading reader…</p> }
);
const ImportDialog = dynamic(
  () => import("@/components/mdez/ImportDialog").then((module) => module.ImportDialog),
  { ssr: false }
);
```

Remove the corresponding static imports. Do not dynamically load the shell, sidebar, shelf, or status because they define initial workspace comprehension.

- [ ] **Step 4: Run production and mode verification**

Run:

```bash
npm test -- tests/unit/production-readiness.test.tsx
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "switches editor|imports markdown|table of contents"
npm run build
```

Expected: tests and build PASS; the `/` First Load JS value is lower than the reviewed 489 kB baseline.

- [ ] **Step 5: Commit the loading boundaries**

```bash
git add src/components/mdez/MdezWorkspace.tsx tests/unit/production-readiness.test.tsx
git commit -m "perf: lazy load workspace mode features"
```

---

### Task 10: Complete cross-viewport and release verification

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Modify: `docs/uxui_improve/mdez_ux_review.md`

**Interfaces:**
- Consumes: all preceding task outputs.
- Produces: one release gate covering every mode at mobile, tablet, laptop, and desktop widths.

- [ ] **Step 1: Replace the Shelf-only overflow loop with a mode matrix**

```ts
for (const width of [390, 430, 768, 1024, 1440]) {
  for (const mode of ["Shelf", "Edit", "Read", "Split"] as const) {
    test(`${mode} remains usable without document overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      if (mode !== "Shelf") {
        await page.getByRole("button", { name: "Create page", exact: true }).last().click();
      }
      await page.getByRole("tab", { name: mode }).click();

      const size = await page.evaluate(() => [
        document.documentElement.clientWidth,
        document.documentElement.scrollWidth
      ]);
      expect(size[1]).toBe(size[0]);
      await expect(page.getByRole("main")).toBeVisible();
    });
  }
}
```

- [ ] **Step 2: Add a real mobile pointer-resize test**

```ts
test("mobile split separator responds to vertical pointer movement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();
  await page.getByRole("tab", { name: "Split" }).click();

  const separator = page.getByRole("separator", { name: "Resize editor and reader panes" });
  const box = await separator.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 100);
  await page.mouse.up();
  await expect(separator).not.toHaveAttribute("aria-valuenow", "50");
});
```

- [ ] **Step 3: Run the complete automated gate**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Expected:

- lint exits `0` with no warnings;
- typecheck exits `0`;
- all unit tests pass;
- all desktop/mobile browser tests pass across the new mode matrix;
- the production build completes and reports First Load JS below 489 kB for `/`.

- [ ] **Step 4: Perform rendered review at five widths**

Inspect `390x844`, `430x932`, `768x1024`, `1024x900`, and `1440x900`. At each width verify:

```text
Shelf: one clear workspace title, rule-based sections, no nested elevation.
Edit: title field dominates, export actions visible, formatting reachable.
Read: one visible document title, Shippori prose, readable measure.
Split: panes are at least 30%, separator matches its visual axis, no clipped headings.
Drawer: background surfaces inert, Escape closes, focus returns to trigger.
Status: save state, page name, and Local remain readable without covering content.
```

- [ ] **Step 5: Record resolved evidence in the UX review**

Append this resolution table to `docs/uxui_improve/mdez_ux_review.md`:

```markdown
## Workspace quality redesign resolution — 2026-07-14

| Reviewed issue | Resolution evidence |
|---|---|
| 768px Split breakpoint cliff | Tablet Split test and rendered 768×1024 inspection |
| Mobile separator rejected touch | Mobile pointer-resize Playwright test |
| Nested cards flattened hierarchy | Surface-shadow contract and rendered Shelf/Read inspection |
| Repeated document identity | Single-H1 Read contract |
| Mobile toolbar targets and hidden exports | 44px target and viewport-containment tests |
| Typography token drift | Computed Shippori reader-family test |
| Oversized workspace coordinator | Draft and library hooks with focused unit tests |
| Monolithic import dialog | Shell and source panels protected by import E2E coverage |
| Heavy initial JavaScript | Production build comparison against 489 kB baseline |
```

- [ ] **Step 6: Commit the release gate and evidence**

```bash
git add tests/e2e/mdez.spec.ts docs/uxui_improve/mdez_ux_review.md
git commit -m "test: complete workspace quality release gate"
```

---

## Completion Criteria

- `MdezWorkspace.tsx` is a composition root rather than the owner of autosave and repository implementation details.
- Autosave queue behavior is unit-tested for supersession, rejection, recovery, and rapid edits.
- Import dialog focus and every import source retain existing behavior through focused components.
- At 768px and 1024px, the shelf is a drawer and Split uses vertically stacked full-width panes.
- Mobile Split supports touch and keyboard resizing.
- Mobile toolbar targets are at least 44px and export actions are visible without horizontal discovery.
- Reader prose uses `--font-reader`; code remains monospaced.
- The workspace uses one paper surface, quiet rules, and shadows only for floating UI.
- Each mode presents one dominant document identity.
- All lint, typecheck, unit, browser, and production-build checks pass.
- Production First Load JS for `/` is lower than the reviewed 489 kB baseline.

