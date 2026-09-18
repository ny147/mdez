# Dark mode save point

Date: 2026-09-18. Branch: `codex/dark-mode-plan`. Implementation checkpoint: `9b464cd`.

## Latest user-requested simplification

The header now switches directly between Light and Dark on one click. The menu and visible System option are removed. The icon, tooltip, and accessible name identify the next action. Before the first click, the existing device preference still applies; subsequent choices persist normally. This supersedes the original chooser descriptions below.

Verification for this follow-up: lint, typecheck, all 357 unit tests, and production build passed. Affected desktop/mobile Playwright checks passed (15 passed, one intentional desktop skip for the mobile drawer case). Visual review and independent static code review found no remaining issues. An existing dev server was rewriting `.next`; after stopping those verified project processes and rebuilding, browser checks passed on isolated port 3107 using the existing Playwright projects. The development preview was restored on port 3000 afterward.

The previous remote publication approval restriction still applies to agent pushes. The original implementation is now tracked on origin; this simplification is committed locally for review.

## Approved scope

App-wide midnight blue dark mode; Light / Dark / System in a header chooser; default System; browser-wide saved preference; muted pastel covers. User authorized implementation and requested a save point if work remains unfinished.

## Implemented

Theme bootstrap before hydration; shared preference provider; device and cross-tab updates; restricted-storage fallback; accessible chooser across the workspace and public shared-page states; dark semantic tokens; editor reconfiguration without remounting; dedicated code colours; readable group action labels. Opening Theme closes the mobile library drawer to prevent the overlay hiding the chooser. No database or dependency changes.

## Verification completed at this checkpoint

- ESLint: passed.
- Typecheck: passed (the initial test-only matcher typing error was corrected).
- Full unit suite: 52 files, 357 tests passed.
- Targeted theme Playwright suite: 15 passed, 1 intentional desktop skip for the mobile-only drawer test.
- Additional editor heading contrast check: passed on desktop after adding it to the theme suite.
- Production build: passed. An initial browser-run startup failure caused by dev-server replacement of `.next` was resolved by rebuilding before running the production server.
- Full production Playwright suite: passed. The run scheduled 198 cases; its final saved `test-results/.last-run.json` records `status: passed` with no failed tests. The terminal session expired before its final count summary could be retrieved, so no passed/skipped count is asserted here.
- Visual inspection: dark desktop Shelf/Edit/Read, mobile dark and light Read, and mobile public Quick Share layouts inspected; code blocks, math, tables, and header fit.
- Independent code review found a mobile overlay conflict; it was reproduced, fixed, and covered by the passing drawer regression test.
- Impeccable mechanical detector: no findings.

## Resume from here

1. Continue the same task branch and preserve its changes. Read the design and implementation plan alongside this file. Do not create another branch or reset main.
2. Implementation and required checks are complete. Do not rerun checks unless code changes or a new concern warrants it. Browser/subprocess commands require the approved elevated execution context in this Windows sandbox.
3. Retain only task-owned documentation/code in git. `test-results/` is ignored and regenerated on each browser run.
4. Fetch origin before handoff and report whether the branch is behind without integrating upstream changes; the most recent completed freshness check showed zero commits behind.
5. Push this branch with its own upstream and create a PR targeting main **only after explicit user approval to publish this branch's source and history to public `https://github.com/ny147/mdez`**. Automatic approval review rejected both the initial push and the evidence-backed retry. A read-only GitHub API check confirmed the configured destination is that public repository, default branch main, but the reviewer still required explicit payload/destination authorization. Do not bypass or retry without that approval. GitHub CLI (`gh`) is not on PATH; use an available authenticated GitHub route or report the exact PR-creation blocker. Do not expose credentials in tool output.

## Prepared PR

Title: `Add midnight blue dark mode with remembered appearance preferences`

Body: Mdez now offers Light, Dark, and System from the header across local and group workspaces and public Quick Share pages. The midnight blue palette preserves muted book identities, readable Markdown/code, and editor state. Device appearance is the default; browser preferences persist and synchronize across tabs, with a pre-hydration initializer and restricted-storage fallback. Opening Theme dismisses the mobile drawer so its overlay cannot hide the choices.

Validation: lint, typecheck, 357 unit tests, production build, and the full production Playwright suite passed. Desktop/mobile visual review and dark text/cover contrast checks passed. The full browser run scheduled 198 cases and its saved report has no failures; exact final passed/skipped counts were not recovered. No dependencies, database migrations, deployment, or merge are included. The user merges manually.

The user merges manually. No deployment, automatic merge, or branch deletion is authorized.
