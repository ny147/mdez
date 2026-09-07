# Mdez library redesign implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkboxes for tracking. Work inline unless the user requests delegation.

**Goal:** Apply the accepted single-page visual design to the existing application without data or feature regressions.

**Architecture:** Keep MdezWorkspace and the two existing library hooks as coordinators. Extract presentational library components, add pure view selectors, and persist personal bookmarks and resume history in separate additive Dexie tables. Keep CodeMirror, MarkdownReader, draft handling, imports, exports, groups, and sharing intact.

**Tech Stack:** Existing Next.js 15, React 19, TypeScript, Tailwind/CSS, Dexie, Lucide, CodeMirror, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-06-library-redesign.md`

**Execution status:** planning complete; no remote update, feature branch creation, or application implementation has been performed. Execute section 0 only when implementation begins.

## Global constraints

- Reference `mdez-redesign.html`; use real application records, never seed prototype content.
- Keep existing mobile 767px and tablet 1023px breakpoints.
- No deployment, server protocol change, document schema rewrite, or redesign of public shared pages is included.
- Personal bookmark metadata must not change group revisions or document updatedAt.
- Preserve current persistence, draft recovery, Markdown, nested operations, imports, exports, sharing, and groups.
- Every slice must leave a checkpoint and an explicit record of checks run. Do not begin a broad slice when the remaining usage allowance is too small to verify and save it.

## 0. Update main, then create the implementation branch

User-confirmed startup order: obtain latest remote main, preserve local design checkpoints, then create `codex/library-redesign` in an isolated worktree. These are execution instructions, not actions to perform while preparing this plan.

- [ ] Read `docs/REDESIGN-RESUME.md`, this plan, the spec, and applicable repository instructions. Use the using-git-worktrees skill. Inspect `git status --short`, `git branch --show-current`, `git remote -v`, and `git worktree list`. Expected remote: `origin` at `https://github.com/ny147/mdez.git`. Preserve unrelated changes; do not automatically stash or discard them.
- [ ] Record current main HEAD with `git rev-parse main`. Confirm the design/checkpoint history (`a7d43bf`, `d1d8dc0`, and subsequent planning commits) remains reachable. From a clean main checkout, run these commands sequentially, inspecting each result before continuing:

```powershell
git switch main
git fetch origin
git log --oneline --left-right main...origin/main
git pull --no-rebase origin main
git merge-base --is-ancestor origin/main main
git status --short
```

`pull --no-rebase` preserves local checkpoint commits, fast-forwards when possible, and merges when local and remote main have diverged. Do not reset main to origin/main, force-push, or rebase away the checkpoints. A fetch/pull failure or unresolved conflict blocks branch creation; diagnose and resolve it without dropping either side's content, and record the result. Main must contain the fetched origin/main and have a clean working tree before the next step. No push is part of this startup.

- [ ] Check that `codex/library-redesign` does not already exist and that `D:/Developer/mdez/.worktrees/library-redesign` is unused. Confirm `.worktrees` is Git-ignored with `git check-ignore .worktrees/`; follow the worktree skill if it is not. Create the requested branch only after updating main:

```powershell
git worktree add -b codex/library-redesign D:/Developer/mdez/.worktrees/library-redesign main
```

If the branch/path already exists, inspect it for an earlier implementation run and resume that work when it matches; never overwrite it or silently invent a different branch.

- [ ] In the new worktree, verify `git branch --show-current` returns `codex/library-redesign`, `git merge-base --is-ancestor origin/main HEAD` succeeds, `git status --short` is clean, and the HTML/spec/plan/glossary are present. Record the fetched origin/main SHA and implementation starting SHA in the resume file. Recheck code assumptions against the updated source, particularly Dexie versions: if version 5 is now used, choose the next unused additive version and update the spec/tests before coding.
- [ ] Run `npm ci` in the implementation worktree. Perform every subsequent application edit and test there, not in the main checkout. Save checkpoints after each verified slice. This plan does not authorize merging the completed feature into main or deploying it.

## 1. Establish baseline and apply shell

Files: `src/app/layout.tsx`, `src/app/styles/tokens.css`, `src/app/styles/workspace.css`, `src/components/mdez/MdezWorkspace.tsx`, `Sidebar.tsx`, `WorkspaceSwitcher.tsx`; existing `tests/e2e/mdez.spec.ts` and `tests/unit/useWorkspaceViewport.test.tsx`.

- [ ] Confirm section 0 completed and work is running in the `codex/library-redesign` worktree. Read the spec, HTML, active library and draft hooks, then `git status --short`; never overwrite unrelated changes.
- [ ] Run `npm run test`, `npm run lint`, `npm run typecheck` and save baseline results in the resume file. A failing baseline is evidence to investigate, not permission to drop coverage.
- [ ] Load Manrope and DM Sans through next/font; map current semantic font roles, retaining code and multilingual reader fonts.
- [ ] Apply the spec's token values and shell geometry. Preserve workspace switcher/group actions, semantic modes, existing drawer refs/inert state, and safe view handlers. Allow shelf scrolling without clipping; keep editor panes bounded.
- [ ] Verify `npm run test -- tests/unit/useWorkspaceViewport.test.tsx tests/unit/sidebar-library.test.tsx` and `npm run test:e2e -- tests/e2e/mdez.spec.ts`. Inspect shell at 1440, 1024, 768, and 390px before saving.
- [ ] Commit only slice files with message `style: apply redesigned workspace shell` and update resume progress.

