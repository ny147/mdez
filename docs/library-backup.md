# Library backup and restore

Mdez keeps the Local Library in the current browser. A complete backup gives you a portable recovery copy before you clear site data, change domains, reinstall a browser, or make a risky library change. Page and book exports remain useful human-readable copies, but they are not complete library backups.

## Create a complete backup

1. Switch the workspace to **Local Library**. Backups are not available while a Key Group is active.
2. Open **Shelf**.
3. Choose **Back up library**.
4. Store the downloaded `mdez-library-YYYY-MM-DD.mdez.zip` file somewhere durable.

Mdez includes the latest saved and in-editor Local Library page content when it creates the archive. The action is disabled until the library contains at least one book or page.

## What the archive contains

A complete backup contains:

- every Local Library book, including empty books;
- every page, including pages in **Unsorted pages**, with its title, Markdown, timestamps, and relative order;
- Local Library page bookmarks; and
- public GitHub repository provenance needed to preserve safe manual-refresh linkage when possible.

It does not contain recent-page history, the last-opened page, theme or reader preferences, Quick Share records or management tokens, remembered Key Groups or group keys, cached group content, server data, credentials, or other secrets. Key Group and Quick Share content remains under its existing server-side ownership and lifecycle.

## Restore safely

Open **Import Markdown**, choose **Restore backup**, and select a `.mdez.zip` backup. Mdez reads and validates the entire archive before enabling restore. The preview reports book, empty-book, page, Unsorted-page, and bookmark counts, plus any book renames or GitHub linkage changes.

Restore is additive: it never replaces or deletes the current Local Library. A restored book whose name already exists is renamed to `<name> (restored)`, then `<name> (restored 2)`, and so on. Duplicate page titles remain unchanged because pages with the same title are valid in Mdez. Restored Unsorted pages remain Unsorted.

Public GitHub refresh linkage is retained only when that repository is not already linked in the current library. A duplicate source is restored as ordinary local content without refresh linkage. Restore does not contact GitHub.

Books, pages, eligible source records, and bookmarks are written in one transaction. If validation or writing fails, no partial restore is kept. If the library changes after preview, Mdez rejects the stale preview so it cannot silently apply different naming or source-link decisions. Starting restore from a Key Group still targets the Local Library and switches there after success; the Key Group is not changed.

## Limits and compatibility

Version 1 accepts only complete Mdez library backups with schema version `1`. Individual-book ZIPs and generic Markdown ZIPs are not accepted by this restore flow.

Version 1 uses standard single-disk ZIP archives. Multi-disk and ZIP64 archives are not supported.

- Maximum compressed archive size: **100 MiB**.
- Maximum uncompressed `manifest.json` size: **100 MiB**.
- Maximum declared pages: **10,000**.
- Maximum Markdown size for one page: **20 MiB**.
- Maximum total uncompressed Markdown: **250 MiB**.

Every declared Markdown file must have a safe archive path, valid UTF-8 content, the expected byte length, and the expected SHA-256 checksum. These checks detect damage; they do not authenticate a backup against deliberate rewriting of both the content and manifest.

Backups contain plaintext Markdown and metadata. Version 1 does not provide encryption or password protection. Keep archives in storage appropriate for the sensitivity of your notes.

The app version in a backup is informational. The schema version controls compatibility. If a newer Mdez creates a schema this installation does not support, update Mdez and retry rather than editing the archive.

## Troubleshooting

- **The file cannot be read:** Select the backup again or copy it from known-good storage. Browser or filesystem access may have been interrupted.
- **The file is not a valid ZIP:** The download may be incomplete or the wrong file was selected. Create or retrieve a new `.mdez.zip` backup.
- **The format or version is unsupported:** Use a complete Mdez library backup and update Mdez if the archive uses a newer schema.
- **The archive contains an unsafe path:** Do not restore it. Safe Mdez backups never use absolute paths, traversal segments, backslashes, or ambiguous archive names.
- **Content is damaged:** A Markdown file did not match its declared byte length or checksum. Restore remains disabled and the current library is unchanged; use another copy of the backup.
- **The archive is oversized:** Reduce the library or individual page size in the source installation, create a new backup, and retry within the limits above.
- **The preview became stale:** Library names or source links changed after preview. Select the backup again to generate a new plan, review it, and retry.
- **Writing failed:** Mdez rolls back the transaction, leaving the existing library unchanged. Check available browser storage, reload, and retry. Preserve the backup until recovery is confirmed.
- **Content restored, but the workspace could not refresh:** The restore is already saved. Reload Mdez to display the restored content; do not restore the same archive again.
