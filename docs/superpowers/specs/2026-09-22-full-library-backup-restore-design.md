# Full-Library Backup and Restore Design

**Date:** 2026-09-22
**Status:** Approved for implementation planning
**Scope:** Local Library backup creation and additive restore

## Objective

Give users one trustworthy, browser-local backup containing every Local Library book and page, including empty books and Unsorted pages, and let them validate and preview that backup before restoring it without overwriting existing content.

The feature strengthens Mdez's local-first promise: users can recover a complete library after clearing site data, moving to another browser origin, or changing devices. Existing page Markdown exports and contextual book ZIP exports remain unchanged and are not treated as restorable backups.

## Success Criteria

The design succeeds when:

- one action downloads all Local Library content as a versioned `.mdez.zip` archive;
- the archive preserves books, empty books, pages, Unsorted placement, relative ordering, timestamps, bookmarks, and safe public GitHub provenance;
- the latest in-memory page title and body are included even while autosave is pending;
- restore validates the complete archive and shows its effects before any IndexedDB mutation;
- confirmed restore adds newly identified content without deleting or overwriting existing records;
- conflicting book names and duplicate GitHub sources resolve exactly as shown in the preview;
- the confirmed restore is one IndexedDB transaction, so any failure leaves the current library unchanged;
- unsupported, corrupt, unsafe, oversized, or stale restore plans produce specific errors and zero writes; and
- desktop, mobile, keyboard, and assistive-technology users can complete both flows.

## Product Decisions

### Restore semantics

Restore is additive. It never deletes, replaces, or overwrites current Local Library content. Every restored book, page, bookmark, and retained GitHub source receives a fresh local ID. Archive IDs are references within the archive only.

When an incoming top-level book name collides with an existing or earlier planned book name, the preview assigns the first available deterministic label:

1. `<name> (restored)`
2. `<name> (restored 2)`
3. `<name> (restored 3)`, continuing as needed

Comparison uses the same case-insensitive locale policy as existing source-duplicate checks. Page titles are not renamed because Mdez permits duplicate page titles. Restored Unsorted pages remain Unsorted.

### Included records

The backup includes:

- every Local Library book, including books with no pages;
- every Local Library page, including Unsorted pages;
- book and page relative order;
- valid book and page creation/update timestamps;
- Local Library page bookmarks; and
- public GitHub repository metadata required to retain safe manual-refresh linkage.

The backup excludes recent-page history, the last-opened page, view and reader preferences, Shared Link records and management tokens, remembered Key Groups and group keys, cached Key Group content, server data, credentials, and all other secrets.

### Workspace scope

Backup covers the Local Library only. `Back up library` is available only while the Local Library is active. Key Groups are shared, server-backed workspaces with separate ownership and are not copied into this archive.

Restore always targets the Local Library. A user may open the Import dialog from a Key Group, but successful restore switches to the Local Library before showing restored content.

### Accepted archives

Restore accepts only the new full-library backup format. Existing individual-book ZIPs and generic Markdown ZIPs remain outside this feature. Their incomplete or inferred metadata cannot satisfy the validated round-trip contract.

## Version 1 Archive Contract

The downloaded filename is `mdez-library-YYYY-MM-DD.mdez.zip`. Name collisions are left to the browser's download behavior.

The archive contains a root `manifest.json` and one UTF-8 Markdown file for every page. Book pages use `books/<safe-book-segment>/<safe-page-name>.md`; Unsorted pages use `unsorted/<safe-page-name>.md`. Paths are deterministic, ASCII-safe slug paths with numeric suffixes for collisions. Empty books exist only as manifest records.

The root manifest has these logical fields:

```ts
type WorkspaceBackupManifestV1 = {
  format: "mdez-library-backup";
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  books: BackupBookV1[];
  pages: BackupPageV1[];
  bookmarks: BackupBookmarkV1[];
  githubSources: BackupGitHubSourceV1[];
};

type BackupBookV1 = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  sourceId?: string;
};

type BackupPageV1 = {
  id: string;
  title: string;
  bookId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  sourceId?: string;
  path: string;
  byteLength: number;
  sha256: string;
};

type BackupBookmarkV1 = {
  pageId: string;
  createdAt: string;
};

type BackupGitHubSourceV1 = {
  id: string;
  owner: string;
  repository: string;
  normalizedUrl: string;
  branch: string;
  rootBookId: string;
  lastRefreshedAt: string;
  createdAt: string;
  updatedAt: string;
};
```

The manifest is canonical JSON produced by Mdez, but property ordering is not part of validation. `appVersion` is informational. `format` and `schemaVersion` determine compatibility.

