# Mdez Quick Share and Key Groups Design

**Date:** 2026-08-09

**Status:** Approved flows, ready for implementation planning

**Product:** Mdez Markdown Easy Reader

## Summary

Mdez will add two separate server-backed features while preserving its existing local-first library:

1. **Quick Share** publishes one immutable Markdown snapshot at an unlisted, view-only URL with creator-selected expiration.
2. **Key Groups** copy the creator's complete local Markdown library into a shared Supabase workspace. Anyone with the generated group key has equal create, edit, move, rename, delete, and group-management access.

The existing Next.js application remains both frontend and backend. Route handlers deployed on Vercel are the only code allowed to access Supabase. No user accounts, authentication provider, member identities, presence, or real-time simultaneous editing are included.

## Approved Diagrams

- [Quick Share sequence](../../diagrams/quick-share-sequence.excalidraw)
- [Key Group sequence](../../diagrams/key-group-sequence.excalidraw)

The `.spec.json` files beside the diagrams are editable generator sources.

## Goals

- Let a user share one page quickly without asking the viewer to create an account or enter a key.
- Let several people collaborate on the same complete Markdown library using only one generated group key.
- Keep Local Library and Group Library visibly separate.
- Prevent silent overwrites when two group members edit the same page.
- Keep Supabase credentials and key-verification logic out of the browser.
- Preserve Mdez's existing responsive, accessible, reader-first experience.

## Non-Goals

- User accounts, email login, OAuth, profiles, roles, or ownership transfer.
- Real-time character-by-character collaboration, cursors, presence, or chat.
- Automatic two-way synchronization between Local Library and Group Library.
- Member lists, per-user history, or attribution.
- Quick Share editing or automatic synchronization with its source page.
- End-to-end encryption. Quick Share and Key Group Markdown are readable by the server and Supabase in this version.

## System Architecture

```text
Browser
  -> HTTPS requests
Next.js route handlers on Vercel
  -> Supavisor transaction pooler
Supabase Postgres
```

The browser never receives a Supabase service credential or direct write access. Supabase tables enable Row Level Security and grant no public browser role access. All runtime queries go through server-only code.

Supabase provides the Postgres database. Vercel's existing Next.js deployment hosts the API gateway and daily cleanup routes. Serverless database traffic uses Supabase's Supavisor transaction pooler through a server-only connection string.

Required server secrets:

- `SUPABASE_DATABASE_URL` pointing to the Supavisor transaction pooler
- `GROUP_KEY_PEPPER` for deterministic group-key HMAC lookup
- `MANAGEMENT_TOKEN_PEPPER` for Quick Share management-token verification
- `RATE_LIMIT_PEPPER` for privacy-preserving request-bucket identifiers
- `CRON_SECRET` for expired-share cleanup

Secrets must never use a `NEXT_PUBLIC_` prefix.

## Feature 1: Quick Share

### User Experience

A user can invoke **Quick Share** from a selected Local or Group Markdown page. The dialog presents these expiration options:

- 1 hour
- 1 day
- 7 days, selected by default
- 30 days
- Never

Creating a share publishes the current title and Markdown body as an immutable snapshot. Later source edits do not change it. Sharing a newer version creates a new Quick Share.

The result displays a copyable URL and the selected expiration. Anyone with the URL can open the page without an account or group key. The public route uses a simplified read-only Mdez Reader and omits library, editing, import, and workspace-management controls.

The creator can delete a share early from a local **Shared links** management surface. Creation returns a private management token, which Mdez stores in IndexedDB. Supabase stores only an HMAC digest of that token. Clearing browser data loses the ability to delete never-expiring shares; the creation result must state this clearly.

### Quick Share Data Model

`quick_shares`

- `id`: UUID primary key
- `public_id`: unique, cryptographically random, unguessable URL identifier
- `management_token_digest`: HMAC-SHA-256 digest
- `title`: readable page title
- `markdown`: readable Markdown body
- `size_bytes`: validated payload size
- `created_at`: timestamp
- `expires_at`: nullable timestamp; null means never

Quick Share public identifiers and management tokens each contain at least 128 bits of cryptographically secure randomness.

### Quick Share API

- `POST /api/quick-shares`: validate and create an immutable snapshot
- `GET /api/quick-shares/{publicId}`: return active snapshot or `410 Gone` when expired
- `DELETE /api/quick-shares/{publicId}`: require the private management token
- `GET /api/cron/quick-shares`: delete expired records in an idempotent daily cleanup
- `/share/{publicId}`: public read-only page route

The API reuses the existing 5 MB per-Markdown-page limit. It returns `413` for oversized pages, `404` for unknown links, `410` for expired links, and `403` for an invalid management token. Public responses use `no-store` in V1 so early deletion takes effect immediately.

