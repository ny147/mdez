# Mdez Markdown Easy Reader Design

## Overview

Mdez, short for Markdown Easy Reader, is a local-first markdown reader and editor web app. It lets users import markdown by pasting text or uploading `.md` files, organize documents in nested folders, read and edit markdown in a polished workspace, and export single documents or folder groups.

The app stores all user content in the browser with IndexedDB. V1 has no backend, no accounts, no cloud sync, and no server-side document storage. Deployment hosts only the application code; markdown data remains in each user's browser unless they export it.

## Goals

- Provide a fast markdown reader and full editor.
- Support paste import and file import for markdown documents.
- Let users organize documents with nested folders.
- Save content locally and automatically in the browser.
- Export one document as `.md`.
- Export a folder group as `.zip`, preserving nested paths and including metadata.
- Open directly into the working markdown workspace.
- Give the product a distinctive Kawaii Pop / Virtual Idol anime-tech identity.

## Non-Goals For V1

- User accounts or authentication.
- Backend document storage.
- Cross-device sync.
- Public sharing links.
- Collaborative editing.
- PDF export.
- Tags.
- Full-text search.
- Plugin or extension support.

## Product Positioning

Mdez intentionally avoids the sterile, corporate look common in productivity and developer tools. It should feel modern, playful, expressive, and deeply connected to contemporary JavaScript and creator culture, while still being practical for long reading and editing sessions.

The visual direction is Kawaii Pop / Virtual Idol anime-tech: dark teal base, glowing ice-blue accents, sticker-like logo treatment, soft glass panels, floating star and plus motifs, and a small mascot presence used in friendly empty states and import moments.

## Architecture

Mdez uses Next.js App Router with a client-first markdown workspace. The route shell can be server-rendered, but the main workspace must be a client component because it uses browser-only APIs such as IndexedDB, file input, drag and drop, clipboard import, and download generation.

V1 does not require API routes, server actions, or a backend database.

```txt
Next.js App Router
  Root layout and metadata
  Workspace route
    MdezWorkspace client component
      Sidebar
      Folder tree
      Document list
      Editor panel
      Preview panel
      Import/export controls
  Browser storage
    IndexedDB through Dexie.js
```

## Tech Stack

- Framework: Next.js App Router
- Language: TypeScript
- Styling: Tailwind CSS
- Local storage: IndexedDB via Dexie.js
- Markdown editor: CodeMirror 6
- Markdown rendering: react-markdown
- Markdown extensions: remark-gfm
- Code highlighting: rehype-highlight
- ZIP export: JSZip
- Icons: lucide-react
- Unit tests: Vitest
- Browser flow tests: Playwright
- CI: GitHub Actions
- Hosting: Vercel

## Data Model

Folders support nesting through `parentId`. Documents belong to zero or one folder.

```ts
type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type Document = {
  id: string;
  title: string;
  body: string;
  folderId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};
```

The app should reserve room in the model for future additions such as tags, pinned documents, and last-opened state, but those features are not part of V1.

## Core User Flows

### Import Markdown

Users can create documents from pasted markdown text or uploaded `.md` files.

Paste import:
- User opens import control.
- User pastes markdown into a text area.
- User chooses a target folder or leaves it in the root.
- App creates a new saved document and selects it.

File import:
- User chooses one or more `.md` files or drops them into the import area.
- App rejects unsupported file types with clear feedback.
- App creates one document per markdown file.
- The file name becomes the initial document title.
- The newest imported document becomes selected after import.

### Read And Edit

Users can switch between split, editor-only, and preview-only modes.

Split mode shows CodeMirror on one side and rendered markdown on the other. Editor-only mode focuses on writing. Preview-only mode provides a comfortable reader view.

Changes auto-save to IndexedDB after a short debounce. The UI should show save status such as `Saved`, `Saving...`, and `Unsaved`.

### Organize Documents

Users can create, rename, delete, expand, and collapse nested folders. Users can create, rename, move, delete, and select documents.

Folder deletion requires confirmation. V1 blocks deletion of non-empty folders and shows a helpful message asking the user to move or delete nested content first.

### Export Documents And Folders

