# Public GitHub Import and Production Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import and manually refresh the default branch of a public GitHub Markdown repository, harden the local-first experience, and release Mdez on Vercel.

**Architecture:** `MdezWorkspace` remains the coordinator and IndexedDB the only document store. A controlled Next.js route downloads a validated repository ZIP; browser code creates an in-memory preview; Dexie persists or refreshes every source-owned record atomically.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.7, Dexie 4, JSZip 3, Vitest 2, Playwright 1.49, Tailwind CSS 3, Vercel.

## Global Constraints

- Public `github.com/<owner>/<repository>` and default branch only.
- One-way import and manual refresh; refresh replaces local edits inside that imported book.
- Repository = root book; Markdown-bearing directories = nested books; store `.md`/`.markdown` only.
- Ignore `.obsidian`, hidden configuration, attachments, and unsupported files.
- IndexedDB only; no authentication, accounts, cloud database, sync, polling, push, or merging.
- Limits: 25 MB ZIP, 1,000 Markdown files, 5 MB per file, 50 MB extracted total.
- Never fetch an arbitrary user URL or log Markdown/ZIP payloads. Add no runtime dependency.
- Preserve `design.md`, renewed UI behavior, and unrelated dirty-worktree changes.
- Do not restore user-deleted `.github/workflows/ci.yml` without explicit authorization.

## Fixed Interfaces

```ts
parseGitHubRepositoryUrl(input: string): GitHubRepositoryRef
requestGitHubImportPreview(url: string): Promise<GitHubImportSession>
parseGitHubArchive(data: ArrayBuffer, repository: GitHubRepositoryRef, branch: string): Promise<GitHubImportSession>
importGitHubSource(session: GitHubImportSession): Promise<GitHubImportResult>
refreshGitHubSource(sourceId: string, session: GitHubImportSession): Promise<GitHubImportResult>
deleteGitHubSource(sourceId: string): Promise<void>
```

## Task 0: Baseline Gate

- [ ] Record `git status --short`, `git diff --name-only`, and the CI deletion diff; change nothing.
- [ ] Run lint, typecheck, unit tests, full E2E, and build separately. Record exact pre-existing failures.
- [ ] Run the sidebar-reopen and mobile-drawer E2E tests explicitly. Expected: both pass.

---

## P0: Public GitHub Import

### Task 1: Contracts and URL Validation

**Files:** Create `src/types/github.ts`, `src/lib/github.ts`, `tests/unit/github.test.ts`.

- [ ] Write failing tests for trailing slash/`.git` normalization and rejection of HTTP, wrong host, credentials, port, query/hash, missing/extra segments, encoded slash, and invalid names.
- [ ] Define repository, archive error, ignored entry, folder/document draft, preview, session, source, and result types.
- [ ] Parse with `URL`; require HTTPS, exact `github.com`, blank credentials/port/query/hash, and two decoded segments. Validate owner with `/^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/` and repository with `/^(?!\.git$)[A-Za-z0-9._-]{1,100}$/`.
- [ ] Run test, lint, and typecheck; commit `feat: validate public GitHub repositories`.

### Task 2: Controlled Archive Route

**Files:** Create `src/app/api/github/archive/route.ts`, `tests/unit/github-route.test.ts`.

- [ ] Mock GitHub metadata and ZIP fetches. Assert the internally constructed default-branch codeload URL.
- [ ] Test 404 unavailable, 403/429 rate limit, upstream failure, timeout, invalid ZIP, and announced/actual size over 25 MB.
- [ ] Implement a Node/dynamic POST route with 15-second abort, no-store metadata request, internal codeload construction, redirect following, size/signature checks, and typed JSON errors.
- [ ] Return `X-Mdez-Default-Branch`, `X-Mdez-Repository-Url`, no-store, and nosniff headers. Never log bodies.
- [ ] Run URL/route tests, lint, and typecheck; commit `feat: proxy public GitHub archives safely`.

### Task 3: ZIP Preview

**Files:** Create `src/lib/github-import.ts`, `tests/unit/github-import.test.ts`.

- [ ] Build JSZip tests for root removal, hierarchy, extensions, deterministic order, ignored entries, titles, and byte count.
- [ ] Reject traversal, absolute/drive/backslash/control paths, mixed roots, invalid UTF-8, empty Markdown, 1,001 files, a file over 5 MB, and total over 50 MB.
- [ ] Load with CRC checking; validate `unsafeOriginalName ?? name` before root removal; ignore dot/unsupported paths; sort before extraction; enforce limits; use fatal UTF-8 decode; derive Markdown-bearing ancestors and sibling order.
- [ ] Implement the route client, require both response headers, and surface typed server messages.
- [ ] Run parser tests, lint, and typecheck; commit `feat: preview GitHub Markdown archives`.

### Task 4: Atomic Source Persistence

**Files:** Modify `src/types/content.ts`, `src/lib/db.ts`, `src/lib/repository.ts`, and repository tests.

- [ ] Write failing tests for version-1 migration, ownership tags, duplicate URL, local-data preservation, stable root ID, failed-refresh rollback, and source-only deletion.
- [ ] Add optional `sourceId` to Folder and Document.
- [ ] Add Dexie version 2 indexes: `sourceId` on folders/documents and unique `normalizedUrl` on `githubSources`; use no upgrade callback so old records remain unchanged.
- [ ] Implement import, refresh, and deletion in one three-table transaction. Refresh preserves root ID/order and replaces only source-owned records.
- [ ] Make `listContent` return sources alongside folders/documents.
- [ ] Run repository/full unit tests, lint, and typecheck; commit `feat: persist GitHub sources atomically`.