The daily cleanup route verifies `CRON_SECRET` and deletes rows whose `expires_at` is in the past. The operation is idempotent because rerunning the same deletion produces the same final state.

## Feature 2: Key Groups

### Group Creation

The user selects **Create Key Group**, supplies a group name, and confirms that the complete current Local Library will be copied. Mdez generates a human-copyable key containing at least 128 bits of cryptographically secure randomness.

The creation payload includes all Local Library folders and Markdown documents, including root pages, nesting, names, ordering, and timestamps. Existing GitHub-imported pages become ordinary group Markdown. GitHub source ownership and refresh metadata are not copied because the Group Library becomes independent.

The server validates a maximum of 1,000 Markdown pages, 5 MB per page, and 50 MB total Markdown. It creates the group, folders, and documents atomically in one Postgres transaction. Any failure rolls back the complete group.

After creation, the Local Library and Group Library are independent. Edits in one never synchronize automatically to the other.

### Joining and Remembering a Group

A user selects **Join Key Group** and enters only the group key. The API computes `HMAC-SHA-256(GROUP_KEY_PEPPER, suppliedKey)` and looks up the matching active group. The raw key is never stored in Supabase or logged.

On success, Mdez downloads the complete group hierarchy and remembers the group key in IndexedDB until the user explicitly leaves. A workspace switcher displays **Local Library** and each remembered Group Library. Leaving removes the key and cached group data from that browser but does not delete the server group.

There is no owner or member identity. Everyone with the key has equal authority. They can create, edit, rename, move, reorder, and delete books and pages; rename the group; soft-delete the group; and restore it during the recovery period.

An active group has no automatic expiration. It remains available until a key holder deletes it, after which the seven-day recovery and purge lifecycle applies.

### Key Group Data Model

`key_groups`

- `id`: UUID primary key
- `name`: group display name
- `key_digest`: unique HMAC-SHA-256 digest used for lookup
- `schema_version`: integer for future migrations
- `revision`: monotonically increasing library revision
- `created_at`, `updated_at`: timestamps
- `deleted_at`: nullable soft-deletion timestamp
- `purge_after`: nullable timestamp, seven days after deletion

`group_folders`

- `id`: UUID primary key
- `group_id`: foreign key to `key_groups`
- `parent_id`: nullable self-reference constrained to the same group
- `name`, `sort_order`: hierarchy fields
- `version`: optimistic concurrency integer
- `group_revision`: group revision that produced the latest row state
- `created_at`, `updated_at`: timestamps

`group_documents`

- `id`: UUID primary key
- `group_id`: foreign key to `key_groups`
- `folder_id`: nullable group-folder reference
- `title`, `markdown`, `sort_order`: readable page data
- `version`: optimistic concurrency integer
- `group_revision`: group revision that produced the latest row state
- `created_at`, `updated_at`: timestamps

`group_change_log`

- `id`: monotonically increasing primary key
- `group_id`: foreign key to `key_groups`
- `revision`: group revision assigned to the mutation
- `entity_type`: group, folder, or document
- `entity_id`: affected record ID
- `operation`: create, update, or delete
- `changed_at`: timestamp

Foreign keys cascade only where explicitly safe. Folder deletion remains blocked while it contains nested folders or pages, matching the local-library behavior.

### Saved Collaboration and Conflicts

Group pages use the existing debounced autosave experience, but each update sends the page version originally loaded by the editor. The server performs a conditional update equivalent to:

```sql
update group_documents
set markdown = $markdown, version = version + 1, updated_at = now()
where id = $id and group_id = $groupId and version = $expectedVersion;
```

One updated row means success and returns version `N+1`. Zero updated rows means another member saved first. The API returns `409 Conflict`; Mdez keeps the unsaved draft and offers:

- **Reload shared version**
- **Copy my draft to a new page**

Every successful group mutation increments the group's `revision` and writes a change-log entry in the same transaction. Joining returns a full library plus its current revision. Later refreshes request changes after the browser's last revision, so Mdez does not download the complete library every 30 seconds.

Mdez requests changes when the window regains focus, through an explicit **Refresh group** action, and every 30 seconds when no unsaved draft is active. Background refresh never replaces an active draft. Change-log entries are retained for 90 days. When a browser presents a revision older than the retained log, the API returns `reset_required` and the browser performs a full library reload after confirming that no unsaved draft exists.

### Key Group API

