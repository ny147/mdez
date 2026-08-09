# Mdez First-Load Workspace Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Mdez first-load workspace's accessibility, typography, spacing, and responsive behavior while preserving its current brand palette and all workspace functionality.

**Architecture:** Keep `MdezWorkspace`, `ShelfPane`, `DocumentList`, and `WorkspaceStatus` in their current presentation and coordination roles. Add one pure relative-time formatter under `src/lib`, then make focused semantic and CSS changes without altering persistence, imports, exports, editor, reader, split, or GitHub data flow.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, semantic CSS with Tailwind utilities, Vitest 2, Playwright 1.49.

## Global Constraints

- `/` continues to open directly into the working Mdez workspace.
- Preserve the existing values of `--color-canvas`, `--color-panel`, `--color-paper`, `--color-lavender`, `--color-ink`, `--color-muted`, `--color-rule`, `--color-edit`, `--color-read`, and `--color-shelf`.
- Do not add a hero, marketing copy, account flow, onboarding wizard, route, API, runtime dependency, or data-model change.
- Preserve Shelf, Edit, Read, Split, IndexedDB persistence, imports, exports, GitHub integration, drawer behavior, split resizing, editor actions, reader behavior, and the single polite status region.
- Keep Book ZIP visible and disabled when no book is open, with its prerequisite discoverable.
- Maintain WCAG AA text contrast, visible focus, keyboard access, inert overlays, reduced motion, 44px mobile targets, and zero document-level horizontal overflow.
- Use test-driven development: add each behavioral test first, run it and confirm the expected failure, then write the smallest implementation that makes it pass.
- Use existing font families, radii, borders, and mode-color meanings.

## File Responsibility Map

- Create `src/lib/relative-time.ts`: pure shared relative-time formatting with deterministic test input.
- Create `tests/unit/relative-time.test.ts`: formatter boundaries and invalid/future-value behavior.
- Modify `src/components/mdez/DocumentList.tsx`: render a human-readable updated label instead of an ISO timestamp.
- Modify `src/components/mdez/ShelfPane.tsx`: consume the shared formatter, clarify headings and copy, and expose stable layout classes.
- Modify `src/components/mdez/MdezWorkspace.tsx`: expose workspace modes as pressed-state buttons instead of incomplete tabs.
- Modify `src/app/styles/workspace.css`: style pressed mode states, legible compact text, descending headings, and responsive Shelf action geometry.
- Modify `tests/e2e/mdez.spec.ts`: update mode helpers and cover semantics, contrast, typography, copy, timestamp formatting, hierarchy, action geometry, and overflow.

---

### Task 1: Share Human-Readable Relative Time

**Files:**

- Create: `src/lib/relative-time.ts`
- Create: `tests/unit/relative-time.test.ts`
- Modify: `src/components/mdez/ShelfPane.tsx:20-44,167-182`
- Modify: `src/components/mdez/DocumentList.tsx:100-108`
- Modify: `tests/e2e/mdez.spec.ts` near the fresh-workspace tests

**Interfaces:**

- Consumes: ISO-compatible `Document.updatedAt: string` values and an optional epoch-millisecond `now` value.
- Produces: `formatRelativeTime(value: string, now?: number): string`, returning `recently`, `[N] min ago`, `[N] hr ago`, `[N] day ago`, or `[N] days ago`.

- [ ] **Step 1: Write the failing formatter unit tests**

Create `tests/unit/relative-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/relative-time";

const now = Date.parse("2026-08-09T12:00:00.000Z");

describe("formatRelativeTime", () => {
  it("formats minute, hour, and day boundaries", () => {
    expect(formatRelativeTime("2026-08-09T11:59:20.000Z", now)).toBe("1 min ago");
    expect(formatRelativeTime("2026-08-09T11:30:00.000Z", now)).toBe("30 min ago");
    expect(formatRelativeTime("2026-08-09T10:00:00.000Z", now)).toBe("2 hr ago");
    expect(formatRelativeTime("2026-08-08T12:00:00.000Z", now)).toBe("1 day ago");
    expect(formatRelativeTime("2026-08-06T12:00:00.000Z", now)).toBe("3 days ago");
  });

  it("uses a neutral label for invalid and future values", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("recently");
    expect(formatRelativeTime("2026-08-10T12:00:00.000Z", now)).toBe("recently");
  });
});
```