### Task 5: Preview-First Import UI

**Files:** Modify `ImportDialog.tsx`, `MdezWorkspace.tsx`, `WorkspaceStatus.tsx`, CSS, and E2E tests.

- [ ] Add mocked-route E2E: Public GitHub → labeled URL → preview name/branch/count/ignored/hierarchy → confirm → reload persistence. Add 429 retry and preserve paste/file tests.
- [ ] Add Paste, Markdown files, and Public GitHub source choices.
- [ ] Show public/default-only help, stable progress, preview details, overwrite notice, retry, and disabled conflicting controls while busy.
- [ ] Preserve focus trap, Escape/focus restoration, 390 px layout, and the single existing live region.
- [ ] Let the workspace coordinate preview and transaction, then open the first imported page only after success.
- [ ] Run GitHub/paste/file E2E, lint, and typecheck; commit `feat: import public GitHub repositories`.

### Task 6: Source Status and Refresh

**Files:** Create `GitHubSourcePanel.tsx`; modify workspace, sidebar, shelf, CSS, and E2E tests.

- [ ] Add failing tests: changed ZIP replaces only the source; cancel makes no request; 502 preserves old/unrelated content after reload.
- [ ] Render repository, `Public GitHub · <branch>`, semantic refresh time, and `Refresh from GitHub`.
- [ ] Confirm the overwrite consequence, download/validate before the transaction, and select refreshed content only after success.
- [ ] Delete an imported root through source deletion after a named confirmation. Never assign source ownership when moving local content into it.
- [ ] Run unit, GitHub/refresh/import/persistence/export E2E, lint, typecheck, and build; commit `feat: refresh GitHub books safely`.

---

## P1: Focused UX Hardening

### Task 7: Accessibility, Reading, and Responsive States

- [ ] Add no-overflow tests at 390, 430, 768, 1024, and 1440 px; add 200% zoom/long-name, focus restoration, reduced-motion, and exactly one polite status region.
- [ ] Preserve the existing 680 px/65–75 character reader measure and Markdown typography.
- [ ] Use exact action copy: `Public GitHub`, `Public repository URL`, `Preview repository`, `Import repository`, `Refresh from GitHub`, `Try again`.
- [ ] Keep stages stable; wrap long paths; stack actions below 640 px; retain ≥40 px targets, tokens, fonts, shadows, and focus ring.
- [ ] Add dated test evidence to the UX review; mark Pass only after the named test passes.
- [ ] Run full unit/E2E/lint/typecheck/build; commit `fix: harden GitHub import experience`.

---

## P2: Production Release

### Task 8: Production Shell and Headers

**Files:** Create `src/app/error.tsx`, `src/app/icon.svg`; modify layout, Next config, and E2E tests.

- [ ] Add a failing header test for nosniff, strict-origin referrer, disabled camera/microphone/geolocation, and same-origin opener.
- [ ] Update metadata; create an accessible 64×64 pastel book SVG; create a safe client error boundary with `Try again` and no error/document details.
- [ ] Add headers for `/:path*`; defer CSP because fonts/styles/Blob downloads require separate testing.
- [ ] Run build, header E2E, lint, and typecheck; commit `feat: harden production application shell`.

### Task 9: CI, Docs, Preview, and Production

- [x] Show the CI deletion diff and ask permission. If withheld, leave it deleted and do not claim CI complete.
- [x] After approval restore the HEAD workflow: Node 22, npm ci, lint, typecheck, unit, Chromium, build, production-server E2E, and failure artifacts. Add no secret.
- [ ] Update PRODUCT and README with shipped public/default-only behavior, overwrite refresh, origin-scoped IndexedDB, ignored files, limits, and deferred private/sync features.
- [x] Reproduce CI locally against `npm run start`. Expected: every gate passes.
- [ ] Ask deployment authorization. After approval create a Vercel preview and smoke-test import, edit, autosave, reload, refresh, export, mobile, friendly errors, and log privacy.
- [ ] After preview approval promote to production; record the HTTPS URL and local-data notice.
- [ ] Commit CI as `ci: verify production GitHub import flow`; commit docs separately as `docs: publish Mdez GitHub import release`.

## Final Verification

- [ ] Lint, strict typecheck, full unit, desktop/mobile E2E, and production build pass.
- [ ] Version-1 data survives migration; import/refresh are preview-first and atomic.
- [ ] Failure preserves the old source and unrelated local content.
- [ ] Tests cover URL, route, ZIP safety/limits/order/encoding, migration, duplicate, rollback, refresh, deletion, accessibility, and viewports.
- [ ] No arbitrary fetch, token path, payload logging, or deferred feature.
- [ ] Renewed identity, reading measure, keyboard behavior, and one live region remain.
- [ ] CI and deployment each have explicit authorization and verified outcomes.

## Explicitly Deferred

Private repositories/authentication; branch/tag/commit/subfolder selection; background refresh/webhooks/push/sync/conflict merging; accounts/cloud/sharing/collaboration; Obsidian attachments/config/plugins/wikilinks/embeds; search/tags/PDF/HTML/plugins; another redesign.
