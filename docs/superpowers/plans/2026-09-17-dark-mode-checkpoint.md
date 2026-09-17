# Dark mode save point

Date: 2026-09-17. Branch: `codex/dark-mode-plan`.

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
- Production build: passed once. Later dev-server tests replaced `.next`; the attempted production browser run could not start because the production BUILD_ID was no longer present. This is a build-artifact sequencing issue, not a compile failure.
- Visual inspection: dark desktop Shelf/Edit and mobile Read layouts inspected; code blocks, math, tables, and header fit. Final production screenshots remain to inspect.
- Independent code review found a mobile overlay conflict; it was reproduced, fixed, and covered by the passing drawer regression test.
- Impeccable mechanical detector: no findings.

## Resume from here

1. Continue the same task branch and preserve its changes. Read the design and implementation plan alongside this file. Do not create another branch or reset main.
2. Run `npm run build`, then run the full `npm run test:e2e` suite with `PLAYWRIGHT_WEB_SERVER_COMMAND=npm run start`. Avoid starting the dev server between those commands. Inspect results and fix genuine failures. Browser/subprocess commands require the approved elevated execution context in this Windows sandbox.
3. Inspect final desktop/mobile dark and light screenshots; retain only task-owned documentation/code in git. `test-results/` is ignored and regenerated on each browser run.
4. Review the task diff and `git diff --check`; fetch origin and report whether the branch is behind without integrating upstream changes.
5. Commit final changes, push this branch with its own upstream, and create a PR targeting main. Draft the PR if any required check remains blocked. GitHub CLI (`gh`) is not on PATH; use an available authenticated GitHub route or report the exact PR-creation blocker. Do not expose credentials in tool output.

The user merges manually. No deployment, automatic merge, or branch deletion is authorized.
