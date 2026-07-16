# Task 8 Fix Report: Mobile toolbar focus order

## Outcome

Aligned the mobile toolbar's visual rows with its existing DOM and Tab order. Formatting actions now occupy the first mobile row and document export actions occupy the second, while desktop remains format-left/actions-right.

## Root cause

`EditorToolbar` renders formatting actions before document actions, but the Task 8 mobile CSS placed document actions in row 1 and formatting actions in row 2. Keyboard focus therefore entered the visually lower formatting row first and later jumped back to the visually upper export row.

## TDD evidence

- Added a focused mobile browser contract before changing production CSS.
- RED in Chromium and mobile: the formatting strip resolved to y=275 while document actions resolved to y=227, failing the top-to-bottom visual-order assertion in both projects.
- The test snapshots toolbar button rows and left-to-right positions, compares that visual order with the expected Tab sequence, then verifies each focused button.
- The test also requires all eight formatting targets to be at least 44 by 44 pixels, both export controls to remain inside the 390px viewport, the formatting strip to be horizontally scrollable, and the page itself to have no horizontal overflow.
- GREEN after the two-line mobile row swap: 2/2 focused tests passed.

## Implementation

- Changed only the mobile `grid-row` assignments in `workspace.css`: formatting actions use row 1 and document actions use row 2.
- Kept the DOM unchanged, avoiding layout JavaScript, duplicate controls, and focus-management workarounds.
- Preserved all eight format actions, labels, glyphs, order, callbacks, 36px desktop sizing, 44px mobile formatting sizing, export behavior, and canonical Task 7 tokens.
- Kept the mobile sizing selector scoped to toolbar formatting buttons, so unrelated `.workspace-icon-button` controls remain unchanged.

## Verification

- Focused mobile visual/Tab-order contract: 2/2 passed across Chromium and mobile.
- Toolbar, export, split, tablet, and horizontal-overflow regression set: 22/22 passed across Chromium and mobile, including widths 390, 430, 768, 1024, and 1440.
- Full unit suite: 156/156 passed across 13 files.
- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: passed; Next route types generated and TypeScript emitted no diagnostics.
- `git diff --check`: passed.

## Baseline warnings

- Vitest reports the existing Vite CJS API deprecation warning.
- Playwright reports the existing `NO_COLOR`/`FORCE_COLOR` warning.
- Next development E2E reports the existing future `allowedDevOrigins` warning.