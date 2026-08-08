# Mdez focused UX/UI review

## Review status

This review records the P1 audit of the shipped quiet pastel library interface and the public GitHub import flow. It replaces the earlier pre-redesign review. Findings here are based on the current implementation, automated coverage, and captured browser screenshots; direct Task 10 human visual inspection was blocked by the Windows split-root sandbox.

Reviewed states include fresh and populated shelves, local paste/file import, first and repeated GitHub import, preview success/failure/retry, refresh confirmation, refresh success/failure, editor, reader, split view, empty states, and desktop/mobile navigation.

## Blocking findings resolved

### Inactive import panels were still visible

The Public GitHub panel used a grid utility that overrode the browser's `hidden` presentation. As a result, GitHub controls could appear below the active Paste panel.

Resolution:

- Inactive panels now use an explicit `hidden` class.
- An E2E regression checks that only the active source input is visible on desktop and mobile.

### Import source tabs lacked keyboard navigation

The source chooser exposed tab semantics but initially required pointer activation.

Resolution:

- Left/Right arrows wrap between sources.
- Home and End select the first and last sources.
- Roving `tabIndex` keeps one tab in the normal focus order.
- Closing the dialog restores focus to the import trigger.

### Status messages were announced twice

Sidebar errors used an assertive alert while the footer already announced the same operation through the workspace status.

Resolution:

- The footer is the single app-owned polite live region.
- Sidebar error text remains visible but is no longer a second announcement.

### Placeholder contrast was too low

The browser-default URL placeholder measured about 2.5:1 against the input surface.

Resolution:

- Paste and GitHub placeholders now use `--muted` (`#725f7c`).
- This is about 5.7:1 on `--surface` (`#fffdfd`), above the WCAG AA target for normal text.

## High-value improvements completed

- Import sources use short, stable labels: `Paste`, `Markdown files`, and `Public GitHub`.
- Mobile source icons yield to full text labels at narrow widths.
- GitHub input, preview, progress, result, and error states stay in one dialog without layout switching.
- Ignored content and operational limits are available in a collapsed `Import details and limits` disclosure.
- Refresh warns before replacing source-owned pages, supports cancel, and preserves prior content after an upstream failure.
- Editor toolbar glyphs use encoding-safe rendering.
- Empty and recovery states keep one visually primary action and consistent verb-and-object labels.

## Reading and responsive checks

- Reader prose uses the reader font while inline and block code remain monospaced.
- Preview content is capped at a comfortable 65–75 character measure.
- Existing Markdown coverage checks headings, links, code, blockquotes, tables, and table of contents behavior.
- Supported widths 390, 430, 768, 1024, and 1440 px are covered by responsive E2E checks and automated rendered assertions with screenshot captures.
- At 390 px the document width equals the viewport width, the GitHub dialog fits vertically, and source labels do not truncate.
- Desktop and mobile expose the same Shelf, Edit, Read, Split, create, import, refresh, and export commands.
- Long document and repository names use constrained flex layouts and truncation where space is finite.

## Accessibility and interaction checks

- Dialog focus is trapped, Escape/cancel behavior is guarded while busy, and trigger focus is restored on close.
- Closed drawers and inactive panels are inert or removed from the focus order.
- Controls have visible accessible names; source selection uses tab/tabpanel relationships.
- Default, hover, focus, active, selected, disabled, loading, success, warning, and error treatments are represented in the component styles and tested flows.
- State transitions use 160–200 ms durations. The reduced-motion media query collapses them to 0.01 ms.
- Text tokens measured during the audit: muted on panel about 5.2:1, muted on surface about 5.7:1, accent on surface about 5.2:1. The file accent is reserved for larger or bold UI text where its borderline normal-text ratio is appropriate.
- Responsive reflow and focus order remain usable at narrow CSS viewports representative of 200% zoom.

## Remaining optional items

- Add automated visual-regression snapshots if the project adopts a stable screenshot baseline.
- Revisit the file-accent token if it is later used for small, regular-weight body text.
- Production smoke testing remains a P2 deployment gate and is not part of this local P1 review.

## Verification evidence

- Focused desktop/mobile tests cover active panels, arrow navigation, focus restoration, and the single live region.
- Full E2E covers fresh/populated states, import, retry, refresh preservation, reader typography, navigation, export, persistence, and supported widths.
- Lint, strict typecheck, unit tests, full E2E, and production build are the required final verification commands in `docs/implementation-plan.md`.

## Workspace quality redesign resolution — 2026-07-14

| Reviewed issue | Resolution evidence |
|---|---|
| 768px Split breakpoint cliff | Tablet Split test and automated 768×1024 capture assertions |
| Mobile separator rejected touch | Mobile pointer-resize Playwright test |
| Nested cards flattened hierarchy | Surface-shadow contract and automated Shelf/Read capture assertions |
| Repeated document identity | Single-H1 Read contract |
| Mobile toolbar targets and hidden exports | 44px target and viewport-containment tests |
| Typography token drift | Computed Shippori reader-family test |
| Oversized workspace coordinator | Draft and library hooks with focused unit tests |
| Monolithic import dialog | Shell and source panels protected by import E2E coverage |
| Heavy initial JavaScript | Production build comparison against 489 kB baseline |
