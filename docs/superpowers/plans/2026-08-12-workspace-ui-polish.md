# Workspace UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the shared Local Library and Key Group workspace hierarchy, contrast, mode discoverability, long-title legibility, and icon-action tooltips without changing domain behavior.

**Architecture:** Keep the current shared workspace components and semantic CSS system. Express CTA hierarchy and long-title behavior through focused component classes and attributes, strengthen navigation and sidebar states in `workspace.css`, and use the existing `IconButton` contract or equivalent `aria-label` plus `title` attributes for icon-only actions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS plus semantic CSS, Playwright, Vitest.

## Global Constraints

- Preserve the quiet pastel library identity and the existing single pale top bar.
- Shelf page creation is primary; the sidebar page-creation shortcut is secondary.
- Preserve all Key Group creation, joining, refresh, permission, key handling, conflict, API, and persistence behavior.
- Do not add dependencies, routes, global state, workspace modes, animations, or a tooltip library.
- Maintain WCAG AA contrast, visible focus, semantic names, and no horizontal overflow at 390, 430, 768, 1024, and 1440 pixels.
- Run the Impeccable detector exactly once after UI editing is complete.

---

### Task 1: Lock the shared workspace polish contract

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: the rendered workspace at `/`, existing helpers in `tests/e2e/mdez.spec.ts`, and IndexedDB-backed page creation.
- Produces: regression coverage for CTA hierarchy, mode affordance, long localized titles, and icon-only tooltip names.

- [ ] **Step 1: Add a failing CTA and tab affordance test**

Add a Playwright test that:

```ts
test("workspace polish distinguishes primary actions and active modes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  const shelfCreate = page.getByRole("main").getByRole("button", { name: "Create page", exact: true });
  const sidebarCreate = page.getByRole("complementary", { name: "Library shelf" })
    .getByRole("button", { name: /Create page.*from page list/ });

  await expect(shelfCreate).toHaveAttribute("data-visual-priority", "primary");
  await expect(sidebarCreate).toHaveAttribute("data-visual-priority", "secondary");

  const shelfTab = page.getByRole("tab", { name: "Shelf", exact: true }).first();
  await expect(shelfTab).toHaveAttribute("data-active-treatment", "filled");
  const style = await shelfTab.evaluate((node) => {
    const computed = getComputedStyle(node);
    return { background: computed.backgroundColor, border: computed.borderColor };
  });
  expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(style.border).not.toBe("rgba(0, 0, 0, 0)");
});
```

This catches regression to two equally prominent creation actions or an underline-only selected mode.

- [ ] **Step 2: Add a failing localized-title and tooltip test**

Create a page, set its title to a representative Thai string such as `เฉลย EGAT Aptitude Test สำหรับเตรียมสอบฉบับสมบูรณ์`, return to Shelf, open the library sidebar, and assert:

```ts
const title = "เฉลย EGAT Aptitude Test สำหรับเตรียมสอบฉบับสมบูรณ์";
const sidebarTitle = sidebar.getByTitle(title);
await expect(sidebarTitle).toHaveCSS("-webkit-line-clamp", "2");
await expect(sidebarTitle).toHaveAttribute("title", title);

for (const name of ["Toggle sidebar", "Shared links"]) {
  await expect(page.getByRole("button", { name })).toHaveAttribute("title", name);
}
```

Also assert `document.documentElement.scrollWidth === document.documentElement.clientWidth` at 390 and 1280 pixels after the long title is rendered. This catches loss of complete-title discovery or localized overflow.

- [ ] **Step 3: Run the new tests and verify RED**

Run:

```powershell
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "workspace polish"
```

Expected: FAIL because the priority and active-treatment data contracts, two-line title clamp, and topbar tooltip titles do not yet exist.

- [ ] **Step 4: Commit the failing tests**

```powershell
git add tests/e2e/mdez.spec.ts
git commit -m "test: define workspace polish contract"
```

---

### Task 2: Implement hierarchy, legibility, and tooltip polish

**Files:**
- Modify: `src/app/styles/workspace.css`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/DocumentList.tsx`
- Modify: `src/components/mdez/ShelfPane.tsx`

**Interfaces:**
- Consumes: current `primary-button`, `secondary-button`, `workspace-mode-button`, `mobile-mode-button`, and `workspace-icon-button` classes.
- Produces: `data-visual-priority="primary|secondary"`, `data-active-treatment="filled"`, reusable `.sidebar-create-button`, and `.page-title-clamp` presentation contracts.

- [ ] **Step 1: Load the Impeccable craft floor**

Read `C:\Users\Neary\.agents\skills\impeccable\reference\craft-floor.md` completely immediately before editing UI, and apply its quality constraints to every touched surface.

- [ ] **Step 2: Implement the page-creation hierarchy**

In `ShelfPane.tsx`, mark the Shelf command as primary:

```tsx
<button
  type="button"
  data-visual-priority="primary"
  onClick={onCreateDocument}
  aria-label={createPageLabel}
  className="primary-button px-4 py-2"
