# Shared Page Scroll Hotfix Design

## Problem

Long public Quick Share pages render beyond the viewport but cannot scroll. The global workspace stylesheet applies `overflow: hidden` to `body`, even though the public `/share/[publicId]` route is a normal document page rather than the fixed-height editor workspace.

Production reproduction shows a document height of about 10,894 pixels in a 720-pixel viewport while `body` computes to `overflow-y: hidden` and `window.scrollY` remains zero.

## Design

Restore the browser's default document scrolling by removing the global `body` overflow lock. Keep the editor workspace fixed to the viewport through its existing `.workspace-shell` rules: `height: 100dvh` and `overflow: hidden`.

This keeps scrolling ownership at the correct boundary:

- Public and terminal-state pages use normal browser-page scrolling.
- The editor workspace remains a viewport-sized application shell.
- Editor, shelf, preview, and split panes retain their existing internal overflow behavior.

An internal scroll container on the public page was considered but rejected because it would duplicate browser scrolling, complicate restoration and anchor behavior, and preserve an editor-only global constraint.

## Testing

Add a regression assertion to the production-readiness stylesheet test that proves `body` is not globally scroll-locked while `.workspace-shell` remains height-constrained and overflow-hidden. Verify the test fails before the CSS change and passes afterward.

Run the complete unit, lint, typecheck, build, and end-to-end suites. Confirm the long deployed document's equivalent local page scrolls at desktop and mobile viewport sizes, while the editor workspace does not gain outer-page scrolling.

## Scope

Only the global scroll ownership rule and its regression coverage change. No reader markup, typography, database behavior, API behavior, or persisted content changes.
