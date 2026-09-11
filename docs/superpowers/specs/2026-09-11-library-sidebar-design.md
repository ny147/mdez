# Library sidebar: flat books and page navigation

Date: 2026-09-11
Status: Design decisions agreed in the grill-me interview; written specification ready for review. No implementation in this change.

## Purpose and scope

Replace the Library section's tall book-management rows and separate page list with one compact list of expandable books containing pages. Users must be able to locate, open, rename, and move pages without losing their writing context, including in large libraries.

Keep the approved Prism Pages logo, mascot rules, workspace search location and semantics, primary navigation, and reader/editor typography. The generated mockup establishes the Library layout only; its surrounding header and reader are not requirements. Existing My library, Recent pages, Bookmarks, workspace controls, GitHub source controls, and error feedback remain available.

This is an architectural change because removing nested books affects persisted content and multiple storage adapters, beyond the sidebar component.

## Agreed product model

- A book contains pages only. Books cannot contain other books.
- All books appear at the top level, naturally alphabetized. Pages within each book use natural alphabetical title ordering: Chapter 2 precedes Chapter 10. Use one consistent numeric-aware comparator with a stable ID tie-breaker. Existing order fields may remain for compatibility but do not govern this sidebar.
- Each book shows its direct page count, including zero. There are no descendant counts after migration.
- Unsorted pages is a fixed final collection below the books. It has a count and expandable page list but cannot be renamed or deleted.
- A page belongs to one book or Unsorted. Page identity and content do not change when moved.
- Only one collection may be expanded at a time, including Unsorted. All may be collapsed.

## Layout

Keep the Library heading and Create book control outside the scrolling list. Use a single scroll container for books and their expanded pages; do not nest a separate scrollbar inside a book. Unsorted is the final list item, not a pinned panel that consumes space needed by pages.

Each book row has a disclosure chevron, small book icon, single-line name, muted page count, and always-visible quiet ellipsis button. Pages are indented one level with a document icon, single-line title, and always-visible ellipsis button. Eliminate the persistent Rename/Add/Delete action row and the duplicate standalone DocumentList below the books.

Use the existing lavender surfaces, ink text, and violet accents. The active page has a pale selected background and narrow accent edge; its owning book gets a quieter contextual indication. Collection selection, page selection, and expansion are separate states. Do not present book selection as a large solid pink action button.

Truncate long names without displacing controls. Make full names available on hover and keyboard focus and preserve complete accessible labels. Target approximately 44px rows and at least 44px action targets. If the current sidebar width cannot fit these targets, adjust column allocation rather than shrinking names to zero or restoring a second action row.

## Navigation and persistence

| Trigger | Result |
| --- | --- |
| Click book name | Open that book's Shelf overview; preserve disclosure state. |
| Click Unsorted name | Open the Unsorted Shelf overview; preserve disclosure state. |
| Click disclosure | Toggle its page list, closing any other expanded collection; do not change the open page or workspace mode. |
| Select page | Open that page in the current Edit, Read, or Split mode. From Shelf, restore the last-used non-Shelf mode; default to Edit. |
| Open a search result | Reveal its owning collection, close the competing collection, and scroll the active page into view. Apply the same reveal behavior to other explicit page-opening actions such as Recent and Bookmarks. |
| Move the active page | Keep its content and mode open, expand the destination, and reveal the moved row. |
| Select page on mobile | Close the Library drawer after successful selection. Disclosure and menu use leave it open. |

Remember the expanded collection and last-used non-Shelf mode separately for each workspace in this browser. Store no document bodies or workspace access credentials in this UI preference. Distinguish Unsorted, all-collapsed, and missing preference states explicitly.

Restore a valid saved expansion on load. If restoring an active page into Edit/Read/Split, revealing that page takes precedence over the saved expansion. On Shelf, preserve the saved expansion. After loading, merely editing or receiving content updates must not repeatedly expand or scroll the list; explicit collapse remains respected. Ignore deleted IDs. Preference-storage failure falls back to in-memory state and must not prevent navigation.

## Management interactions

Book menu: Add page, Rename book, Delete book. Unsorted menu: Add page only. Page menu: Rename, Move to…, Delete page; preserve any other existing page actions needed by the incumbent interface. Page deletion retains its existing behavior and confirmation; the newly agreed content-preserving rule applies to book deletion.

Add page targets the invoking collection, creates the page through the existing content layer, reveals it, and opens Edit. The Library header creates a top-level book. Remove Create book inside and all other nested-book creation affordances.

Rename is inline for both books and pages. Focus and select the current name. Enter saves, Escape cancels, and explicit save/cancel controls support touch. Do not silently commit on blur. Trim names, reject blank input with adjacent feedback, and preserve the original name until persistence succeeds. If natural sorting relocates the renamed row, preserve focus and reveal it. Prevent duplicate submissions and retain the draft on failure.

Move to… opens a searchable destination picker containing all other books and Unsorted. Keep destinations scoped to the current workspace; the current destination is excluded or disabled. A move changes only page membership and the normal modification metadata, not its body, ID, or bookmark identity. Retain the source state and show actionable feedback if persistence fails.

Drag-and-drop offers the same move operation. Dropping on a book row or Unsorted moves the page there; dropping within its current collection is a no-op. Do not implement manual page ordering, book reordering, nesting, or cross-workspace drops. Show a clear valid destination highlight and cancel cleanly on Escape or dropping elsewhere. The Move to… picker is the equivalent keyboard and touch route; touch scrolling must not depend on precision dragging. After success, announce the destination. Moving a non-active page preserves the current active page and expansion.

