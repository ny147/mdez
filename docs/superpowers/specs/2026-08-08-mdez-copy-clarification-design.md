# Mdez Copy Clarification Design

**Date:** 2026-08-08  
**Status:** Approved direction  
**Surface:** Shelf, import dialog, export controls, and workspace status

## Goal

Make Mdez understandable to someone opening the local Markdown workspace for the first time. The copy should explain the relationship between the library, books, and pages without adding onboarding steps or changing the existing interaction model.

Success means a first-time user can answer three questions from the interface alone:

1. Where can a page live?
2. How do they create or import Markdown?
3. Where is their work saved?

## Audience and user state

The primary audience is a first-time Mdez user with general computer literacy. They may understand Markdown but should not need to understand Mdez-specific terms.

The user is curious and ready to act, but mildly uncertain about the empty library. The tone should be calm, direct, and reassuring. Errors should explain how to recover without blaming the user.

## Recommended approach

Use a focused terminology rewrite. Preserve the current layout and behaviors while making the information model explicit and consistent.

Two alternatives were considered and rejected:

- A minimal string patch would leave the relationship between the root, books, and pages unclear.
- A guided onboarding flow would add more interface and state than this problem requires.

## Terminology contract

Use the following terms consistently:

- **Library:** The complete local Mdez workspace and the unfiltered Shelf context, including recent pages from every book.
- **Book:** An optional group of related pages.
- **Page:** One Markdown document.
- **Pages without a book:** Pages whose storage location is the library root. Use this only in the sidebar, where the list actually excludes pages inside books.
- **Recent pages:** The pages most recently updated in the current scope. This replaces **Bookmarked pages**, because the current list is ordered by update time and does not represent bookmarks.

Do not alternate between document, note, file, and page in the same workflow. Use **Markdown file** only when referring to a file selected from the device.

## Shelf copy

| Current copy | Approved copy | Reason |
| --- | --- | --- |
| Bookshelf | Library | Names the complete surface instead of only its book grouping. |
| Shelf root, in the main context | Library | Names the complete unfiltered Shelf context. |
| Shelf root, in the sidebar tree | Pages without a book | Matches the sidebar list, which contains only pages outside books. |
| Open a book to focus the shelf. | Open a book to see its recent pages. Library shows recent pages from every book. | Explains both available scopes and the result of selecting one. |
| Create books when this shelf grows. | No books yet. Create a book to group related pages. | States why books are useful and gives a next action. |
| Bookmarked pages | Recent pages | Matches the actual most-recently-updated behavior. |
| Create page | Create page | Already uses a specific verb and object. |
| New book | Create book | Matches the verb used for page creation. |
| New book on shelf | Create book | Removes an unnecessary location detail. |
| Import markdown | Import Markdown | Uses the standard product name consistently. |
| Book ZIP | Export book (.zip) | Names the action, object, and file type. |

When a book is open, the helper text should read: **Showing recent pages in [book name]. Return to Library to view recent pages from every book.**

Empty recent-page states should read:

- Library: **No pages yet. Create a page or import Markdown to begin.**
- Open book: **No pages in this book yet. Create a page or import Markdown here.**

## Import dialog copy

| Current copy | Approved copy |
| --- | --- |
| Import markdown | Import Markdown |
| Bring notes into Mdez | Add Markdown to your library |
| Paste | Paste text |
| Markdown files | Choose files |
| Public GitHub | GitHub repository |
| Target book | Add pages to |
| Shelf root | No book |
| Paste markdown | Paste Markdown |
| Import Paste | Import pasted text |
| Importing... | Importing Markdown... |
| Cancel | Close import |

The GitHub option should keep its public-repository constraint visible near the URL field. Its preview action remains **Preview repository**, and its final action remains **Import repository**.

## Status and feedback copy

The status bar should communicate storage trust without repeating itself:

- Default saved state: **Saved in this browser**
- Saving state: **Saving changes...**
- Import in progress: **Importing Markdown...**
- Import complete: **Imported 1 page** or **Imported [count] pages**
- Export complete: **Downloaded [book name].zip** or **Downloaded [page name].md**

When the full saved message is present, remove the separate **Local** badge. Keep **UTF-8** as document metadata.

## Error messages

Errors must state what happened and how to recover when recovery is available.

| Situation | Approved message |
| --- | --- |
| Empty pasted text | Paste Markdown before importing. |
| Unsupported local file | Choose Markdown files ending in .md or .markdown. |
| Local file cannot be read | We could not read [filename]. Choose the file again or try another file. |
| Local import fails | We could not import the Markdown. Your existing pages were not changed. |
| Export without an open book | Open a book before exporting it as a .zip file. |
| Missing book during export | We could not find that book. Open it again and retry the export. |
| ZIP preparation fails | We could not create the book export. Try again. |
| Invalid GitHub URL | Enter a public GitHub repository URL, such as https://github.com/owner/repository. |
| GitHub preview unavailable | We could not preview this repository. Check that it is public and try again. |

Technical and security-specific GitHub archive errors may remain more precise when their detail helps the user recover or understand why the import was refused.

## Accessibility and localization

- Preserve visible labels for form fields rather than relying on placeholders.
- Keep button names as specific verb and object pairs.
- Ensure accessible names match visible labels unless extra context is required for icon-only controls.
- Use complete strings for dynamic messages so translators can reorder words.
- Avoid abbreviations except the familiar file types `.md`, `.markdown`, and `.zip`.
- Preserve one polite live region for save, import, export, and error feedback.

## Scope boundaries

This clarification pass will not:

- Add onboarding screens, coach marks, or new persisted state.
- Change the library data model or move existing pages.
- Change import, export, save, or GitHub behavior.
- Redesign the layout, color system, or component vocabulary.
- Rename internal TypeScript types or database fields when users cannot see them.

## Verification

Update unit and end-to-end expectations for the approved terminology. Add or adjust coverage for:

1. The **Library** heading and the distinct **Pages without a book** sidebar scope.
2. The truthful **Recent pages** label.
3. Empty book and empty page guidance.
4. Import dialog tabs, target label, and action labels.
5. Actionable paste and file errors.
6. Saved, saving, import, and export status messages.
7. Export labels and disabled-state explanation.
8. Accessible names remaining aligned with visible copy.

Run the relevant unit tests, focused Playwright tests, lint, and typecheck before completion.

## Acceptance criteria

- No visible instance of **Shelf root** remains. The unfiltered Shelf context is **Library**, and the root-only sidebar list is **Pages without a book**.
- The recently updated page list is labeled **Recent pages**, not **Bookmarked pages**.
- Every primary button states the action and object.
- Empty states explain both the state and the next useful action.
- Import and export errors provide a recovery step when one exists.
- The saved state explicitly says that content is stored in the browser.
- Existing local-first behavior and responsive layout remain unchanged.
