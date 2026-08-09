# Shared Page Scroll Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore natural vertical scrolling on long public Quick Share pages without changing the fixed-viewport editor workspace.

**Architecture:** Remove the editor-only scroll lock from the global `body` selector. Preserve viewport containment on `.workspace-shell`, which already owns `height: 100dvh` and `overflow: hidden`, and protect that boundary with a stylesheet regression test.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, Vitest, Playwright.

## Global Constraints

- Public and terminal-state pages must use normal browser-page scrolling.
- The editor workspace must remain a viewport-sized application shell.
- Existing pane-level overflow behavior must not change.
- Do not change reader markup, typography, APIs, database behavior, or persisted content.

---

### Task 1: Correct Scroll Ownership

**Files:**
- Modify: `tests/unit/production-readiness.test.tsx`
- Modify: `src/app/styles/workspace.css`

**Interfaces:**
- Consumes: the global `body` stylesheet and the existing `.workspace-shell` layout contract.
- Produces: natural document scrolling outside the workspace and unchanged fixed-shell containment inside it.

- [ ] **Step 1: Write the failing regression test**

Add this case inside the existing `production readiness` describe block:

```tsx
it("keeps document scrolling available outside the fixed workspace shell", () => {
  const workspaceCss = readFileSync(resolve(process.cwd(), "src/app/styles/workspace.css"), "utf8");

  expect(workspaceCss).not.toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
  expect(workspaceCss).toMatch(/\.workspace-shell\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- tests/unit/production-readiness.test.tsx
```

Expected: FAIL because the global `body` rule still contains `overflow: hidden`.

- [ ] **Step 3: Implement the minimal CSS fix**

Remove the duplicate global block from `src/app/styles/workspace.css`:

```css
body {
  font-family: var(--font-ui);
  overflow: hidden;
}
```

Do not change `.workspace-shell`; its existing viewport and overflow rules remain the editor boundary.

- [ ] **Step 4: Run focused and full automated verification**

Run:

```powershell
npm test -- tests/unit/production-readiness.test.tsx
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Expected: every command exits successfully; the focused test proves the body is scrollable and the workspace remains constrained.

- [ ] **Step 5: Verify responsive behavior**

Start the local app, mock a long Quick Share payload through the existing browser test flow, and inspect desktop and mobile viewports. Confirm `window.scrollY` increases on the public shared page and the editor workspace has no outer-document overflow.

- [ ] **Step 6: Commit and integrate**

```powershell
git add tests/unit/production-readiness.test.tsx src/app/styles/workspace.css docs/superpowers/plans/2026-08-09-shared-page-scroll-hotfix.md
git commit -m "fix: restore shared page scrolling"
```

Fast-forward the local `main` worktree to `origin/main`, merge `codex/hotfix-shared-page-scroll`, and rerun the focused regression test on merged `main`.