Deleting a book requires confirmation such as: “Delete ‘Research’? Its 24 pages will move to Unsorted. No pages will be deleted.” Move every contained page to Unsorted and delete the book as one atomic operation. Preserve an active page and its mode; if it moved, reveal it under Unsorted. If its Shelf overview was active, show the Unsorted overview. An empty book can be removed through the same confirmation flow with accurate copy.

## Large lists, empty states, and accessibility

Use continuous scrolling with windowed rendering of nearby rows and overscan; no pagination or Show more. Derive a flat visible-row model consisting of book headers, the one expanded collection's pages, and Unsorted. Keep book headers, counts, and sorting memoized or indexed so rendering does not repeatedly scan every page for every book.

The virtualized implementation must retain a focused or inline-editing row while needed, use stable keys, support scrolling to items not currently mounted, and expose understandable list position and total size to assistive technology. Opening menus must not cause them to be clipped by the scroll container. Existing focus-managed mobile drawer behavior must be preserved.

An expanded empty collection shows “No pages yet” and an Add page action. An empty workspace keeps the existing first-use Shelf experience. Loading and persistence errors must not masquerade as an empty library.

Use semantic disclosure controls and nested list relationships, full accessible names, visible focus, expanded state, and current-page state. Do not declare an ARIA tree without implementing its full keyboard contract. Menus support keyboard opening, arrow navigation, Escape, and focus return. Selection must not depend on color alone. Reduced motion disables decorative transitions; virtual scrolling and focus updates remain functional.

## Migration and storage consistency

The current code uses Folder.parentId, recursive FolderTree rendering, a separate DocumentList, IndexedDB repository functions, and a separate shared-workspace backend. GitHub import also creates parent-linked folders. All must honor the flat model; hiding nesting in the UI alone is insufficient.

Migrate existing nested books to top-level books while preserving IDs and page memberships. Build each nested book's display name from its original full path, for example Research / Sources. Keep existing top-level names unchanged. Snapshot the original hierarchy before mutating any parent links. Set all migrated parent IDs to null.

Resolve generated name collisions by deterministic numeric suffixes, reserving existing top-level names first: Research / Sources (2), then (3), and so on until unique. Never merge books. Use stable processing order and the same normalization rules for collisions and display sorting. Detect missing parents and cycles without hanging; preserve each affected book and its pages under a deterministic recoverable top-level name. Migration must be atomic, versioned, retry-safe, and idempotent: reload must not append paths or suffixes again.

For local content, run migration in an IndexedDB transaction before presenting the new list. For shared content, use a server-side transactional migration and publish the resulting versions/revisions through the existing synchronization mechanism. Do not issue a sequence of uncoordinated client-side renames and moves. Preserve workspace authorization and optimistic concurrency. Stale clients must not recreate non-null parents after migration; enforce this on new create/update/import/restore writes as well.

Future imports and restores flatten nested source paths into top-level book names using the same collision policy. Preserve source identifiers and import provenance independently of visible book nesting. GitHub refresh must not reintroduce parent links. Review the existing root-book/source coupling: deleting a book must never call a source-removal operation that deletes its pages. Keep explicit source removal distinct from ordinary book deletion and preserve the existing refresh confirmation semantics. Source metadata must remain valid when its former root book is removed.

Local and shared book deletion both move pages and delete the book transactionally. For shared workspaces, report changed page records and folder deletion through normal revisions so other clients converge. Failed authorization, conflict, or storage writes must leave the original book and page assignments intact. Preserve unsaved editor text during navigation, renaming, and moves through the existing save coordination.

## Implementation boundaries

- Sidebar and the replacement book/page list own layout, disclosure, menu anchoring, virtualization, and accessible focus.
- A shared view-model layer owns grouping, counts, natural sorting, and visible row derivation.
- Workspace UI state owns collection expansion, mode restoration, and explicit reveal requests; it is separate from persisted content.
- Existing local/shared content adapters own create, rename, move, and atomic content-preserving delete behavior.
- Migration/import/server boundaries enforce flat books, with focused changes to the current schema and source bookkeeping rather than unrelated rewrites.

Retain legacy parent/order fields where compatibility requires them; eliminating every field or renaming Folder throughout the repository is not part of this work. Update product documentation to define a book as a flat collection of pages.

## Acceptance criteria

1. Book name opens Shelf; disclosure toggles pages without navigation. At most one collection is expanded, including Unsorted.
2. Counts and natural sorting are correct for empty books, duplicate titles, multilingual names, and Chapter 2/Chapter 10.
3. Page opening preserves the agreed mode; search, resume, and moving the active page reveal the correct row. Manual collapse is not undone by typing or background updates.
4. Expansion and mode preferences are isolated across workspaces, survive reload, tolerate storage failure, and ignore deleted IDs.
5. Menus, inline rename, and Move to… work with mouse, keyboard, and touch. Dragging moves between collections without changing sort order or losing text.
6. Book deletion retains all page IDs, bodies, bookmarks, and active editor content; local/shared failures leave membership intact.
7. Migration covers multiple nesting levels, collisions, missing parents, cycles, retry, and concurrent shared updates. It never merges or deletes content. Imports, restores, and refreshes cannot recreate nested books.
8. Test a populated fixture with at least 100 books and 1,000 pages in one book. Scrolling remains continuous, mounted rows remain bounded, search can reveal a distant item, and rename/menu focus survives virtualization.
9. Inspect desktop and mobile drawers with long titles, empty and populated states, and actual 200% browser zoom. No horizontal overflow, clipped menus, inaccessible controls, or duplicated page list.
10. Existing workspace search, Shelf, Edit/Read/Split, synchronization, import/export, and approved branding regression checks pass.

## Deferred work

Manual ordering, nested books, cross-workspace drag-and-drop, bulk selection, a second search field, and adopting the mockup's reader/header redesign are excluded. No deployment or content migration occurs merely by approving this document; those belong to the subsequent implementation and release work.