SHA-256 and byte length cover the exact UTF-8 bytes stored in each declared Markdown file. These values detect accidental corruption; they do not authenticate an archive or protect it from deliberate modification by someone able to rewrite both a file and its manifest entry.

Backups contain plaintext Markdown. Password protection and encryption are not part of version 1.

## Architecture and Responsibilities

### Backup contracts

`src/types/backup.ts` defines the versioned manifest records, parsed preview, planned book/source outcomes, typed validation failures, and restore result. UI and persistence consume the parsed domain model rather than raw ZIP objects.

### Archive builder and parser

`src/lib/workspace-backup.ts` owns:

- deterministic safe archive-path generation;
- preflight size and count validation;
- UTF-8 encoding and SHA-256 calculation;
- ZIP and manifest creation;
- ZIP loading and structural validation;
- strict version-1 manifest validation;
- declared-file decoding, byte/checksum verification, and total-size accounting; and
- construction of a mutation-free parsed backup.

Archive validation may reuse or extract focused path-safety primitives from GitHub import, but backup behavior does not depend on GitHub preview types or UI.

### Restore planning

A focused planner compares a validated parsed backup with current Local Library book names and GitHub sources. It produces an immutable preview/restore plan with fresh proposed mappings, deterministic book names, source retention/detachment decisions, counts, and warnings.

GitHub metadata is retained only when its normalized public repository URL is not already linked locally and the source record is internally valid. If the repository is already linked, its restored books/pages become ordinary local content: source IDs are omitted, no duplicate `githubSources` record is created, and the preview states that the book will be detached. Restore never fetches GitHub while parsing or importing a backup.

### Atomic persistence

`src/lib/repository.ts` exposes one restore operation that consumes an already validated plan. One Dexie read-write transaction spans `folders`, `documents`, `githubSources`, and `pageBookmarks`.

Within the transaction, the repository rechecks the existing names and normalized GitHub URLs used to make the plan. If relevant library state changed after preview, it aborts with a stale-preview result instead of choosing a new unpreviewed name or source outcome.

The transaction:

- generates fresh IDs for restored books, pages, and retained sources;
- appends books after the current root-book order;
- preserves page relative order inside each restored book;
- appends restored Unsorted pages after current Unsorted pages;
- preserves valid archive creation/update timestamps;
- rewrites all book, source, root-book, and bookmark references to fresh IDs; and
- commits all record classes together.

Any thrown error aborts the transaction. Existing content is never partially modified.

### Workspace coordination

`src/components/mdez/MdezWorkspace.tsx` remains the coordinator. It supplies current Local Library state and live draft-overlaid documents to backup creation, triggers the download, requests preview planning, invokes restore, refreshes state after success, switches from a Key Group to Local Library when necessary, selects the first restored page when one exists, and uses the existing single workspace status region.

The workspace does not parse ZIP records or write restore records itself.

## User Experience

### Creating a backup

The Local Library Shelf action row adds a visible secondary action named `Back up library`. The existing responsive two-column mobile grid accommodates the fourth action without introducing an overflow-menu subsystem.

Activation follows this sequence:

1. Announce `Preparing library backup…` through the existing status region and lock only the backup action against duplicate activation.
2. Snapshot current books, sources, bookmarks, and draft-overlaid live pages.
3. Run the same page-count, page-size, and extracted-content preflight enforced by restore.
4. Generate the version-1 archive and initiate its browser download.
5. Revoke the temporary object URL and announce `Library backup downloaded`.

Generation does not mutate IndexedDB or add backup-recency tracking. Page and book exports do not affect this flow.

If the Local Library has no books and no pages, the action is disabled with an explanation that there is nothing to back up. If generation fails, Mdez announces that it could not create the backup and that the library was not changed.

### Selecting and previewing a restore

The Import dialog adds a fourth roving tab, `Restore backup`, with a dedicated `BackupImportPanel`. It accepts a single `.mdez.zip` file through file selection or drag and drop. The file extension improves selection but does not replace content validation.

Selecting a file clears any earlier preview, reads and validates the archive, and performs zero writes. Busy state prevents closing or starting a competing import while validation is active. Selecting a different file invalidates the old plan.

A valid preview displays:

- export date and schema version;
- book and page counts;
- separate empty-book and Unsorted-page counts;
- bookmark count;
- total extracted Markdown size;
- every incoming book name that will be changed; and
- which GitHub books retain refresh linkage and which become detached local copies.

The confirmation button is named `Restore backup` and remains disabled until a current valid preview exists. The preview does not display Markdown bodies.

