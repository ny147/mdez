# Workspace UI Polish Design

**Date:** 2026-08-12

## Objective

Polish the existing Mdez workspace so its hierarchy, contrast, navigation, and long-title behavior are clearer and more accessible without redesigning the quiet pastel library identity or changing product behavior.

The shared workspace shell means these improvements apply to both Local Library and Key Group workspaces. Key Group creation, joining, refresh, permissions, key handling, conflict resolution, and persistence logic remain unchanged.

## Design Direction

Use a focused component polish rather than a CSS-only patch or a shell redesign. Preserve the existing pale unified top bar, semantic mode colors, component structure, and responsive breakpoints. Correct the narrow issues at their existing component or token boundary.

The workspace remains an **Operate** surface: task clarity, scanability, accessibility, and predictable controls take priority over decorative expression.

## Interaction Hierarchy

### Page creation

- Keep the Shelf action as the prominent primary `Create page` command.
- Retain the sidebar shortcut because it remains useful while working in Edit, Read, and Split modes.
- Render the sidebar shortcut with secondary visual emphasis so it does not compete with the Shelf action.
- Preserve the contextual label `Create page in [book]` when a book is selected.
- In an empty sidebar page list, expose one clear recovery action without rendering two equally prominent create buttons in the same section.

### Workspace modes

- Preserve the `Shelf`, `Edit`, `Read`, and `Split` labels, order, mode state, and keyboard semantics.
- Replace the subtle desktop underline treatment with a restrained filled active tab and a visible border or inset indicator.
- Continue using the current mode-specific accent color for the selected state.
- Keep inactive, hover, focus, pressed, and selected states visually distinct without relying on motion.
- Preserve the existing mobile bottom-navigation pattern while aligning its selected-state strength with the desktop control.

## Header Cohesion

- Preserve the existing single pale top bar and its current grid relationship with the sidebar and workspace content.
- Do not introduce a stacked black bar, separate utility strip, or additional navigation row.
- Keep borders and background treatment continuous across the brand, mode navigation, and action areas.
- Retain the current responsive drawer and desktop sidebar toggles.

## Contrast and Legibility

- Meet WCAG AA contrast for normal text and control labels against their default, hover, selected, and disabled backgrounds.
- Strengthen low-contrast sidebar text and interactive surfaces through semantic tokens rather than isolated hard-coded colors.
- Preserve berry, lavender, mint, and paper roles while using darker foregrounds where required.
- Keep visible keyboard focus at least as strong as the current shared focus treatment.
- Do not encode selection or availability by color alone.

## Long and Localized Titles

- Replace single-line truncation on page cards with a two-line clamp where the layout has room.
- Preserve stable card geometry and prevent long Thai, Latin, or unbroken titles from expanding the sidebar or creating horizontal overflow.
- Expose the complete title through the element's accessible name and native hover title.
- Keep single-line truncation only in space-constrained status or toolbar locations where expanding the row would destabilize the shell.
- Verify representative Thai titles at desktop, tablet, and mobile widths.

## Icon-Only Controls and Tooltips

- Every icon-only action must have a specific accessible name.
- Add a native visible tooltip through the shared icon-button pattern where practical; existing controls that already provide both `aria-label` and `title` remain unchanged.
- Tooltip text must name the action, not merely the icon.
- Do not depend on hover for comprehension on touch devices; accessible names and surrounding context remain sufficient.
- Decorative icons stay hidden from assistive technology.

## Component Boundaries

- `src/app/styles/tokens.css` owns any reusable contrast or selected-state color roles.
- `src/app/styles/workspace.css` owns mode-tab presentation, sidebar hierarchy, title clamping, and responsive states.
- `src/components/mdez/DocumentList.tsx` owns page-list creation hierarchy and complete-title exposure.
- `src/components/mdez/DocumentActions.tsx` owns the page-management disclosure styling and labels.
- `src/components/ui/IconButton.tsx` remains the reusable icon-only control when its existing interface fits the caller.
- `src/components/mdez/MdezWorkspace.tsx`, `Sidebar.tsx`, and `FolderTree.tsx` change only when required to apply the shared styling or tooltip contract; their state and domain behavior remain intact.

No new dependency, global state, route, or server API is required.

## Accessibility and Responsive Acceptance

- Desktop tabs expose `role="tab"`, `aria-selected`, visible focus, and a clearly filled selected state.
- Sidebar and Shelf create actions remain distinguishable by both styling and context.
- Every icon-only control in the affected path exposes an accessible action name and tooltip.
- Long Thai titles remain readable for two lines, expose their full value, and do not create horizontal overflow.
- The workspace has no horizontal overflow at 390, 430, 768, 1024, and 1440 pixels.
- The drawer, bottom navigation, split layout, and status bar retain their current behavior.
- Local Library and Key Group workspaces render the same polished shared shell.

## Verification Strategy

Use test-driven changes for behavior and semantic contracts:

1. Add focused Playwright assertions for primary-versus-secondary creation hierarchy, selected mode styling, complete-title exposure, and icon-only tooltip contracts.
2. Run each focused test and confirm it fails for the intended missing behavior before changing production code.
3. Make the smallest component and token changes needed to pass.
4. Run the relevant existing workspace and Key Group tests to guard shared-shell behavior.
5. Inspect one desktop and one mobile viewport together, fix all observed defects in one batch, and perform at most one confirmation pass.
6. Run the Impeccable detector once over the changed UI targets after visual changes are complete.
7. Finish with unit tests, lint, typecheck, production build, and the targeted end-to-end suite.

## Out of Scope

- Redesigning the visual identity or navigation architecture.
- Changing factual product copy beyond action clarity and tooltip labels.
- Changing Key Group creation, joining, refresh, permissions, key handling, conflict behavior, persistence, API routes, or database logic.
- Adding animation, a new tooltip library, theme controls, or new workspace modes.
- Reworking unrelated dialogs, editor behavior, Markdown rendering, sharing, import, or export functionality.
