# Mdez UX Activation and Readability Design

## Goal

Improve the first-use and no-document flows from `docs/uxui_improve/mdez_ux_review.md` while preserving the Cyber Kawaii product shell and V1 export scope.

## Scope

This pass implements the staged P0/P1 approach:

- Add visible document creation in the Files tab and empty document list.
- Add create/import actions to no-document editor and reader states.
- Improve preview reading typography while keeping Markdown code styling monospaced.
- Clarify sidebar folder ZIP export and disable it when Root is selected.
- Reduce Root-only folder noise with lightweight guidance and a visible folder creation action.

This pass deliberately does not add PDF or HTML export, desktop split resizing, zoom controls, sidebar collapse shortcuts, or broad visual restyling.

## UX Design

The fresh workspace should make writing the obvious next step. The Documents section will keep its compact heading but add a full-width `New document` button with visible text. When the selected folder has no documents, the empty state will include direct actions: `Create document` and `Import markdown`. The action copy should name the selected folder when practical, for example `Create a document in Root`, without making the UI verbose.

The main workspace should recover the user flow when no document is selected. The editor empty state will keep the `Editor` panel label, remove redundant large explanatory hierarchy, and add `Create document` plus `Import markdown` buttons. The reader empty state will mirror these actions inside the document surface so desktop split mode and mobile Read mode both provide a way forward.

The reader should feel like rendered prose, not source text. `.markdown-preview` body text will use Geist/system sans with a 65 to 75 character measure in preview-only reading. Inline code, code blocks, metadata-like timestamps, and editor content will remain JetBrains Mono/Consolas. Reader contrast must stay strong against `#f7fbff`.

Folder export should communicate what will download. The sidebar export control will use a visible `Folder ZIP` label and the download icon. When Root is selected, the command will be disabled because V1 supports folder ZIP export for selected folders, not Root export. The existing error message remains a defensive fallback if the handler is triggered unexpectedly without a folder.

The Folders section remains visible because nested folders are part of V1. In a Root-only workspace, it will show light copy such as `Create folders when this library grows.` and a visible `New folder` action. Once folders exist, the current tree behavior remains unchanged.

## Component Changes

- `src/components/mdez/MdezWorkspace.tsx`
  - Pass `onCreateDocument` and `onOpenImport` into `EditorPane` and `PreviewPane`.
  - Preserve existing mobile tab transitions after create/import.

- `src/components/mdez/Sidebar.tsx`
  - Replace the sidebar icon-only export with a labeled `Folder ZIP` button.
  - Disable the sidebar ZIP button when `selectedFolderId` is `null`.
  - Continue rendering the existing alert area for export errors.

- `src/components/mdez/DocumentList.tsx`
  - Replace or supplement the icon-only create affordance with a visible `New document` button.
  - Add empty-folder actions for create and import.

- `src/components/mdez/FolderTree.tsx`
  - Add Root-only guidance and a visible `New folder` action.
  - Preserve nested folder rows and existing create/rename/delete controls after folders exist.

- `src/components/mdez/EditorPane.tsx`
  - Add no-document actions using existing `holo-button` and `holo-ghost-button` styles.
  - Avoid duplicating the workspace header's `No document selected` heading.

- `src/components/mdez/PreviewPane.tsx`
  - Add no-document reader actions.
  - Keep rendered Markdown behavior unchanged for selected documents.

- `src/app/globals.css`
  - Change `.markdown-preview` prose font to Geist/system sans.
  - Keep `.markdown-preview code` and `.markdown-preview pre` monospaced.
  - Add preview measure constraints without breaking tables or code overflow.

## Testing

Tests should be written before production changes.

Playwright coverage:

- Fresh workspace shows a visible `New document` action in Files and can create a document from it.
- Empty document list includes `Create document` and `Import markdown`.
- No-document editor and reader states expose `Create document` and `Import markdown`.
- Sidebar `Folder ZIP` is visibly labeled and disabled when Root is selected.
- Rendered preview prose uses a non-monospace font, while inline code and code blocks remain monospaced.

Existing import, export, persistence, folder, and view-mode tests must remain green.

## Acceptance Criteria

- A fresh user can create or import markdown without interpreting an icon.
- Empty editor and reader states offer direct recovery actions on desktop and mobile.
- Preview prose no longer renders in monospace, but Markdown code still does.
- Root selected state does not present an enabled folder ZIP command.
- Root-only folder UI stays discoverable but secondary to document creation.
- No new V1 export formats are introduced.
