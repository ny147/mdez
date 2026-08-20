# Mdez Active Implementation Plan

**Approved:** 2026-07-13  
**Order:** P0 Public GitHub import, P1 focused UX/UI improvement, P2 production deployment  
**Baseline:** Keep the completed renewed workspace in design.md.

## Goal

Let users import the same public Markdown repository on multiple devices, make the workflow clear and readable, then deploy Mdez without adding accounts, private repositories, cloud document storage, or two-way sync.

## Approved scope

- Public GitHub repositories and their default branch only.
- One-way GitHub to Mdez import with manual refresh.
- Repository becomes a root book; directories become nested books.
- Import .md and .markdown only.
- Ignore .obsidian, attachments, configuration, and unsupported files.
- Persist in browser IndexedDB for offline use.
- Warn that refresh replaces local edits inside the imported book.
- Use Vercel as the initial production target.

## Architecture contract

- Keep MdezWorkspace as workflow coordinator and IndexedDB as document storage.
- Use a Next.js route handler as the controlled GitHub download boundary.
- Parse owner and repository names. Never fetch an arbitrary user URL.
- Reuse JSZip and existing import, repository, tree, status, editor, and reader code.
- Validate the request and archive server-side, then validate entries before persistence.
- Make import and refresh atomic transactions.
- Add no accounts, cloud database, global state library, or new import dependency.

## Milestones

| Priority | Outcome | Status |
| --- | --- | --- |
| P0 | Import and manually refresh a public Markdown repository | In progress |
| P1 | Improve import, reading, navigation, errors, accessibility, and mobile use | Not started |
| P2 | Verify, preview, and deploy on Vercel | Not started |

## Baseline gate

- [x] Preserve unrelated dirty-worktree changes.
- [x] Confirm sidebar reopen and mobile drawer fixes remain present.
- [x] Run lint, typecheck, unit, E2E, and build.
- [x] Record baseline failures before feature work.
- [x] Keep completed historical plans unchanged.

## P0: Public GitHub import

### Expected flow

1. Choose Public GitHub from the existing import surface.
2. Enter https://github.com/owner/repository.
3. Validate and download the default branch.
4. Preview repository name, Markdown count, ignored count, and book structure.
5. Confirm, persist atomically, and open the first page.
6. Later choose Refresh from GitHub and confirm the overwrite warning.

### Task 1: Contracts and URL validation

**Files:** src/types/github.ts or src/types/content.ts, src/lib/github.ts, tests/unit/github.test.ts.

- [x] Define typed requests, responses, previews, ignored entries, and GitHubSource.
- [x] Normalize trailing slash and .git suffix.
- [x] Accept only github.com owner/repository URLs.
- [x] Reject other hosts, credentials, download queries, missing names, and unsafe characters.
- [x] Write validation tests first.

### Task 2: Controlled archive route

**Files:** src/app/api/github/archive/route.ts; optional src/lib/server/github.ts.

- [x] Construct the official GitHub archive URL internally.
- [x] Use the default branch, follow redirects, and disable cache for refresh.
- [x] Apply timeout and compressed-size limits.
- [x] Return typed invalid, unavailable, private, empty, rate-limited, oversized, and upstream errors.
- [x] Never log Markdown bodies or archive payloads.

Initial limits: 25 MB compressed archive, 1,000 Markdown files, 5 MB per Markdown file, and 50 MB extracted Markdown total. Increasing these requires memory and runtime review.

### Task 3: Parse and preview

**Files:** src/lib/github-import.ts, tests/unit/github-import.test.ts.

- [x] Load with existing JSZip and remove the generated archive root.
- [x] Reject traversal, absolute paths, empty segments, and invalid names.
- [x] Ignore .obsidian, hidden configuration, and non-Markdown files.
- [x] Preserve hierarchy and deterministic ordering.
- [x] Report ignored and rejected entries.
- [x] Preview before IndexedDB writes and allow retry after failure.

### Task 4: IndexedDB source tracking

**Files:** src/lib/db.ts, src/types/content.ts, src/lib/repository.ts, tests/unit/repository.test.ts.

- [x] Add Dexie version 2 with githubSources.
- [x] Add optional sourceId to imported folders and documents.
- [x] Preserve existing local data during migration.
- [x] Import one source transactionally.
- [x] Refresh only records belonging to the selected source.
- [x] Roll back on parsing or persistence failure.
- [x] Remove metadata when its root book is deleted.
- [x] Prevent duplicate normalized repository sources.

### Task 5: Import UI

**Files:** ImportDialog.tsx, MdezWorkspace.tsx, optional WorkspaceStatus.tsx, and globals.css only for missing states.

- [x] Offer Paste, Markdown files, and Public GitHub in one surface.
- [x] Preserve current paste and file behavior.
- [x] Add a labeled URL field and Import repository action.
- [x] Explain public-only and default-branch limits.
- [x] Show validation, download, parsing, preview, import, success, and error states.
- [x] Disable conflicting controls while busy and restore focus on close.
- [x] Support keyboard and 390 px mobile use.

### Task 6: Source status and refresh

**Files:** Sidebar.tsx, MdezWorkspace.tsx, repository.ts; ShelfPane.tsx only if useful.

