# AGENTS.md

## Scope

These instructions apply to development work throughout this repository. Read any
more specific `AGENTS.md` in the directories you change as well.

## Required Git workflow

- Before editing files or implementing any task, inspect `git status --short --branch`
  and `git branch --show-current`.
- Before starting a new task, require a clean working directory. If tracked changes
  or untracked files exist, stop and ask the user to commit or stash them. Do not
  automatically stash changes or create a separate worktree to bypass this rule.
- Run `git fetch origin` before starting a new task. If fetching fails, stop before
  implementation and report the blocker; do not use a potentially stale base.
- Create and switch to a new task branch from the freshly fetched `origin/main`
  **before making any changes**, including code, tests, documentation, configuration,
  dependency updates, or generated files:
  `git switch --no-track -c codex/<short-task-name> origin/main`.
  Use the user's branch name when supplied. Do not run `git pull` on local `main`.
- When resuming the same task, continue on its existing task branch and preserve its
  in-progress changes. The clean-start requirement applies to new tasks.
- Never implement, commit, or push directly on `main`. Do not reset, rebase, delete,
  force-update, or otherwise modify the local or remote `main` branch.
- If `origin/main` advances during development, report that the feature branch is
  behind. Do not merge or rebase it onto `origin/main`; the user handles integration.
- Confirm the task branch is active before writing files. If branch creation fails
  or HEAD is detached, resolve the branch setup before continuing; do not fall back
  to editing on `main`.
- Preserve existing uncommitted changes and untracked files. Do not discard, stash,
  overwrite, or include unrelated user work in a commit. Stage only task-owned files
  or hunks; avoid indiscriminate `git add .`.
- Keep the completed result on the task branch for human review. **The user merges
  manually.** Do not merge into `main`, merge a pull request, enable auto-merge, or
  automatically delete the task branch after completion.

## Project context

Mdez is a local-first Markdown reading and writing workspace built with Next.js
App Router, React, TypeScript, and Tailwind CSS. Local libraries use IndexedDB via
Dexie. Quick Share and Key Groups use server-side Postgres/Supabase storage.

- Read `README.md` for setup and operational details, `PRODUCT.md` for product
  requirements, and `CONTEXT.md` for agreed terminology. Consult relevant design
  documents before changing established UI behavior.
- `src/app/`: routes, API handlers, layouts, and application styles.
- `src/components/`: workspace components and reusable UI.
- `src/hooks/`: stateful browser and workspace behavior.
- `src/lib/`: local persistence, domain logic, import/export, and API clients.
- `src/server/`: database access, authorization, services, and server-only secrets.
- `src/types/`: shared domain types.
- `supabase/migrations/`: database migrations.
- `tests/unit/` and `tests/e2e/`: Vitest and Playwright coverage.

## Development conventions

- Follow existing TypeScript, React, naming, and styling patterns. Keep changes
  focused on the requested task and reuse existing components and domain helpers.
- Keep browser-only APIs in appropriate client code and server database access and
  secrets in server-only modules. Never expose secrets through `NEXT_PUBLIC_`.
- Preserve local-first behavior, workspace isolation, autosaved drafts, and conflict
  recovery. Storage changes must preserve existing user data.
- Follow the privacy and token-handling rules in `README.md`. Do not log Markdown
  payloads, raw group keys, management tokens, credentials, or raw IP addresses.
- Use npm and the existing `package-lock.json`. Avoid unrelated dependency upgrades.
- Update relevant documentation when behavior, setup, or product terminology changes.
- Deployment and production database operations require explicit user authorization;
  preparing code or migration files does not authorize applying them remotely.

## Setup and verification

```sh
npm ci
npm run dev
```

The development server runs at `http://localhost:3000` by default.

For code changes, run:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

- Add or update meaningful tests for changed behavior and bug fixes.
- Run `npm run test:e2e` for affected user flows, and check desktop and mobile layouts
  for UI changes. Use the existing Playwright configuration.
- For documentation-only changes, check accuracy and the diff; application tests
  are unnecessary unless the changes also affect executable code or configuration.
- Report failing or unavailable checks honestly, including environmental blockers.
  Do not claim a check passed unless you ran it and inspected the result.

## Completion handoff

- Review `git diff --check`, the task diff, and `git status --short --branch`.
- Fix required check failures. If blocked, record the failing or unavailable checks
  and the reason; do not describe the result as passing or ready to merge.
- Commit only task-owned changes, push the task branch with its own upstream, and
  open a pull request targeting `main`. If checks are blocked or failing, open a
  draft PR. Mark it ready for review only when all required checks pass.
- Fetch `origin` before the final handoff and report whether the branch is behind
  `origin/main`. If fetching fails, report that freshness could not be verified and
  leave the PR in draft. Do not automatically integrate upstream changes.
- If committing, pushing, or creating the PR is blocked, preserve the work and report
  the exact blocker and next action. Never fall back to pushing to `main`.
- Summarize the changes, task branch name, PR link, verification results, and remaining
  issues. Explicitly state that the user merges manually; do not merge the PR, enable
  auto-merge, or delete the task branch as part of finishing.
