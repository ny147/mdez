# Mdez Product Requirements Document (PRD)

## Product Overview
Mdez (Markdown Easy Reader) is a local-first, browser-based markdown workspace for writers, developers, students, and note-heavy creators who prioritize privacy and speed. It opens directly into a quiet pastel library for organizing, writing, and reading without accounts, cloud sync, or backend storage.

## Target Users
- **Writers & Bloggers:** Crafting drafts in a focused, beautiful environment.
- **Developers:** Quick documentation and README editing with a technical yet playful polish.
- **Students & Creators:** Note-taking and organizing personal knowledge bases locally.

## Product Purpose
To provide a friction-free markdown experience where users can organize, edit, and preview content immediately upon opening the app. Data is persisted securely in the browser's IndexedDB. Success means users can open the app and immediately organize, edit, preview, and export markdown while trusting that their content stays in-browser. Public GitHub repositories will provide an optional one-way import source without becoming Mdez cloud storage.

## Core Features
- **Local-First Persistence:** Automatic saving to browser storage via IndexedDB; no accounts or cloud sync required.
- **Library Management:** Nested books with Markdown pages, paste import, and file import support.
- **Public GitHub Import:** Preview and import the default branch of a public Markdown repository as a book, then refresh it manually. GitHub remains the source of truth, and refresh replaces local edits inside that imported book while preserving unrelated local content.
- **Workspace Modes:**
    - **Shelf:** Central library organization with books, pages, bookmarks, and contextual export.
    - **Edit:** Focused writing console with CodeMirror and syntax highlighting.
    - **Read:** High-readability preview mode optimized for long-form consumption.
    - **Split:** Simultaneous editing and reading with an adjustable separator.
- **Export & Portability:** Export a page as `.md` or an open book as `.zip` while preserving its nested structure and metadata.

## Brand Personality
**Playful, Precise, Calm.**
The product feels like a polished writing library: friendly enough to invite exploration, but restrained and readable enough for long Markdown sessions.

## Design Principles
1. **Keep the workspace first:** Every visual choice must support importing, organizing, editing, reading, and exporting markdown.
2. **Let personality live in the frame:** Use berry, lavender, mint, book motifs, and a small mascot around calmer editor and reader surfaces.
3. **Make local trust visible:** Autosave, export, and storage feedback should be textual, clear, and recoverable.
4. **Favor familiar controls:** Standard buttons, inputs, tabs, and icons should remain recognizable, consistent, and keyboard accessible.
5. **Protect reading comfort:** Long markdown content needs contrast, width control, and stable layout over decorative intensity.

## Accessibility & Inclusion
- Target WCAG AA contrast for text and controls.
- Visible keyboard focus and semantic landmarks.
- Labeled icon buttons and clear text status for state changes (save/import/export).
- Mobile controls that do not depend on hover.
- Brief, state-driven motion with reduced-motion support.

## Current Delivery Priorities
1. Keep the shipped public GitHub import and manual refresh flow safe, preview-first, and local-first.
2. Improve import comprehension, reading comfort, responsive use, and accessibility without redesigning the renewed workspace.
3. Verify and deploy the application to production on Vercel.

## Deferred Scope
- Private GitHub repositories and GitHub authentication.
- Background or two-way GitHub synchronization.
- Branch, tag, commit, and repository-subfolder selection.
- Obsidian attachments, plugins, configuration, wikilink conversion, and embed conversion.
- Accounts, backend document storage, sharing, and real-time collaboration.

## Anti-References
- No sterile corporate productivity UI or generic SaaS dashboards.
- No beige editorial stationery or heavy developer-tool darkness with no warmth.
- No decorative effects that make editing or reading harder.
- No neon halos, scanlines, dark arcade panels, or novelty controls.
- No marketing landing-page patterns; the app opens directly into the workspace.