- [ ] **Step 2: Run the unit test and confirm the missing-module failure**

Run:

```powershell
npm test -- tests/unit/relative-time.test.ts
```

Expected: FAIL because `@/lib/relative-time` does not exist.

- [ ] **Step 3: Implement the minimal formatter**

Create `src/lib/relative-time.ts`:

```ts
export function formatRelativeTime(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp) || timestamp > now) {
    return "recently";
  }

  const diffMinutes = Math.max(1, Math.round((now - timestamp) / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}
```

- [ ] **Step 4: Run the formatter tests and confirm they pass**

Run:

```powershell
npm test -- tests/unit/relative-time.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Add a failing browser assertion for sidebar timestamps**

Add this test to `tests/e2e/mdez.spec.ts` after `fresh workspace exposes visible create and import actions`:

```ts
test("sidebar uses human-readable page timestamps", async ({ page }) => {
  await page.getByRole("button", { name: "Create page", exact: true }).last().click();

  const pageCard = page
    .getByRole("complementary", { name: "Library shelf" })
    .locator("article")
    .filter({ hasText: "untitled.md" });
  const updatedLabel = pageCard.locator("button[aria-pressed] span").nth(1);

  await expect(updatedLabel).toHaveText(/^Updated (recently|\d+ (min|hr|day|days) ago)$/);
  await expect(updatedLabel).not.toHaveText(/^\d{4}-\d{2}-\d{2}T/);
});
```

- [ ] **Step 6: Run the timestamp browser test and confirm the raw-ISO failure**

Run:

```powershell
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "sidebar uses human-readable page timestamps"
```

Expected: FAIL because `DocumentList` renders `document.updatedAt` directly.

- [ ] **Step 7: Integrate the shared formatter**

In `ShelfPane.tsx`, import the formatter and delete its local `formatRelativeTime` function:

```ts
import { formatRelativeTime } from "@/lib/relative-time";
```

Keep the existing call inside the recent-page card:

```ts
const updated = formatRelativeTime(document.updatedAt);
```

In `DocumentList.tsx`, import the same formatter:

```ts
import { formatRelativeTime } from "@/lib/relative-time";
```

Replace the raw timestamp span with:

```tsx
<span className="document-updated-label mt-1 block truncate font-semibold opacity-70">
  Updated {formatRelativeTime(document.updatedAt)}
</span>
```

- [ ] **Step 8: Run targeted formatter and browser tests**

Run:

```powershell
npm test -- tests/unit/relative-time.test.ts
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "sidebar uses human-readable page timestamps"
```

Expected: both commands exit 0.

- [ ] **Step 9: Commit Task 1**

```powershell
git add src/lib/relative-time.ts tests/unit/relative-time.test.ts src/components/mdez/ShelfPane.tsx src/components/mdez/DocumentList.tsx tests/e2e/mdez.spec.ts
git commit -m "fix: clarify workspace update times"
```

---

### Task 2: Correct Mode Semantics and Compact Typography

**Files:**

- Modify: `tests/e2e/mdez.spec.ts:5-56,120-145`
- Modify: `src/components/mdez/MdezWorkspace.tsx:333-345,455-469`
- Modify: `src/app/styles/workspace.css:258-310,372-388,520-550,627-642`

**Interfaces:**

- Consumes: the existing `viewMode: ViewMode` state and `handleViewModeChange(nextMode)` handler.
- Produces: native mode buttons with `aria-pressed="true|false"`, existing palette roles for compliant selected text, and 13px minimum text on status, mobile modes, and update labels.

- [ ] **Step 1: Update E2E helpers to express the desired button contract**

Replace `showShelfIfAvailable` with:

```ts
async function showShelfIfAvailable(page: import("@playwright/test").Page) {
  const navigations = page.getByRole("navigation", { name: "Workspace modes" });

  for (let index = 0; index < await navigations.count(); index += 1) {
    const shelfButton = navigations.nth(index).getByRole("button", { name: "Shelf", exact: true });

    if (await shelfButton.isVisible().catch(() => false)) {
      await shelfButton.click();
      await expect(shelfButton).toHaveAttribute("aria-pressed", "true");
      return;
    }
  }
}
```

Replace `clickVisibleButtonIfAvailable` with:

```ts
async function clickVisibleButtonIfAvailable(page: import("@playwright/test").Page, name: string) {
  const controls = page.getByRole("button", { name, exact: true });

  for (let index = 0; index < await controls.count(); index += 1) {
    const control = controls.nth(index);

    if (await control.isVisible().catch(() => false)) {
      await control.click();
      return;
    }
  }
}
```

Replace `clickViewportModeTab` with `clickViewportModeButton`:

```ts
async function clickViewportModeButton(page: import("@playwright/test").Page, name: string) {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  const navigation = page.locator(viewportWidth <= 767 ? ".mobile-mode-nav" : ".workspace-mode-nav");
  const control = navigation.getByRole("button", { name, exact: true });

  if ((await control.getAttribute("aria-pressed")) !== "true") {
    await control.click();
  }
  await expect(control).toHaveAttribute("aria-pressed", "true");
}
```

Mechanically rename every `clickViewportModeTab(...)` call in the file to `clickViewportModeButton(...)`.

- [ ] **Step 2: Add failing semantics, contrast, and compact-type tests**

Add after `uses the renewed light library shell and mode accents`:

```ts
test("workspace modes use pressed button semantics", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const navigation = page.locator(width <= 767 ? ".mobile-mode-nav" : ".workspace-mode-nav");
    const shelf = navigation.getByRole("button", { name: "Shelf", exact: true });
    await expect(shelf).toHaveAttribute("aria-pressed", "true");
    await expect(navigation.getByRole("tab")).toHaveCount(0);
  }
});

