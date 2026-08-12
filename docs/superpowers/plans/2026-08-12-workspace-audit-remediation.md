# Workspace Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the four actionable findings from the Mdez workspace audit without changing the established pastel library visual world.

**Architecture:** Strengthen the existing workspace controls at their semantic boundaries: mode navigation becomes a complete keyboard-operable tab interface, while the book hierarchy uses native nested-list ownership instead of a partial ARIA tree. Reduced-motion behavior is expressed by product-owned classes, and highlighted Markdown code uses semantic color tokens rather than a third-party global theme.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, authored CSS tokens, Playwright E2E, Vitest.

## Global Constraints

- Preserve the existing Operate/Read mode, content, hierarchy, and quiet pastel library identity.
- Meet WCAG AA contrast: 4.5:1 for body text and 3:1 for controls, icons, and focus indicators.
- Add no runtime dependency.
- Follow strict red-green-refactor: every behavior change starts with a focused failing test.
- Motion thesis: no new focal animation; preserve only useful state feedback and remove nonessential looping motion when `prefers-reduced-motion: reduce` is active.
- Color strategy: restrained semantic accents on the existing dark code surface; color communicates syntax categories while readable lightness remains the primary cue.

---

### Task 1: Complete workspace mode semantics and keyboard behavior

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Modify: `src/components/mdez/MdezWorkspace.tsx`

**Interfaces:**
- Consumes: `readerViewOptions`, `mobileOptions`, and `handleViewModeChange(mode)`.
- Produces: labeled `tablist` containers, tabs with `aria-controls` and roving `tabIndex`, Arrow/Home/End navigation, and a labeled `tabpanel` workspace surface.

- [ ] **Step 1: Write failing Playwright tests** for tablist ownership, tab-to-panel relationships, a single tabbable tab per visible tablist, and ArrowRight/Home/End selection and focus behavior.
- [ ] **Step 2: Run the focused test and verify RED** because the current navigation containers are `navigation` landmarks and the tabs lack controls, panels, and roving focus.
- [ ] **Step 3: Implement the minimal tab contract** with stable IDs, a shared keyboard handler scoped to the active tablist, and a single workspace tabpanel.
- [ ] **Step 4: Run the focused test and existing mode tests and verify GREEN** on desktop and mobile.

### Task 2: Replace the partial ARIA tree with a semantic nested list

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Modify: `src/components/mdez/FolderTree.tsx`

**Interfaces:**
- Consumes: the existing folder tree data and selection, expansion, rename, create, and delete callbacks.
- Produces: a labeled nested `ul`/`li` hierarchy whose selection buttons expose `aria-pressed` and expansion controls expose `aria-expanded`/`aria-controls`.

- [ ] **Step 1: Write failing Playwright tests** that assert list/listitem ownership and accessible button states for root selection and nested folder expansion.
- [ ] **Step 2: Run the focused test and verify RED** because the current generic containers do not own their ARIA tree items correctly.
- [ ] **Step 3: Implement native list semantics** while preserving layout, copy, actions, and nested indentation; update existing selectors from `treeitem` to accessible buttons.
- [ ] **Step 4: Run folder creation, nesting, rename, delete, and root-selection tests and verify GREEN**.

### Task 3: Respect reduced-motion preferences for looping feedback

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Modify: `src/components/mdez/PublicSharedPage.tsx`
- Modify: `src/components/mdez/GitHubSourcePanel.tsx`
- Modify: `src/app/styles/workspace.css`

**Interfaces:**
- Consumes: browser `prefers-reduced-motion` and existing loading/refresh state text.
- Produces: product-owned `shared-page-loading` and `github-refresh-icon` hooks that disable looping animations only under reduced motion.

- [ ] **Step 1: Write a failing Playwright test** that emulates reduced motion and verifies the real loading and refresh feedback hooks compute to `animation-name: none` while status text remains available.
- [ ] **Step 2: Run the focused test and verify RED** because Tailwind pulse/spin animations remain active.
- [ ] **Step 3: Add stable product classes and a narrow reduced-motion rule**; keep all feedback copy and visual state intact.
- [ ] **Step 4: Run the focused test in desktop and mobile projects and verify GREEN**.

### Task 4: Tokenize Markdown syntax highlighting

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/styles/tokens.css`
- Modify: `src/app/styles/markdown.css`

**Interfaces:**
- Consumes: highlight.js category classes emitted by `rehype-highlight`.
- Produces: `--color-code-*` semantic tokens and scoped `.markdown-preview .hljs-*` rules on the existing ink code surface.

- [ ] **Step 1: Write a failing Playwright test** that renders representative keyword, string, number, title, and comment spans and asserts each resolves to its semantic token with readable contrast on the code-block background.
- [ ] **Step 2: Run the focused test and verify RED** because the semantic tokens do not exist and the global GitHub theme owns the colors.
- [ ] **Step 3: Remove the global GitHub stylesheet import, define semantic code tokens, and scope syntax-category rules** to Markdown previews.
- [ ] **Step 4: Run reader, Markdown rendering, and contrast tests and verify GREEN**.

### Task 5: Bounded final polish and release verification

**Files:**
- Review: all files changed by Tasks 1-4

**Interfaces:**
- Consumes: completed audit remediations.
- Produces: a clean, verified source diff with no detector findings or regressions.

- [ ] **Step 1: Run the Impeccable detector once** after all UI edits and address any concrete findings in one batch.
- [ ] **Step 2: Run the focused desktop/mobile E2E suite**, then `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- [ ] **Step 3: Inspect the final diff** for accidental churn, duplicated values, stale imports, and temporary artifacts.
- [ ] **Step 4: Commit the completed remediation** only after all verification evidence is green.
