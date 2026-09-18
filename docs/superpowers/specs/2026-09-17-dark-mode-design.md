# Midnight blue dark mode

Approved in the planning conversation on 2026-09-17; implementation authorized by the user.

## Approved simplification

The user's subsequent UI feedback supersedes the chooser described below: remove the menu and expose only a one-click Light/Dark toggle. The sun icon and accessible name "Switch to light mode" select Light; the moon icon and name "Switch to dark mode" select Dark. Follow the device before the first explicit choice, and retain compatibility with existing stored System preferences. A click saves the opposite of the currently resolved theme and dismisses the mobile drawer. Native button keyboard activation replaces menu navigation. All persistence, editor preservation, palette, and shared-page requirements remain unchanged.

## Experience

Dark mode covers Shelf, Edit, Read, Split, dialogs, local libraries, Key Groups, and all public Quick Share states. A header Theme button opens Light, Dark, and System radio choices. System is the initial preference. The browser remembers an explicit preference across workspaces and routes; a shared page follows its viewer's preference, never its author's.

Midnight blue replaces the initially explored warm charcoal palette: canvas #101827, panel #172238, paper #141e30, primary text #E8EEF8, secondary text #AEBCD2, lavender #BCB0F5, cyan #83D3E6. Book covers retain their stable colour identities with muted dark variants. Preserve existing light colours, typography, layout, and illustrations.

## Behaviour and boundaries

- Apply the resolved theme before body content paints. Hydration must not warn or reset the preference.
- Follow device colour changes only in System mode; synchronize saved choices across same-origin tabs.
- Invalid or missing preferences resolve to System. Storage failures leave the control usable for the current session. A missing media-query API falls back to light.
- Escape closes the chooser and returns focus; clicking outside or leaving its focus area closes it. Use native radio navigation and 44px touch targets.
- Changing themes must not remount CodeMirror or lose drafts, undo history, selection, reader settings, or scroll positions.
- Use semantic tokens, including dedicated code foreground/background tokens. Do not mechanically invert colours or recolour user images.
- No document schema, database, sharing payload, credentials, or dependency changes.

## Acceptance

Verify preference reload, device changes, cross-tab changes, restricted storage, pre-hydration rendering, editor state, Quick Share ready/loading/error/expired states, keyboard operation, dark and light contrast, and desktop/mobile layout. Run lint, typecheck, unit tests, build, and Playwright. Publish a task-branch PR for manual merging; no deployment.
