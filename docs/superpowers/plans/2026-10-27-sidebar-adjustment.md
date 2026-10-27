# Sidebar adjustment implementation plan

> Implement inline using the existing Next.js, React, CSS and Playwright patterns.

**Goal:** Resolve issue #31 by making the Library sidebar scrollable and manually resizable.

**Spec:** https://github.com/ny147/mdez/issues/31 and the existing interaction contract in `design.md`.

**Architecture:** Preserve the default 272px sidebar and the existing collapse/drawer controls. Add a desktop separator that updates a browser-local width preference, bounded to 240–480px. Use the same width for the header and content grid. Preserve the continuous Library list, with a minimum usable height and an outer scroll fallback for short viewports. Tablet/mobile retain their current drawer dimensions.

## Constraints and review focus

- No new dependencies, document storage changes, or server changes.
- Pointer capture must stop dragging after release, cancellation or capture loss.
- Arrow keys adjust by 16px; Home/End select the bounds; double-click restores 272px.
- Invalid or unavailable localStorage must leave resizing usable in memory.
- Collapsing and reopening preserve width; mobile/desktop transitions preserve the desktop preference without horizontal overflow.
- Long lists and short viewports must keep Library controls reachable without scrolling the document.

## Implementation

- [x] Add Playwright regressions and observe the missing separator fail.
- [x] Add width persistence and accessible pointer/keyboard separator; connect the workspace CSS variable.
- [x] Add short-panel scrolling fallback and unit coverage for preference validation/storage failure.
- [x] Update user/design documentation and inspect desktop/mobile screenshots.
- [x] Run lint, typecheck, unit tests, build, affected Playwright flows and diff checks.
- [ ] Review, commit task files, push the branch, fetch origin and open a PR targeting main. The user merges manually.

## Verification

Lint, typecheck and production build passed. Unit tests: 435 passed in 62 files.
Full production Playwright run: 209 passed, 11 conditional skips. After review,
constrained the workspace dropdown to avoid overflow at narrow sidebar widths;
the added regression failed before the fix. Rebuilt and reran the final sidebar
suite: 6 passed, 2 desktop-only skips on mobile. Read-only review has no remaining
actionable findings. Desktop/mobile and short-viewport screenshots inspected.