test("selected mobile mode text meets compact-text contrast", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const shelf = page.locator(".mobile-mode-nav").getByRole("button", { name: "Shelf", exact: true });

  const contrast = await shelf.evaluate((node) => {
    const parse = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = ([red, green, blue]: number[]) => {
      const channels = [red, green, blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const style = getComputedStyle(node);
    const foreground = luminance(parse(style.color));
    const background = luminance(parse(style.backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });

  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test("compact workspace labels remain at least 13 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sizes = await page.evaluate(() => ({
    status: Number.parseFloat(getComputedStyle(document.querySelector(".workspace-status")!).fontSize),
    mode: Number.parseFloat(getComputedStyle(document.querySelector(".mobile-mode-button")!).fontSize)
  }));

  expect(sizes.status).toBeGreaterThanOrEqual(13);
  expect(sizes.mode).toBeGreaterThanOrEqual(13);
});
```

- [ ] **Step 3: Run the new tests and confirm their expected failures**

Run:

```powershell
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "pressed button semantics|compact-text contrast|compact workspace labels"
```

Expected: FAIL because the controls expose `role="tab"`, selected mobile text uses the mode accent, and compact labels render at 12px.

- [ ] **Step 4: Implement pressed-state mode buttons**

In both desktop and mobile mode maps in `MdezWorkspace.tsx`, replace:

```tsx
role="tab"
aria-selected={viewMode === option.value}
```

with:

```tsx
aria-pressed={viewMode === option.value}
```

Keep the existing button type, click handler, labels, icons, navigation landmarks, and mode order.

- [ ] **Step 5: Update mode-state and compact typography CSS**

In `workspace.css`, rename both selected selectors:

```css
.workspace-mode-button[aria-pressed="true"] {
  border-color: transparent;
  border-bottom-color: var(--mode-accent);
  background: color-mix(in srgb, var(--mode-accent) 8%, transparent);
  color: var(--color-ink);
}

.mobile-mode-button[aria-pressed="true"] {
  border-color: color-mix(in srgb, var(--mode-accent) 32%, var(--color-rule));
  background: color-mix(in srgb, var(--mode-accent) 10%, var(--color-paper));
  color: var(--color-ink);
}
```

Set the exact compact type rules:

```css
.workspace-status {
  font-size: 0.8125rem;
  line-height: 1.2;
}

.document-updated-label {
  font-size: 0.8125rem;
}

@media (max-width: 767px) {
  .mobile-mode-button {
    font-size: 0.8125rem;
    line-height: 1.2;
  }
}
```

Remove the redundant `.workspace-shell [role="tab"]` selector from the mobile touch-target rule because the controls remain native buttons.

- [ ] **Step 6: Run targeted semantics, contrast, typography, and existing mode tests**

Run:

```powershell
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "pressed button semantics|compact-text contrast|compact workspace labels|workspace mode|mobile editor|h1 hierarchy|reader prose"
```

Expected: all selected tests pass.

- [ ] **Step 7: Commit Task 2**

```powershell
git add src/components/mdez/MdezWorkspace.tsx src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "fix: improve workspace mode accessibility"
```

---

### Task 3: Clarify Shelf Hierarchy and Responsive Actions

**Files:**

- Modify: `tests/e2e/mdez.spec.ts:185-240,310-335`
- Modify: `src/components/mdez/ShelfPane.tsx:65-185`
- Modify: `src/app/styles/workspace.css` near `.workspace-section` and responsive rules

**Interfaces:**

- Consumes: existing Shelf action handlers, `openBook`, `sortedFolders`, `visiblePages`, `isReady`, and existing button components/classes.
- Produces: stable `.shelf-command-bar`, `.shelf-guidance`, `.shelf-primary-actions`, and `.workspace-section-title` hooks; `Books` and `Recent pages` headings; exact grouping guidance; one-column mobile, two-column 768px to 1199px, and one-row 1200px-plus action layout.

- [ ] **Step 1: Update existing copy assertions and add failing hierarchy tests**

In `fresh workspace exposes visible create and import actions`, replace the old guidance expectation with:

```ts
await expect(page.getByText("Create a book to group related pages.").last()).toBeVisible();
```

In `one open book controls shelf context`, replace the list assertion with:

```ts
await expect(page.getByRole("list", { name: "Recent pages" }).getByRole("listitem")).toHaveCount(1);
```

Add after the existing H1 hierarchy test:

```ts
test("shelf uses a descending non-repeating heading hierarchy", async ({ page }) => {
  const main = page.getByRole("main");
  const pageTitle = main.getByRole("heading", { level: 1, name: "Bookshelf" });
  const books = main.getByRole("heading", { level: 2, name: "Books" });
  const recent = main.getByRole("heading", { level: 2, name: "Recent pages" });

  await expect(pageTitle).toBeVisible();
  await expect(books).toBeVisible();
  await expect(recent).toBeVisible();
  await expect(main.getByRole("heading", { level: 2, name: "Bookshelf" })).toHaveCount(0);

  const hierarchy = await page.evaluate(() => {
    const h1 = document.querySelector<HTMLElement>(".workspace-title")!;
    const h2 = document.querySelector<HTMLElement>(".workspace-section-title")!;
    const h1Style = getComputedStyle(h1);
    const h2Style = getComputedStyle(h2);
    return {
      h1Size: Number.parseFloat(h1Style.fontSize),
      h2Size: Number.parseFloat(h2Style.fontSize),
      h1Weight: Number.parseInt(h1Style.fontWeight, 10),
      h2Weight: Number.parseInt(h2Style.fontWeight, 10)
    };
  });

  expect(hierarchy.h1Size).toBeGreaterThan(hierarchy.h2Size);
  expect(hierarchy.h1Weight).toBeGreaterThan(hierarchy.h2Weight);
});
```

- [ ] **Step 2: Add a failing tablet action-geometry test**

Add:

```ts
test("tablet shelf actions form a readable two-by-two grid", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  const actions = page.locator(".shelf-primary-actions");
  const buttons = actions.getByRole("button");
  await expect(buttons).toHaveCount(4);

  const geometry = await buttons.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { x: Math.round(rect.x), y: Math.round(rect.y), whiteSpace: style.whiteSpace };
    })
  );

  expect(new Set(geometry.map(({ x }) => x)).size).toBe(2);
  expect(new Set(geometry.map(({ y }) => y)).size).toBe(2);
  expect(geometry.every(({ whiteSpace }) => whiteSpace === "nowrap")).toBe(true);
});
```

- [ ] **Step 3: Run the new Shelf tests and confirm the expected failures**

Run:

```powershell
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "fresh workspace|one open book|non-repeating heading|two-by-two grid"
```

Expected: FAIL on the old copy, `Bookmarked pages`, the repeated `Bookshelf` H2, missing stable classes, or tablet geometry.

- [ ] **Step 4: Implement exact Shelf copy and heading changes**

In `ShelfPane.tsx`:

- Change the open-book guidance to `${openBook.name} is open. Recent pages are filtered to this book.`
- Change the first section heading from `Bookshelf` to `Books`.
- Replace the empty-bookshelf sentence with `Create a book to group related pages.`
- Rename `bookmarked-pages-title` to `recent-pages-title`.
- Change the visible heading and list accessible name from `Bookmarked pages` to `Recent pages`.
- Change recent-page timestamp styling from `text-xs` to `text-[0.8125rem]`.
- Apply `workspace-section-title` to both section headings and remove `text-xl font-black`.

Use these structural classes for the command area:

```tsx
<div className="shelf-command-bar">
  <p className="shelf-guidance text-sm font-semibold leading-6 text-muted">...</p>
  <div className="shelf-primary-actions">...</div>
