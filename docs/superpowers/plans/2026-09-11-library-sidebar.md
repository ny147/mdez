# Flat Library Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split book/page sidebar with a compact, accessible flat collection tree whose books expand to reveal naturally sorted pages.

**Architecture:** A pure library-tree model handles flattening, collision-safe names, natural sorting, counts, and visible rows. Local and shared repositories enforce top-level books and content-preserving deletion. A single `LibraryTree` component owns disclosure, menus, inline rename, drag/drop, and page navigation while `MdezWorkspace` owns view-mode restoration and the mobile drawer.

**Tech Stack:** Next.js 15, React 19, TypeScript, Dexie/IndexedDB, PostgreSQL store abstraction, Vitest/Testing Library, Playwright, CSS.

**Spec:** `docs/superpowers/specs/2026-09-11-library-sidebar-design.md`

## Global Constraints

- Books contain pages only; new or imported books always have `parentId: null`.
- Books and pages use numeric-aware natural alphabetical order with stable ID tie-breakers.
- Only one book or Unsorted collection is expanded at a time.
- Deleting a book atomically moves its pages to Unsorted and never deletes page content.
- Page moves do not create manual order or cross-workspace drag/drop behavior.
- Existing branding, search, workspace views, import/export, and mobile drawer behavior remain intact.

---

### Task 1: Flat library model and migration

**Files:**
- Create: `src/lib/library-tree.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/repository.ts`
- Test: `tests/unit/library-tree.test.ts`
- Test: `tests/unit/repository.test.ts`

**Interfaces:**
- Produces: `naturalCompare(left: string, right: string): number`, `buildFlatBookMigration(folders: Folder[]): Array<{ id: string; name: string }>`, and `deleteBookPreservingPages(id: string): Promise<void>`.

- [ ] Write tests with literal expectations for Chapter 2/10 ordering, stable ID ties, multi-level paths, collisions, cycles, and retry-safe already-flat inputs.
- [ ] Run `npm test -- tests/unit/library-tree.test.ts` and confirm failures are caused by missing exports.
- [ ] Implement pure natural sorting and deterministic flattening helpers.
- [ ] Run the focused test and confirm it passes.
- [ ] Add a Dexie version migration that snapshots folders, applies collision-safe path names once, and clears every parent ID atomically.
- [ ] Add repository tests proving IDs/pages survive migration and occupied-book deletion moves pages to Unsorted atomically.
- [ ] Run `npm test -- tests/unit/library-tree.test.ts tests/unit/repository.test.ts` and confirm green.

### Task 2: Flat writes, GitHub imports, and shared storage

**Files:**
- Modify: `src/lib/repository.ts`
- Modify: `src/server/key-groups/store.ts`
- Modify: `src/server/key-groups/postgres-store.ts`
- Modify: `src/server/key-groups/memory-store.ts`
- Modify: `src/lib/key-group-client.ts`
- Modify: `src/app/api/key-groups/[groupId]/folders/route.ts`
- Modify: `src/app/api/key-groups/[groupId]/folders/[folderId]/route.ts`
- Test: relevant repository, API, and key-group store tests under `tests/unit/`

**Interfaces:**
- Consumes: Task 1 flattening/name helpers.
- Produces: `deleteFolderPreservingDocuments(groupId, id, expectedVersion)` through the existing authenticated folder DELETE route.

- [ ] Add failing tests proving nested creates/updates are rejected or normalized, imports flatten paths, and shared delete returns updated page records through revisions.
- [ ] Run the focused repository/server tests and confirm expected failures.
- [ ] Make local create/import/refresh paths create only top-level books with collision-safe path names.
- [ ] Implement one-transaction shared delete: lock the folder, move its pages to null with new versions/revisions, delete the folder, and record convergence changes.
- [ ] Enforce null parents in shared creates and updates, including in-memory parity.
- [ ] Run focused tests and confirm green.

### Task 3: Single collection/page tree