- [x] Show repository name, source label, and last refresh time.
- [x] Add Refresh from GitHub.
- [x] Confirm that local edits will be replaced.
- [x] Download and validate before replacing data.
- [x] Replace source-owned records atomically.
- [x] Preserve unrelated local books and previous content after failure.
- [x] Announce success and open the first refreshed page.

### P0 tests and acceptance

- [x] Test URL/archive validation, filtering, limits, hierarchy, and order.
- [x] Test migration, rollback, and duplicate prevention.
- [x] Test mocked import and refresh through Playwright.
- [x] Test unrelated local data, error recovery, reload persistence, keyboard, desktop, and mobile.
- [x] Keep existing import, edit, autosave, reader, and export tests green.
- [x] Confirm import hierarchy and source-only refresh.
- [x] Run lint, typecheck, unit, full E2E, and build successfully.

## P1: Focused UX/UI improvement

This is a targeted product pass, not another redesign. Preserve the quiet pastel library, mode colors, familiar controls, reader typography, and responsive contract.

### Task 1: Audit implemented flows

- [x] Inspect fresh, populated, first-import, repeated-import, refresh, and failure states.
- [x] Check 390, 430, 768, 1024, and 1440 px widths.
- [x] Check keyboard, focus restoration, screen-reader names, reduced motion, and 200% zoom.
- [x] Verify WCAG AA contrast for text, placeholders, alerts, disabled controls, and metadata.
- [x] Use current findings only and prioritize blocking, high-value, and optional items.

### Task 2: Improve comprehension and reading

- [x] Distinguish import sources without long instructions.
- [x] Use consistent verb-and-object labels.
- [x] Keep source choice, input, preview, progress, and results stable.
- [x] Make ignored files and limits discoverable without crowding.
- [x] Provide retry/cancel and show refresh consequences before confirmation.
- [x] Preserve a 65 to 75 character reading measure.
- [x] Verify prose, headings, links, code, blockquotes, and tables.
- [x] Keep one primary action per empty/error state.
- [x] Keep desktop/mobile commands consistent and handle long names safely.

### Task 3: Harden interactions

- [x] Cover default, hover, focus, active, selected, disabled, loading, success, warning, and error.
- [x] Keep state motion between 150 and 250 ms with reduced-motion alternatives.
- [x] Keep closed/inactive surfaces out of the focus order.
- [x] Keep one polite live status region.

### P1 acceptance

- [x] A new user can import without separate documentation.
- [x] Reader content remains comfortable for long sessions.
- [x] Desktop/mobile actions are consistent and supported widths do not overflow.
- [x] Accessibility, keyboard, and visual checks pass without changing the identity.

## P2: Production deployment

### Task 1: Release automation

- [x] Review the user-owned deletion before restoring .github/workflows/ci.yml.
- [x] Install from the lockfile in CI.
- [x] Run lint, typecheck, unit, build, and production-mode E2E.
- [x] Require no deployment secret for public import.
- [x] Keep CI failures actionable.

Local CI reproduction passed on 2026-08-20: clean lockfile install, lint,
typecheck, 157 unit tests, production build, and 57 Chromium tests against
`npm run start`. The first hosted GitHub Actions run and required branch check
remain pending.

### Task 2: Production readiness

- [x] Add production metadata, icons, and route error handling if missing.
- [x] Add practical security headers without breaking preview/download.
- [ ] Verify archive limits and timeouts in Vercel.
- [x] Show friendly GitHub rate-limit and upstream errors.
- [x] Confirm Markdown/local data are not logged.
- [x] Explain origin-scoped IndexedDB and that localhost data does not move to production.

### Task 3: Vercel deployment

- [ ] Connect the project repository and create a preview deployment.
- [ ] Smoke test import, edit, autosave, reload, refresh, and export.
- [ ] Test desktop/mobile on the preview URL.
- [ ] Promote the reviewed preview to production.
- [ ] Record the production URL and procedure in README.md.

### P2 acceptance

- [ ] CI passes from a clean checkout.
- [ ] Preview smoke tests pass.
- [ ] GitHub import works through the deployed route.
- [x] Storage and refresh limitations are visible.
- [ ] Production URL is verified before release completion.

## Verification commands

    npm run lint
    npm run typecheck
    npm test
    npm run test:e2e
    npm run build

Production additionally requires smoke tests against the Vercel preview URL.

## Documentation by milestone

- P0: update PRODUCT.md and README.md with shipped behavior and limits.
- P1: update the UX review with current findings.
- P2: add production URL, deployment steps, local-data notice, and operational checks.
- Keep design.md as the completed baseline unless its approved contract changes.

## Explicitly deferred

- Private repositories, authentication, branch/tag/commit/subfolder selection.
- Background refresh, polling, webhooks, two-way sync, push, and conflict merging.
- Collaboration and real-time editing.
- Obsidian attachments, themes, plugins, configuration, wikilinks, and embeds.
- Accounts, cloud storage, sharing, search, tags, PDF/HTML export, and plugins.
- Another large visual redesign.

## Final definition of done

- [ ] Gates pass in priority order and deferred features have not entered indirectly.
- [x] Existing data survives migration.
- [x] Public-only and overwrite behavior are visible.
- [ ] Tests cover import, persistence, refresh, accessibility, and deployment.
- [x] PRODUCT.md, README.md, and this plan match shipped behavior.