- `POST /api/key-groups`: create a group from the complete Local Library
- `POST /api/key-groups/join`: verify a key and return group summary plus library
- `GET /api/key-groups/{groupId}`: load a complete group snapshot
- `GET /api/key-groups/{groupId}/changes?after={revision}`: refresh changed records and deletion events
- `PATCH /api/key-groups/{groupId}`: rename or restore group
- `DELETE /api/key-groups/{groupId}`: begin seven-day soft deletion
- Folder CRUD routes under `/api/key-groups/{groupId}/folders`
- Document CRUD routes under `/api/key-groups/{groupId}/documents`
- `GET /api/cron/key-groups`: permanently remove groups after `purge_after`

Every group request carries the key in an HTTPS request header, never in a URL or query string. The server recomputes the digest and requires it to match the requested group before performing any operation. Responses use `no-store`.

## Security and Abuse Controls

- Never log request bodies, raw group keys, or Quick Share management tokens.
- Redact access headers from structured errors and telemetry.
- Validate payload types, UTF-8 content, record ownership, hierarchy cycles, and size limits at the API boundary.
- Use parameterized SQL only.
- Render Markdown through the existing safe React Markdown pipeline; do not enable raw HTML.
- Apply initial fixed-window limits of 20 Quick Share creations per IP per hour, five Key Group creations per IP per hour, 20 failed group-key checks per IP per minute, 120 group mutations per group per minute, and 120 public-share reads per public ID and IP per minute.
- Store rate counters in a `rate_limit_buckets` table keyed by an HMAC digest of the request scope and network address; never store raw IP addresses for this purpose.
- Purge rate-limit buckets after their fixed window and Key Group change-log entries after 90 days through the idempotent daily cleanup routes.
- Use constant-time digest comparison where application-level comparison is required.
- Return generic invalid-key errors that do not reveal whether a group exists.
- Provide explicit warnings that anyone with the group key has full management access and that lost keys cannot be recovered.

## Error and Recovery Experience

Errors use the existing single workspace status region and specific recovery actions:

- Network unavailable: keep local draft and allow retry.
- Invalid group key: keep the join form populated and allow correction.
- Group deleted but recoverable: explain the deletion date and show **Restore group**.
- Group permanently removed: remove the remembered key and return to Local Library.
- Stale page version: preserve draft and offer reload or copy.
- Group creation failure: leave Local Library untouched and create no partial server group.
- Quick Share expired: show a quiet `410` reader recovery page.
- Quick Share creation failure: keep the dialog state and allow retry.

## Testing Strategy

### Unit and Integration Tests

- Expiration calculation for every Quick Share option.
- Secure random identifier and token shape.
- HMAC digest generation and verification without raw-key persistence.
- Quick Share size validation and `404`, `410`, `413`, and `403` responses.
- Complete local-to-group hierarchy mapping.
- Atomic rollback of failed group creation.
- Group-key isolation between groups.
- Folder-cycle and cross-group reference rejection.
- Optimistic update success and `409` conflict behavior.
- Incremental group refresh, ordered change application, and full-reset fallback after change-log retention.
- Soft delete, restore, and purge transitions.
- Background refresh refusal while a draft is active.

### End-to-End Tests

- Create each Quick Share expiration type and open the public reader.
- Verify public pages expose no editing or library controls.
- Delete a share with the stored management token.
- Create a Key Group from nested books and root pages.
- Join from a clean browser context using only the key.
- Switch between independent Local and Group libraries.
- Edit shared Markdown and observe it after refresh in a second context.
- Trigger a two-context version conflict and preserve the losing draft.
- Remember a joined group across reload, then leave and remove local access.
- Soft-delete and restore a group.
- Verify desktop, tablet, and mobile layouts without overflow.
- Verify keyboard focus, dialogs, status messages, and reduced-motion behavior.

## Delivery Sequence

The features are implemented as separate milestones and plans:

1. **Quick Share** first: establishes Supabase connectivity, migrations, server-only data access, expiration cleanup, and public reader routing with a small data model.
2. **Key Groups** second: builds on the verified database boundary and adds complete-library copying, workspace switching, CRUD, remembered keys, optimistic concurrency, refresh, and recovery.

Quick Share must be production-verified before Key Group implementation begins. Each milestone has its own migrations, tests, release checklist, and rollback path.

## Approved Product Decisions

- Quick Share and Key Groups are separate features.
- Quick Share is view-only and requires only its unlisted URL.
- Quick Share expiration is creator-selected: 1 hour, 1 day, 7 days, 30 days, or never; default is 7 days.
- Key Groups require no account and use one generated key.
- Every key holder has equal full group permissions.
- A new Key Group copies the complete Local Library once.
- Local and Group libraries remain separate afterward.
- Group collaboration is saved collaboration, not real-time simultaneous editing.
- Group keys are remembered in IndexedDB until the user leaves.
- Supabase stores readable group Markdown and only a digest of the group key.
- The existing Next.js Vercel deployment remains the backend gateway.