**Files:**
- Create: `src/components/mdez/LibraryTree.tsx`
- Modify: `src/components/mdez/Sidebar.tsx`
- Retire from sidebar use: `src/components/mdez/FolderTree.tsx`, `src/components/mdez/DocumentList.tsx`
- Modify: `src/app/styles/workspace.css`
- Test: `tests/unit/sidebar-library.test.tsx`

**Interfaces:**
- Consumes: flat folders/documents and existing create/select/rename/move/delete callbacks.
- Produces: a single semantic list with one expanded collection, book/page menus, inline editing, and HTML drag/drop.

- [ ] Replace existing sidebar tests with failing tests for compact book rows, natural page order, one-open disclosure, Unsorted, always-visible menus, inline rename, Move to, drag/drop, and empty collections.
- [ ] Run `npm test -- tests/unit/sidebar-library.test.tsx` and confirm failures reflect the old split UI.
- [ ] Implement `LibraryTree` using buttons and nested lists, not an ARIA tree; preserve complete accessible names and 44px controls.
- [ ] Implement inline rename with Enter/save and Escape/cancel, retaining invalid or failed drafts.
- [ ] Implement page menu Move to and HTML drag/drop between books/Unsorted with destination feedback.
- [ ] Replace FolderTree plus DocumentList in Sidebar and style the active page, owning book, indentation, menu, and empty state.
- [ ] Run focused component tests and confirm green.

### Task 4: Workspace navigation and remembered state

**Files:**
- Create: `src/lib/workspace-ui-preferences.ts`
- Modify: `src/hooks/useWorkspaceLibrary.ts`
- Modify: `src/hooks/useKeyGroupLibrary.ts`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Test: `tests/unit/useWorkspaceLibrary.test.tsx`
- Test: relevant workspace component tests under `tests/unit/`

**Interfaces:**
- Produces: one `expandedCollectionId: string | null | "unsorted"`, explicit `revealDocument(id)`, and per-workspace last non-Shelf mode storage.

- [ ] Add failing tests for accordion expansion, search/page reveal, deleted preference IDs, storage failure, active-page moves, and Shelf-to-last-mode navigation.
- [ ] Run focused tests and confirm expected failures.
- [ ] Replace expanded sets with a single collection ID while keeping adapter compatibility at component boundaries where needed.
- [ ] Persist expansion and last mode under workspace-scoped keys; make reads/writes tolerant of denied storage.
- [ ] Route page selection through a workspace handler that restores mode and closes only the mobile drawer.
- [ ] Ensure active-page moves reveal the destination while non-active moves preserve expansion.
- [ ] Run focused tests and confirm green.

### Task 5: Large-list rendering and regression coverage

**Files:**
- Modify: `src/components/mdez/LibraryTree.tsx`
- Create or modify: `tests/e2e/library-sidebar.spec.ts`
- Modify: `tests/e2e/mdez.spec.ts` only where old nested-book expectations are intentionally replaced.

**Interfaces:**
- Consumes: visible rows from Tasks 1 and 3.
- Produces: bounded DOM rendering for long expanded page lists while retaining focused/edited rows and scroll-to-reveal.

- [ ] Add a failing browser test with 100 books and 1,000 pages that checks bounded mounted rows, distant-page reveal, menu placement, drag/drop, keyboard rename, and mobile close behavior.
- [ ] Run the focused Playwright spec and confirm expected failures.
- [ ] Add fixed-height windowing with overscan, measured scroll position, stable keys, and forced inclusion of active/focused/editing rows.
- [ ] Run the focused browser test and confirm green.

### Task 6: Documentation and final verification

**Files:**
- Modify: `CONTEXT.md`
- Modify: `design.md`
- Modify: `docs/PRISM-PAGES-IMPLEMENTATION.md`
- Modify: this plan's checkboxes as work completes.

**Interfaces:**
- Documents the shipped flat-book model, migration, interactions, and verification evidence.

- [ ] Update terminology so a book is a flat collection of pages and record migration behavior.
- [ ] Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- [ ] Run the complete Playwright suite.
- [ ] Inspect desktop, mobile, and actual 200% browser zoom with long and multilingual titles; confirm no horizontal overflow or clipped menus.
- [ ] Confirm `git diff --check`, review the final diff, and commit the verified implementation.