>
```

In `DocumentList.tsx`, mark the header shortcut as secondary and use `secondary-button sidebar-create-button`. In the empty state, omit the repeated full-width create button because the header shortcut remains visible and reachable.

- [ ] **Step 3: Implement filled selected modes and cohesive interaction states**

In `MdezWorkspace.tsx`, add `data-active-treatment="filled"` to desktop and mobile mode buttons. In `workspace.css`:

- give desktop mode navigation a compact grouped background and border;
- give mode buttons a control radius and visible gap;
- render the selected button with a nontransparent mode-tinted fill, mode-tinted border, strong foreground, and inset bottom indicator;
- ensure hover does not visually override selected state;
- align the mobile selected state with the same filled treatment;
- preserve the current topbar grid, height, background, and single-row structure.

- [ ] **Step 4: Implement long-title legibility**

In `DocumentList.tsx` and recent-page cards in `ShelfPane.tsx`:

```tsx
<span className="page-title-clamp" title={document.title}>
  {document.title}
</span>
```

Define `.page-title-clamp` in `workspace.css` with `display: -webkit-box`, `-webkit-box-orient: vertical`, `-webkit-line-clamp: 2`, `overflow: hidden`, `overflow-wrap: anywhere`, appropriate display typography, and a stable two-line minimum block size. Keep status and toolbar titles single-line.

- [ ] **Step 5: Complete icon-only tooltip coverage**

Add `title` values matching `aria-label` to the affected topbar buttons in `MdezWorkspace.tsx`: `Toggle sidebar`, `Refresh group`, `Group settings`, `Shared links`, and `Open library shelf`. Add `title="Close library shelf"` to the sidebar close button only if the new test or manual audit includes it. Continue hiding each decorative icon with `aria-hidden="true"`.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```powershell
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "workspace polish"
```

Expected: PASS.

- [ ] **Step 7: Run related shared-shell regression tests**

Run:

```powershell
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "renewed light library shell|desktop sidebar|mobile drawer|global actions|sidebar page rows|horizontal overflow|responsive layout"
cmd /c npm run test:e2e -- tests/e2e/key-groups.spec.ts -g "two browsers join one key and share saved Markdown"
```

Expected: all selected tests PASS; Key Group domain behavior is unchanged.

- [ ] **Step 8: Commit the implementation**

```powershell
git add src/app/styles/workspace.css src/components/mdez/MdezWorkspace.tsx src/components/mdez/DocumentList.tsx src/components/mdez/ShelfPane.tsx
git commit -m "style: polish shared workspace hierarchy"
```

---

### Task 3: Inspect and verify the finished path

**Files:**
- Modify if defects are found: `src/app/styles/workspace.css`
- Modify if defects are found: `src/components/mdez/MdezWorkspace.tsx`
- Modify if defects are found: `src/components/mdez/DocumentList.tsx`
- Modify if defects are found: `src/components/mdez/ShelfPane.tsx`
- Modify if contract coverage needs correction: `tests/e2e/mdez.spec.ts`

**Interfaces:**
- Consumes: the completed shared workspace polish.
- Produces: visually inspected desktop/mobile surfaces, clean detector output or resolved findings, and passing project verification.

- [ ] **Step 1: Inspect desktop and mobile together**

Run the app and inspect one 1280×800 desktop viewport and one 390×844 mobile viewport. Exercise Shelf, the sidebar/drawer, Edit, Read, Split, a long Thai title, an empty page list, focus states, and icon tooltips. Record all observed defects before editing.

- [ ] **Step 2: Fix the inspection batch**

Apply all confirmed visual or interaction defects in one patch. Do not expand scope into Key Group logic, other dialogs, editor behavior, or a new visual world.

- [ ] **Step 3: Run the one required Impeccable detector pass**

Run exactly once after UI edits are complete:

```powershell
node C:\Users\Neary\.agents\skills\impeccable\scripts\detect.mjs --json src/app/styles/workspace.css src/components/mdez/MdezWorkspace.tsx src/components/mdez/DocumentList.tsx src/components/mdez/ShelfPane.tsx
```

Resolve real in-scope findings. Document only narrow intentional exceptions.

- [ ] **Step 4: Perform at most one visual confirmation pass**

Recheck the 1280×800 and 390×844 viewports once. Stop polishing after this confirmation.

- [ ] **Step 5: Run final verification**

Run:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
cmd /c npm run test:e2e -- tests/e2e/mdez.spec.ts -g "workspace polish|renewed light library shell|desktop sidebar|mobile drawer|global actions|sidebar page rows|horizontal overflow|responsive layout"
cmd /c npm run test:e2e -- tests/e2e/key-groups.spec.ts
```

Expected: every command exits 0 without warnings attributable to the change.

- [ ] **Step 6: Review the final diff and commit any QA fixes**

Run `git diff --check`, inspect `git status --short`, and confirm no unrelated or generated files are included. If the visual inspection produced fixes, commit them as:

```powershell
git add src/app/styles/workspace.css src/components/mdez/MdezWorkspace.tsx src/components/mdez/DocumentList.tsx src/components/mdez/ShelfPane.tsx tests/e2e/mdez.spec.ts
git commit -m "fix: finish workspace polish QA"
```