</div>
```

Keep every existing handler, label, disabled state, title, icon, and button style.

- [ ] **Step 5: Implement exact Shelf layout and heading CSS**

Add near `.workspace-section`:

```css
.workspace-section-title {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 650;
  line-height: 1.2;
  text-wrap: balance;
}

.shelf-command-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.shelf-guidance {
  max-width: 65ch;
  text-wrap: pretty;
}

.shelf-primary-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-2);
}

.shelf-primary-actions > button {
  width: 100%;
  white-space: nowrap;
}

@media (min-width: 768px) and (max-width: 1199px) {
  .shelf-primary-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .shelf-command-bar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .shelf-primary-actions {
    grid-auto-flow: column;
    grid-template-columns: repeat(4, max-content);
  }
}
```

- [ ] **Step 6: Run targeted Shelf, hierarchy, responsive, and overflow tests**

Run:

```powershell
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "fresh workspace|one open book|non-repeating heading|two-by-two grid|horizontal overflow|root selection"
```

Expected: all selected tests pass at their configured widths.

- [ ] **Step 7: Commit Task 3**

```powershell
git add src/components/mdez/ShelfPane.tsx src/app/styles/workspace.css tests/e2e/mdez.spec.ts
git commit -m "fix: refine responsive shelf hierarchy"
```

---

### Task 4: Full Verification and Visual Review

**Files:**

- Verify: all modified files from Tasks 1 through 3
- Inspect: `src/app/styles/tokens.css`
- Inspect: live route `/` at desktop, tablet, and mobile widths

**Interfaces:**

- Consumes: the complete implementation from Tasks 1 through 3.
- Produces: fresh evidence that the branch preserves brand values, passes automated checks, and renders correctly at the required viewports.

- [ ] **Step 1: Verify brand token values did not change**

Run:

```powershell
git diff 1b94cad -- src/app/styles/tokens.css
```

Expected: no output.

- [ ] **Step 2: Run the full unit suite**

Run:

```powershell
npm test
```

Expected: exit 0 with no failed tests.

- [ ] **Step 3: Run lint and typecheck**

Run:

```powershell
npm run lint
npm run typecheck
```

Expected: both commands exit 0 without warnings or type errors.

- [ ] **Step 4: Run the production build**

Run:

```powershell
npm run build
```

Expected: exit 0 and a successful Next.js production build.

- [ ] **Step 5: Run the full Playwright suite**

Run:

```powershell
npm run test:e2e
```

Expected: exit 0 with no failed browser tests.

- [ ] **Step 6: Run the Impeccable deterministic scan**

Run:

```powershell
node .claude/skills/impeccable/scripts/detect.mjs --json src/components/mdez src/app
```

Expected: no new findings in modified files. The existing `side-tab` warning on the semantic Markdown blockquote at `src/app/styles/markdown.css:61` may remain and must be reported as the previously reviewed false positive.

- [ ] **Step 7: Inspect the live page at representative viewports**

Use the existing local development server and the in-app Browser to inspect:

- 1440×900: single-row actions, sidebar, hierarchy, status, and mode selection.
- 768×900: two-by-two Shelf actions with single-line labels and no horizontal overflow.
- 390×844: stacked actions, drawer, 44px mode targets, legible 13px labels, status bar, and no horizontal overflow.

At each viewport, confirm selected mode text uses existing ink, brand surfaces retain berry/lavender/mint roles, headings do not overflow, and no content is clipped.

- [ ] **Step 8: Review the final branch diff**

Run:

```powershell
git diff 1b94cad --check
git diff 1b94cad --stat
git status --short --branch
```

Expected: no whitespace errors; only the planned source, test, and plan files are tracked changes; generated `.claude`, `.codex`, and `.impeccable` artifacts remain unstaged.
