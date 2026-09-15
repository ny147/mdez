# Public GitHub import

Mdez can preview and import Markdown from a public GitHub repository into the browser's local library.

## Supported repositories

Enter a repository URL in this form:

```text
https://github.com/owner/repository
```

Mdez downloads the repository's default branch and imports `.md` and `.markdown` files. Repository directory paths become flat book names such as `project / docs`; root Markdown files go into the repository's main book. Mdez ignores `.obsidian`, hidden configuration, attachments, and unsupported files. The preview shows what will be imported before anything is written to IndexedDB.

## Safety limits

- 25 MB compressed repository archive.
- 1,000 Markdown files.
- 5 MB per Markdown file.
- 50 MB total extracted Markdown.
- 15 seconds for the GitHub archive request.

GitHub may also apply its public, unauthenticated rate limits.

## Refresh behavior

An imported repository keeps source metadata so it can be refreshed manually. Refresh asks for confirmation, then replaces source-owned pages and any local edits inside that imported book. Local books and imports from other repositories remain unchanged. If refresh fails, the existing imported book is preserved.

Export local changes before refreshing if you need to keep them.

## Current exclusions

GitHub import does not support private repositories, authentication, branch or tag selection, repository subfolder selection, background synchronization, or two-way merging. It does not convert Obsidian attachments, configuration, embeds, or wikilinks.

The archive API streams the bounded GitHub ZIP response to the browser. Mdez does not persist repository archives or Markdown on the server and does not log repository payloads.
