# Mdez First-Load Workspace Refinement Design

## Objective

Improve the accessibility, typography, spacing, and responsive behavior of the Mdez first-load workspace without turning it into a marketing landing page or changing its existing brand palette. The result should make the first useful action obvious, reduce repeated interface scaffolding, and preserve every existing library, import, editor, reader, split, autosave, and export behavior.

## Approved Direction

Use a surgical semantic and layout refinement. Keep the current component architecture and brand tokens, correct the mode-control semantics, reorganize first-load actions at constrained widths, clarify the heading hierarchy, improve compact text legibility, and align the recent-page language with actual behavior.

This direction was selected over two alternatives:

- A CSS-only pass would reduce visual congestion but leave the navigation semantics and information-model ambiguity unresolved.
- A broader first-run restructure would offer more onboarding guidance but would introduce unnecessary interaction and regression risk.

## Product and Brand Constraints

- `/` continues to open directly into the working Mdez workspace.
- Preserve the current berry, lavender, mint, canvas, paper, ink, muted, and rule token values.
- Do not introduce a hero, marketing copy, account flow, cloud language, onboarding wizard, or new feature.
- Shelf, Edit, Read, and Split retain their current behavior and order.
- Existing IndexedDB persistence, imports, exports, GitHub integration, drawer behavior, split resizing, editor actions, and reader behavior remain unchanged.
- The disabled Book ZIP action remains visible when no book is open and continues to explain its prerequisite.
- Maintain WCAG AA text contrast, visible focus, keyboard access, inert overlays, reduced motion, and a single polite status region.

## Architecture

The refinement stays within the current presentation boundaries:

- `MdezWorkspace` continues to coordinate mode, sidebar, drawer, selection, status, and domain operations.
- `ShelfPane` continues to own the bookshelf, first-load actions, and recent-page collection.
- `Sidebar`, `DocumentList`, and `WorkspaceStatus` retain their existing responsibilities, with small presentation and copy adjustments only.
- `workspace.css` remains the source of shell geometry, component layout, responsive rules, focus treatment, and compact typography.
- `tokens.css` remains the source of brand values. No color token value changes are required.

No new runtime dependency, state store, data model, route, API, or reusable abstraction is needed.

## Interaction Design

### Workspace mode controls

The desktop and mobile mode controls represent mutually exclusive workspace state, not document tabs with independently persistent panels. Remove `role="tab"` and `aria-selected` from these buttons. Keep each group inside its named navigation landmark and expose the active mode with `aria-pressed="true"`.

Selected styling uses the existing tinted mode background, mode accent border or indicator, and `--color-ink` for small selected text. This preserves the palette while ensuring the label is not dependent on a borderline berry-on-pink combination.

Mode changes continue to close the mobile drawer. Focus behavior and keyboard activation remain native button behavior.

### First-load action hierarchy

The main Shelf surface remains the primary place to understand and begin work. Its action group keeps all existing actions but establishes the following hierarchy:

1. `Create page` is the primary action.
2. `New book` and `Import markdown` are secondary actions.
3. `Book ZIP` is a contextual utility and remains disabled until a book is open.

The sidebar keeps its existing commands because they remain useful after content exists, but their visual treatment is compact and subordinate to navigation. The main surface does not add any new duplicated command.

### Heading hierarchy

The workspace context strip owns the single page-level `h1` when Shelf is active. Rename the shelf section heading from `Bookshelf` to `Books` so it identifies the collection without repeating the page title.

Heading scale and weight descend consistently:

- Page title: display family, `clamp(1.5rem, 2.2vw, 2rem)`, strongest weight.
- Section heading: display family, `1.25rem`, weight `800`, lower weight than the page title.
- Card or group label: body family, `0.875rem`, weight `700`.

Use balanced wrapping on headings and pretty wrapping on guidance copy where supported.

## Copy and Information Model

- Rename `Bookmarked pages` to `Recent pages` because the list is derived from update time and does not represent an explicit bookmark state.
- Change its accessible list name and related test expectations to `Recent pages`.
- When a book is open, explain that recent pages are filtered to that book.
- Replace `Create books when this shelf grows` with `Create a book to group related pages.`
- Preserve the terms book and page throughout the rest of the workspace.
- Do not expose raw ISO timestamps. Extract the current relative-time behavior into `src/lib/relative-time.ts` and use it in both `DocumentList` and `ShelfPane`, such as `Updated 5 min ago`.

## Typography

- Workspace status text, mobile mode labels, sidebar timestamps, and recent-page timestamps render at `0.8125rem` (13px) or larger.
- Mobile mode labels use `0.8125rem` with at least `1.2` line height.
- The status bar retains its compact height but increases legibility through font size, line height, and stable truncation rather than reduced contrast.
- Secondary metadata may remain visually quiet through weight and placement, not by shrinking below the legible compact scale.
- Human-readable relative timestamps are consistent between sidebar and main content.
- Existing Space Grotesk, Inter, JetBrains Mono, and Shippori font roles remain unchanged.

## Spacing and Responsive Layout

### Wide desktop, at least 1200px

- Keep the current sidebar and render the main action group in a single row with no wrapped labels.
- Preserve the existing mode navigation and status geometry.
- Maintain clear separation between contextual guidance, actions, books, and recent pages.