## 2. Implement view selectors, bookmarks, and resume history

Files: new `src/lib/library-view.ts`, `src/lib/page-bookmarks.ts`, `src/hooks/usePageBookmarks.ts`; modify `src/lib/db.ts`; new `tests/unit/library-view.test.ts`, `tests/unit/page-bookmarks.test.ts`. Also create `src/lib/workspace-resume.ts`, `src/hooks/useWorkspaceResume.ts`, and `tests/unit/workspace-resume.test.ts` for the confirmed last-opened behavior.

Define these interfaces (Document and Folder remain imported from `@/types/content`):

```ts
export type LibraryFilter = 'all' | 'recent' | 'bookmarks' | 'unsorted';
export type LibraryViewInput = {
  documents: Document[]; folders: Folder[];
  selectedFolderId: string | null; filter: LibraryFilter;
  query: string; bookmarkedIds: ReadonlySet<string>;
  lastOpenedDocumentId: string | null;
};
export function selectLibraryView(input: LibraryViewInput): {
  pages: Document[]; books: Folder[]; resumePage: Document | null;
};
export function getCoverVariant(folderId: string): 0 | 1 | 2 | 3;
export function estimateReadingMinutes(body: string): number;
export function getBookPath(folderId: string | null, folders: Folder[]): string;
export type PageBookmark = {
  workspaceId: string; documentId: string; createdAt: string;
};
// Repository functions accept a database argument for fake-indexeddb tests.
export function listBookmarks(workspaceId: string, database?: MdezDatabase): Promise<PageBookmark[]>;
export function setBookmark(workspaceId: string, documentId: string,
  enabled: boolean, database?: MdezDatabase): Promise<void>;
// Hook exposes persisted state and awaited mutation; resets on workspace switch.
export function usePageBookmarks(workspaceId: string): {
  bookmarkedIds: ReadonlySet<string>; isReady: boolean; error: string | null;
  toggleBookmark: (documentId: string) => Promise<void>;
};
```

- [ ] Add selector tests for whitespace/case matching, title/body/book matching, workspace-wide search from a selected book or Bookmarks view, nested/unsorted matches, distinct empty-query Unsorted versus My library views, full result book paths with duplicate names/missing parents/cycles, restoration of selected-folder/favorites browsing after clearing search, stable equal-time sorting, uncapped results, and resume from lastOpenedDocumentId (including null/deleted target, with no most-recently-edited fallback). Include `expect(estimateReadingMinutes('')).toBe(1)` and deterministic cover variant assertions.
- [ ] Add fake-indexeddb tests that create a database with the version-4 schema, insert a folder and document, reopen with MdezDatabase v5, and assert exact record equality plus empty bookmark and workspaceResume tables. Exercise duplicate toggle, removal, failed write, and same document ID under `local` and `group:test` scopes.
- [ ] Run `npm run test -- tests/unit/library-view.test.ts tests/unit/page-bookmarks.test.ts`; record expected missing-module failures before implementation.
- [ ] Implement the specified helpers and additive v5 bookmark and resume tables. Do not alter existing store definitions or GroupSnapshot. Use deterministic ID tie-breaking and folder order/name sorting. Await transactions and reject on failure.
- [ ] Implement `useWorkspaceResume(workspaceId)` returning `{ lastOpenedDocumentId: string | null; isReady: boolean; error: string | null; recordOpened: (documentId: string) => Promise<void> }`. Persist one `{ workspaceId, documentId, openedAt }` record through a per-workspace serialized write queue. Test reload, workspace isolation, failed writes, rapid opens A then B, missing targets, and unchanged history after remote edits. Run `npm run test -- tests/unit/workspace-resume.test.ts`.
- [ ] Implement the bookmark hook with stale-result protection when workspace IDs change. Never let a previous workspace's asynchronous read overwrite current bookmarks. Surface failed mutation state rather than claiming success.
- [ ] Rerun all three focused test files (library-view, page-bookmarks, workspace-resume) and `npm run typecheck`; commit `feat: add scoped library views and personal bookmarks`.

## 3. Build and wire library presentation

Files: new `src/components/mdez/BookCover.tsx`, `LibraryPageList.tsx`, `LibrarySearch.tsx`; modify `ShelfPane.tsx`, `Sidebar.tsx`, `FolderTree.tsx`, `MdezWorkspace.tsx`, `src/lib/workspace-copy.ts`, `src/app/styles/workspace.css`; new `tests/unit/library-view-ui.test.tsx`.

