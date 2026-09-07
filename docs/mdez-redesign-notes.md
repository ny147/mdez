# Mdez standalone redesign

Artifact: `mdez-redesign.html`, a single HTML page with embedded styles, scripts, and SVG artwork. It presents a calm personal library and a spacious Markdown workspace without changing the existing application.

## Visual direction

An off-white canvas (`#fbfafc`), lavender sidebar (`#f3f0f8`), dark plum text (`#292735`), and purple actions (`#7052b8`) frame pastel book covers in lavender, sage, peach, and blue. Thin borders and generous spacing organize the bookshelf, recent pages, and editor. Geometric SVG cover patterns give each book a distinct identity.

Manrope supplies headings, DM Sans supplies interface text, Georgia supplies reading text, and Consolas supplies Markdown text. Manrope and DM Sans load from external Google Fonts; system fallback fonts remain available when that service is unavailable. The page therefore is not fully self-contained with respect to typography.

## Layout and interactions

Desktop uses a persistent sidebar, four-column bookshelf, and side-by-side Markdown editing and preview. At narrower widths spacing tightens; below 760px the sidebar becomes a toggleable drawer, covers use two columns, the last-edited table column hides, and the editor stacks vertically. Reduced-motion preferences disable transitions.

Implemented interactions include book creation, page creation and editing, book and bookmark filters, recent-page ordering, search across page titles/body and bookshelf names, resume writing, bookmark toggles, Edit/Read/Split modes, Markdown/text import, current-page Markdown export, help dialogs, and Ctrl/Cmd+K search focus. Changes attempt to save automatically, and storage failures show a message.

## Prototype boundaries

The initial library contains four sample books and pages. Data persists in browser localStorage under `mdez-redesign-v1`; the prototype has no backend, account, GitHub connection, or integration with an existing Mdez library. Export preserves the current page body as a `.md` file. Import accepts files up to 2 MB each.

The renderer escapes source text and supports basic headings, paragraphs, emphasis, inline code, fenced code, bullet lists, and blockquotes. It is not a complete Markdown implementation. Google Fonts is the only external asset dependency.

## Review scope

Source review verified that the closed mobile drawer is hidden from keyboard navigation and that editor modes and primary filter controls expose pressed states. Visible keyboard focus, labeled inputs, bookmark states, and status messages are present. Dialog naming and focus handoff between library/editor remain possible refinements. No screenshots were available for this review; visual rendering and browser interaction validation are separate from these source findings.