### Tablet and constrained desktop, 768px to 1199px

- Render the main Shelf actions as a deliberate two-column, two-row grid.
- Keep all four action labels on one line and avoid the current tall, uneven two-line button row.
- Place supporting guidance above or below the action grid rather than squeezing it beside wrapped actions.
- Keep primary and contextual action styling distinct inside the grid.

### Mobile, below 768px

- Retain the stacked action layout and 44px minimum interactive targets.
- Reduce redundant vertical labels so useful shelf content appears earlier.
- Keep the bottom navigation, drawer, status bar, and horizontal split behavior unchanged.
- Ensure no document-level horizontal overflow at 390px and 430px.

Fluid gaps should preserve tight grouping within an action cluster and larger separation between sections. Existing radii and border treatments remain unchanged.

## Accessibility Requirements

- Workspace mode buttons expose `aria-pressed` and no unsupported tab contract.
- The active selected label reaches at least 4.5:1 contrast by using existing ink text on the existing selected surface.
- Named navigation landmarks remain distinct on desktop and mobile.
- One visible `h1` remains on each active top-level surface.
- All interactive controls remain keyboard reachable with the existing visible focus treatment.
- Mobile drawer content remains inert when closed, and background content remains inert while the drawer is open.
- Status updates continue through the existing single polite live region.
- Disabled Book ZIP remains programmatically disabled and its prerequisite remains discoverable.
- Layout remains usable at 200% browser zoom and at the existing tested widths of 390, 430, 768, 1024, and 1440px.

## Data Flow and Error Handling

This work does not alter data flow. Mode changes continue through `handleViewModeChange`; library creation, import, export, persistence, GitHub operations, and status messages retain their current handlers.

The relative-time presentation is a pure formatting concern. `formatRelativeTime(value: string, now = Date.now()): string` consumes the existing `updatedAt` value. Invalid or future values return `recently`; values below 60 minutes return `[N] min ago`; values below 24 hours return `[N] hr ago`; older values return `[N] days ago`. The formatter must never affect sorting, selection, or persistence.

Existing error messages, disabled states, save feedback, and recovery behavior remain unchanged except for improved legibility and spacing.

## Files Expected to Change

- `src/components/mdez/MdezWorkspace.tsx`: correct desktop and mobile mode-control semantics and active-state attributes.
- `src/components/mdez/ShelfPane.tsx`: clarify first-load hierarchy, rename Recent pages, and improve guidance copy.
- `src/components/mdez/DocumentList.tsx`: replace raw timestamps with consistent relative labels.
- `src/lib/relative-time.ts`: own the shared, deterministic relative-time formatter with an optional `now` input for tests.
- `tests/unit/relative-time.test.ts`: cover minutes, hours, days, future values, and invalid input.
- `src/app/styles/workspace.css`: update selected-state text treatment, compact typography, heading hierarchy, action spacing, and tablet/mobile grids.
- `tests/e2e/mdez.spec.ts`: cover mode semantics, selected-state contrast, heading uniqueness, responsive action geometry, Recent pages language, relative timestamps, and overflow.

## Test Strategy

Implementation follows test-driven development.

1. Add failing end-to-end assertions that mode buttons use `aria-pressed` and do not expose incomplete tab roles.
2. Add a failing selected-state contrast assertion based on computed foreground and background colors.
3. Add a failing 768px geometry assertion that the four Shelf actions form two columns and do not wrap labels.
4. Add failing assertions for one visible page heading and a descending section-heading size and weight.
5. Add failing copy assertions for Recent pages and the new grouping guidance.
6. Add failing unit tests for the shared relative-time formatter and a failing end-to-end assertion that sidebar timestamps are human-readable rather than ISO strings.
7. Preserve and rerun existing drawer, mode switching, import, export, shelf context, no-document, and overflow tests.
8. Run lint, typecheck, production build, and the full unit and Playwright suites.
9. Inspect the live workspace at 1440×900, 768×900, and 390×844 after implementation.

## Acceptance Criteria

- Existing brand color values remain unchanged.
- Desktop and mobile mode buttons have accurate pressed-state semantics.
- Selected compact labels meet WCAG AA contrast using existing palette roles.
- The 768px Shelf action group is a readable 2-by-2 grid without two-line labels.
- The active Shelf surface has one visible `h1` and no repeated Bookshelf section heading.
- Workspace status text, mobile mode labels, sidebar timestamps, and recent-page timestamps are at least 13px.
- Recent-page labels and timestamps describe the actual data shown.
- No horizontal overflow occurs at 390, 430, 768, 1024, or 1440px.
- Existing workspace behaviors and automated tests remain intact.
- Fresh lint, typecheck, build, unit, end-to-end, and visual verification complete successfully.

## Out of Scope

- New onboarding flows, tutorials, empty-state illustrations, or marketing sections.
- Changes to the brand palette, font families, logo, mascot, or mode color meanings.
- New shortcuts, undo systems, bookmarking features, accounts, sharing, or cloud storage.
- Refactoring repository, persistence, import, export, GitHub, editor, reader, or split-workspace logic.