### Completing restore

After confirmation, the dialog locks all import actions while the transaction runs. On success, Mdez closes Import, switches to Local Library if necessary, reloads library state, and opens the first restored page in archive order. If the backup has no pages, it returns to the Local Library Shelf.

The completion message reports exact restored book and page counts. A transaction failure keeps the validated preview available for retry. A stale-preview failure clears the plan and asks the user to preview again. Both state that existing pages were unchanged.

Focus return, Escape handling, tab semantics, busy locking, and status announcements follow the current Import dialog patterns. No competing live region is added.

## Validation and Safety Limits

The builder preflight and parser enforce the same version-1 content ceilings:

- maximum ZIP file size: 100 MiB (`100 * 1024 * 1024` bytes);
- maximum page count: 10,000;
- maximum UTF-8 bytes per page: 20 MiB;
- maximum total extracted Markdown: 250 MiB.

The builder must not produce an archive that the same application version would reject under these limits.

Before a preview is returned, the parser rejects:

- a missing, duplicated, unreadable, or malformed `manifest.json`;
- a format other than `mdez-library-backup` or schema other than `1`;
- absolute paths, drive paths, backslashes, control characters, empty segments, `.` or `..` segments;
- duplicate archive paths under case-insensitive comparison;
- undeclared files or missing declared Markdown files;
- duplicate record IDs, paths, bookmarks, or invalid cross-record references;
- non-finite, negative, fractional, duplicated sibling order values;
- invalid ISO timestamps or creation timestamps after update timestamps;
- invalid GitHub repository/source relationships;
- invalid UTF-8 Markdown;
- a byte-length or SHA-256 mismatch; or
- any count or byte ceiling violation.

Directory entries are allowed only when they are implied parents of declared files. The parser never writes archive entries to the host file system, never makes a network request, and never evaluates Markdown.

Error copy distinguishes unreadable file, invalid ZIP, unsupported version, unsafe structure, damaged content, exceeded limit, stale preview, and transactional failure. Every restore error states that the existing library was unchanged.

## Compatibility

Version 1 accepts only schema version 1. A backup from a newer unsupported schema is rejected with guidance to update Mdez. An older producing app version remains acceptable when its schema is supported and the archive validates.

Future schema support must add an explicit parser/migration path. It must not loosen version-1 validation implicitly.

## Testing Strategy

### Unit tests

Archive builder/parser tests cover deterministic output mappings, duplicate book/page titles, slug collisions, Unicode Markdown, invalid UTF-8, empty books, Unsorted pages, live document inputs, bookmarks, valid sources, all path attacks, undeclared/missing files, duplicate IDs/references, timestamps, checksums, byte lengths, and every exact limit boundary.

Restore-planning tests cover case-insensitive book collisions, suffix allocation across existing and incoming names, linked versus detached GitHub sources, preview counts, and stable plan fingerprints.

Repository tests use fake IndexedDB to prove fresh-ID/reference remapping, order appending, timestamp preservation, bookmark restoration, source restoration/detachment, stale-plan rejection, and rollback across all four tables after a forced failure.

Component tests cover the fourth tab's roving keyboard behavior, file replacement, drag/drop, validation busy states, preview content, disabled confirmation, warnings, error recovery, and accessible names.

### End-to-end tests

Playwright creates a mixed Local Library with normal and empty books, duplicate titles, Unsorted pages, bookmarks, and GitHub content. It downloads a backup, restores it additively, verifies previewed renames/source outcomes, reloads, and confirms content and bookmarks persist. Separate scenarios cover corrupt archives producing zero writes, restore initiated from a Key Group switching to Local Library, stale preview handling, and desktop/mobile layouts.

### Required verification

Implementation completion requires:

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
```

## Documentation

Implementation updates:

- `README.md` with the complete-backup workflow, plaintext/privacy note, and distinction from page/book exports;
- `PRODUCT.md` with full-library backup and previewed additive restore behavior;
- `CONTEXT.md` only if a new user-facing term requires a canonical definition; and
- a focused `docs/library-backup.md` guide covering contents, exclusions, limits, restore semantics, collision behavior, GitHub linkage, compatibility, and troubleshooting.

## Non-Goals

This feature does not add:

- restore for existing book ZIP exports;
- generic Markdown ZIP import;
- replacement or merge-by-ID restore;
- Key Group backup or restore into a Key Group;
- Shared Link export;
- cloud sync or server storage;
- scheduled backups, reminders, or backup-recency tracking;
- password protection, encryption, signatures, or authenticity verification; or
- changes to existing page Markdown and contextual book ZIP exports.