Single document export downloads the selected document as a `.md` file.

Folder export downloads a `.zip` file containing all markdown documents inside the selected folder and its nested child folders. The ZIP preserves folder paths and includes a `manifest.json` file.

Example ZIP structure:

```txt
folder-name/
  note-a.md
  child-folder/
    note-b.md
  manifest.json
```

The manifest stores document and folder metadata such as IDs, names, order, timestamps, and original folder relationships. Markdown files remain readable without the manifest.

## UI Design Spec

The app opens directly into the Mdez workspace. There is no marketing landing page in V1.

Desktop layout:

```txt
Left Sidebar          Main Editor Area          Preview Reader
Mdez brand            Document title            Rendered markdown
Folder tree           CodeMirror editor         Reading typography
Document list         View controls             Export/read actions
Import/export         Save status
```

Mobile layout uses tabs or segmented navigation for `Files`, `Edit`, and `Read`.

### Visual Identity

- Deep teal and dark blue foundation.
- Soft radial light leaks around the workspace shell.
- Ice-blue glow accents for active, hover, and selected states.
- Large chubby bubble-style `Mdez` wordmark with thick white sticker outline.
- Lavender plus signs and glowing 4-pointed stars as sparse decorative motifs.
- Small feline mascot element for empty states, import success, and onboarding moments.
- Glassmorphism panels for sidebar and utility surfaces.
- Calmer editor and preview surfaces for readability.

### Interaction Style

- Primary actions use pill-shaped buttons with thick white borders and glowing hover states.
- Icon buttons use lucide-react with accessible labels or tooltips.
- The active folder and document should be visually obvious.
- Empty states should be playful but still action-oriented.
- Import and export feedback should be clear and not depend only on color.

### Readability

The preview reader should support:
- Headings.
- Tables.
- Task lists.
- Code blocks with syntax highlighting.
- Blockquotes.
- Links.
- Inline code.

Rendered markdown should use a comfortable reading width near 720px in preview-only mode. The theme should energize the frame of the product without making long markdown documents harder to read.

## Error Handling

Import errors:
- Unsupported file type.
- Empty pasted content.
- Failed file read.
- Oversized file warning for individual imports larger than 5 MB.

Storage errors:
- IndexedDB unavailable.
- Save failure.
- Export generation failure.

The app should show practical messages and keep the user's current text visible when possible.

## Accessibility

- Use semantic buttons, inputs, headings, and navigation landmarks.
- Provide visible keyboard focus states.
- Label file inputs and icon-only buttons.
- Keep sufficient contrast on glass and glow surfaces.
- Make import/export/save status visible in text.
- Ensure mobile controls are reachable and not hidden behind hover-only interactions.

## Deployment

Code is hosted in GitHub. Vercel deploys the Next.js app automatically from the GitHub repository. GitHub Actions runs quality checks and build verification.

```txt
Developer pushes code to GitHub
  -> GitHub Actions runs lint, typecheck, tests, and build
  -> Vercel builds and deploys the app
  -> User opens the Mdez URL
  -> User data stays in browser IndexedDB
```

Vercel hosts the app code only. It does not store user markdown documents.

## Testing Strategy

Unit tests should cover:
- Folder tree operations.
- Markdown file title normalization.
- Export path generation.
- Manifest generation.
- Dexie storage wrapper create, update, delete, and list operations.

Playwright tests should cover:
- Import markdown by paste.
- Import markdown by file.
- Create nested folders.
- Edit a document and reload to verify persistence.
- Export one document.
- Export a folder ZIP.
- Switch editor, split, and preview modes.

## V1 Acceptance Criteria

- A user can open Mdez and immediately see the workspace.
- A user can paste markdown and save it as a document.
- A user can upload one or more `.md` files.
- A user can create nested folders.
- A user can move documents into folders.
- A user can edit markdown and see rendered preview.
- A user can reload the page and still see saved local content.
- A user can export one document as `.md`.
- A user can export a folder as `.zip` with markdown files and `manifest.json`.
- The UI clearly presents the Mdez Kawaii Pop / Virtual Idol anime-tech identity without blocking readability.
- The app can be deployed through Vercel from GitHub.