Interfaces: BookCover consumes a Folder, direct page count, selected boolean, and onSelect callback. LibraryPageList consumes Document[], Folder[], ReadonlySet<string>, onSelectDocument(id), and onToggleBookmark(id). LibrarySearch consumes query, onQueryChange(string), and onSubmit(), with an input ref for the global shortcut. ShelfPane consumes `selectLibraryView` results and existing mutation callbacks; it never writes data itself.

- [ ] Add UI behavior tests for independent bookmark/page targets, real zero-page states, selecting a child book, a long Unicode title, no search results with Clear search, and unavailable bookmark persistence with an error message.
- [ ] Run `npm run test -- tests/unit/library-view-ui.test.tsx` and confirm the new contract fails before wiring.
- [ ] Build geometric covers with stable variants, true titles/counts, and a responsive grid. Preserve nested tree and unsorted navigation; display child books in selected context.
- [ ] Implement full recent rows, favorites, resume panel, and empty/loading/error states. Place workspace/group and shared-link management in the sidebar workspace menu, page sharing/Markdown export beside the open page, GitHub refresh beside the imported book, and ZIP export in selected-book actions. Keep import/New page visible. Preserve nested operation menus, confirmations, conflicts, and keyboard/touch access. Add UI tests verifying each action remains reachable in its applicable local/group/source context, including no selected page.
- [ ] In MdezWorkspace, derive workspaceId from activeGroupId, own query/filter state, and use the new hook/selectors. Query/filter resets on workspace switch; selection and resume use existing safe draft/navigation handlers. Record a successful explicit document open, including creation/import that opens a page, through useWorkspaceResume; never record passive loading/refresh selection. Metadata failures must not block opening a document. Wire search shortcut with cleanup and preserve editor drafts when entering search. Shelf queries update live; document-view typing prepares a query and Enter submits via safe navigation. Implement getBookPath with cycle and missing-parent guards; page title/body matches and book-name matches are distinct result sets. A nonempty query searches every active-workspace record independently of the selected folder/filter; keep the prior browsing context for query clearing and display full book paths in results.
- [ ] Test saving an edit followed immediately by resume/search/book/workspace navigation, then reloading; assert the edited body remains. Test bookmark toggle/reload and group/local separation. Run UI unit tests and existing sidebar/library/draft suites.
- [ ] Commit `feat: wire redesigned bookshelf and library navigation`.

## 4. Apply editor and reader chrome

Files: `EditorPane.tsx`, `EditorToolbar.tsx`, `PreviewPane.tsx`, `SplitWorkspace.tsx`, `WorkspaceStatus.tsx`, `MdezWorkspace.tsx`, `src/app/styles/markdown.css`, `workspace.css`; existing Markdown/draft unit tests and `tests/e2e/mdez.spec.ts`.

- [ ] Apply title hierarchy, button treatment, readable column measure, and spacious editor/reader surfaces. Preserve CodeMirror, MarkdownReader and resize/TOC implementations.
- [ ] Keep Edit/Read/Split semantic tabs, keyboard behavior, selection and save state. Do not substitute prototype HTML handlers. Focus title/editor on creation; focus the relevant heading/region on view navigation and restore trigger focus on dialog/drawer close.
- [ ] Verify existing math/code/link/table tests: `npm run test -- tests/unit/markdown-reader.test.tsx tests/unit/markdown-math.test.ts tests/unit/useDocumentDrafts.test.tsx tests/unit/latest-save-queue.test.ts`.
- [ ] Verify keyboard mode switching, split dragging, reader TOC, import/export, pending save/recovery, mobile keyboard viewport, and 200% zoom with the existing e2e suite and manual browser checks.
- [ ] Commit `style: align editor and reader with library redesign`.

## 5. Final verification and handoff

Files: existing tests as required, PRODUCT.md, design.md, `docs/REDESIGN-RESUME.md`.

- [ ] Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. Existing quick-share and key-group suites are part of the gate. Document environment/service blockers separately from actual failures.
- [ ] Capture desktop/mobile screenshots for seeded test data only, compare to the HTML, and fix material gaps in one batch. Include empty states and long titles, not just the ideal shelf.
- [ ] Check no horizontal page overflow using `document.documentElement.scrollWidth <= window.innerWidth`, visible focus, offscreen drawer inertness, AA contrast, labeled dialogs, pressed/tab states, and reduced motion.
- [ ] Update product/design documentation from verified behavior. Record exact commits, commands/results, remaining work and resume instructions. Do not call unrun checks passed.
- [ ] Commit `docs: record verified workspace redesign`. Handoff the implementation for review; deployment is a separate action.

## Resume discipline

After each slice, update `docs/REDESIGN-RESUME.md` with completed checkbox numbers, active branch, last verified commit, files with partial changes, tests and next command. If usage becomes tight, stop before the next slice, save the current reviewable work and state plainly whether it is verified or partial. Never consume a usage reset without user authorization.
