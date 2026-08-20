# Mdez Key Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people join one shared Markdown library with a single secret group key and collaboratively edit all of its folders and pages without accounts.

**Architecture:** A Key Group is a separate server-backed workspace. Creating one copies the complete current Local Library into Supabase in one transaction; thereafter Local and Group libraries are independent, and every key holder has equal read/write/delete authority. Next.js route handlers HMAC the presented key, use transactional Postgres repositories with optimistic versions and a revisioned change log, while the browser remembers the raw key and cached snapshot only in IndexedDB.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `postgres`, Supabase Postgres, Dexie/IndexedDB, Web Crypto, Vitest, Testing Library, Playwright, Vercel Cron

## Global Constraints

- Start only after the Quick Share plan is merged, deployed, and production-verified. Execute in a new worktree and `codex/key-groups` branch created from the then-latest `origin/main`.
- The approved design is `docs/superpowers/specs/2026-08-09-mdez-quick-share-key-groups-design.md`.
- Do not add authentication, users, roles, email, invitations, or ownership. One generated group key grants every holder equal full authority.
- The group key must contain at least 128 random bits, travel only in the `x-mdez-group-key` HTTPS header, never appear in URLs/logs/analytics, and be stored in Supabase only as HMAC-SHA-256 using `GROUP_KEY_PEPPER`.
- The browser may remember the raw group key in IndexedDB until the user chooses Leave Group. Clearing browser data removes remembered access.
- Supabase stores readable group Markdown and folder/page metadata; the group key itself is never stored there.
- Creating a group copies every current Local Library folder and document once, including imported GitHub Markdown as ordinary pages, while excluding GitHub source/refresh metadata. Local and Group libraries never sync after creation.
- A group supports at most 1,000 pages, 5 MiB per page, and 50 MiB total Markdown measured as UTF-8 bytes. Creation is all-or-nothing.
- Editing is saved collaboration, not realtime co-editing. Mutations require `expectedVersion`; stale writes return `409` and must preserve the local draft.
- On conflict, offer exactly “Reload shared version” and “Copy my draft to a new page.” Never silently overwrite another holder's update.
- Refresh on window focus, manual refresh, and every 30 seconds only when there is no unsaved draft. Use incremental changes; if the cursor is older than the retained 90-day log, return `reset_required` and fetch a full snapshot.
- Deleting a group soft-deletes it for seven days. Any key holder can restore it during that window; an authenticated daily cron permanently purges it afterward. Groups otherwise never expire.
- Use parameterized SQL, transactions for every revisioned mutation, safe Markdown rendering with raw HTML disabled, and `Cache-Control: no-store` for all group reads.
- Enforce 5 group creates per IP per hour, 20 failed group-key checks per IP per minute, and 120 mutations per group per minute using the existing HMAC rate-limit table; never persist raw IP addresses.
- Required additional server variable: `GROUP_KEY_PEPPER`, at least 32 random bytes and without a `NEXT_PUBLIC_` prefix. Reuse `SUPABASE_DATABASE_URL`, `RATE_LIMIT_PEPPER`, and `CRON_SECRET` from Quick Share.
- Preserve all Local Library data and behavior. Group pages can be Quick Shared through the existing Quick Share snapshot flow.

---

## File Map

| Responsibility | File |
|---|---|
| Group schema, constraints, indexes, change log | `supabase/migrations/202608090002_key_groups.sql` |
| Shared public types and limits | `src/types/key-group.ts` |
| Browser key generation and import mapping | `src/lib/key-group.ts`, `src/lib/key-group-snapshot.ts` |
| Server key HMAC and request authorization | `src/server/key-groups/secrets.ts`, `src/server/key-groups/authorize.ts` |
| Postgres persistence | `src/server/key-groups/store.ts`, `src/server/key-groups/postgres-store.ts` |
| HTTP use cases and route composition | `src/server/key-groups/service.ts`, `src/server/key-groups/runtime.ts` |
| Group endpoints | `src/app/api/key-groups/**/route.ts` |
| Remembered access and cached snapshot | `src/lib/db.ts`, `src/lib/key-group-repository.ts` |
| Browser API client | `src/lib/key-group-client.ts` |
| Group workspace controller | `src/hooks/useKeyGroupLibrary.ts`, `src/hooks/useGroupRefresh.ts` |
| Workspace selection and group UI | `src/components/mdez/WorkspaceSwitcher.tsx`, `CreateGroupDialog.tsx`, `JoinGroupDialog.tsx`, `GroupConflictDialog.tsx`, `GroupSettingsDialog.tsx`, `MdezWorkspace.tsx` |
| Unit and two-session browser coverage | `tests/unit/key-group*.test.ts(x)`, `tests/e2e/key-groups.spec.ts` |

### Task 1: Add Key Group schema and public domain types

**Files:**
- Modify: `.env.example`
- Create: `supabase/migrations/202608090002_key_groups.sql`
- Create: `src/types/key-group.ts`
- Create: `tests/unit/key-group-schema.test.ts`

**Interfaces:**
- Consumes: the Quick Share database connection and `rate_limit_buckets` table.
- Produces: `key_groups`, `group_folders`, `group_documents`, `group_change_log`, and the shared Key Group TypeScript contract.

- [ ] **Step 1: Write the failing schema test**

```ts
// tests/unit/key-group-schema.test.ts
import { readFileSync } from "node:fs";

it("defines revisioned private group tables with seven-day deletion", () => {
  const sql = readFileSync("supabase/migrations/202608090002_key_groups.sql", "utf8");
  for (const table of ["key_groups", "group_folders", "group_documents", "group_change_log"]) {
    expect(sql).toContain(`create table public.${table}`);
    expect(sql).toContain(`alter table public.${table} enable row level security`);
  }
  expect(sql).toContain("key_digest bytea not null unique");
  expect(sql).toContain("purge_after timestamptz");
  expect(sql).toContain("version integer not null default 1");
  expect(sql).toContain("group_revision bigint not null");
});
```

- [ ] **Step 2: Run the schema test and confirm the migration is absent**

Run: `npm test -- --run tests/unit/key-group-schema.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add exact types and limits**

```ts
// src/types/key-group.ts
export const GROUP_LIMITS = { pages: 1000, pageBytes: 5 * 1024 * 1024, totalBytes: 50 * 1024 * 1024 } as const;

export type GroupFolder = { id: string; parentId: string | null; name: string; order: number; version: number; groupRevision: number; createdAt: string; updatedAt: string };
export type GroupDocument = { id: string; folderId: string | null; title: string; body: string; order: number; version: number; groupRevision: number; createdAt: string; updatedAt: string };
export type GroupSummary = { id: string; name: string; revision: number; deletedAt: string | null; purgeAfter: string | null; createdAt: string; updatedAt: string };
export type GroupSnapshot = { group: GroupSummary; folders: GroupFolder[]; documents: GroupDocument[] };
export type GroupChange = { revision: number; entityType: "group" | "folder" | "document"; entityId: string; operation: "create" | "update" | "delete"; changedAt: string };
export type GroupChangesResult = { status: "changes"; revision: number; changes: GroupChange[]; records: { group: GroupSummary | null; folders: GroupFolder[]; documents: GroupDocument[] } } | { status: "reset_required"; revision: number };
export type LocalGroupImport = { name: string; folders: Array<{ clientId: string; parentClientId: string | null; name: string; order: number; createdAt: string; updatedAt: string }>; documents: Array<{ clientId: string; folderClientId: string | null; title: string; body: string; order: number; createdAt: string; updatedAt: string }> };
export type LocalGroupCreation = { key: string; import: LocalGroupImport };
export type GroupConflict = { entityType: "folder" | "document"; entityId: string; expectedVersion: number; currentVersion: number };
```

- [ ] **Step 4: Add the normalized schema**

Use this schema as the migration body:

```sql
create table public.key_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  key_digest bytea not null unique,
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  purge_after timestamptz,
  check ((deleted_at is null and purge_after is null) or
         (deleted_at is not null and purge_after >= deleted_at))
);

create table public.group_folders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.key_groups(id) on delete cascade,
  parent_id uuid,
  name text not null check (char_length(name) between 1 and 300),
  sort_order integer not null check (sort_order >= 0),
  version integer not null default 1 check (version > 0),
  group_revision bigint not null check (group_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, id),
  foreign key (group_id, parent_id) references public.group_folders(group_id, id) on delete restrict
);

create table public.group_documents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.key_groups(id) on delete cascade,
  folder_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  markdown text not null check (octet_length(markdown) <= 5242880),
  sort_order integer not null check (sort_order >= 0),
  version integer not null default 1 check (version > 0),
  group_revision bigint not null check (group_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, id),
  foreign key (group_id, folder_id) references public.group_folders(group_id, id) on delete restrict
);

create table public.group_change_log (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.key_groups(id) on delete cascade,
  revision bigint not null check (revision > 0),
  entity_type text not null check (entity_type in ('group', 'folder', 'document')),
  entity_id uuid not null,
  operation text not null check (operation in ('create', 'update', 'delete')),
  changed_at timestamptz not null default now(),
  unique (group_id, revision)
);

create index group_folders_group_idx on public.group_folders (group_id, sort_order);
create index group_documents_group_idx on public.group_documents (group_id, sort_order);
create index group_change_log_cursor_idx on public.group_change_log (group_id, revision);
create index key_groups_purge_idx on public.key_groups (purge_after) where purge_after is not null;
```

The composite foreign keys ensure parents and destination folders belong to the same group. Enable RLS and revoke `anon, authenticated` access on every table; server Postgres is the only data path.

The migration must also install this guard on both child tables. Do not put plaintext keys or creator/user columns in any table.

```sql
create function public.reject_deleted_group_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.key_groups where id = new.group_id and deleted_at is not null) then
    raise exception 'group is deleted' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger group_folders_active_guard before insert or update on public.group_folders
for each row execute function public.reject_deleted_group_mutation();
create trigger group_documents_active_guard before insert or update on public.group_documents
for each row execute function public.reject_deleted_group_mutation();

alter table public.key_groups enable row level security;
alter table public.group_folders enable row level security;
alter table public.group_documents enable row level security;
alter table public.group_change_log enable row level security;
revoke all on public.key_groups, public.group_folders, public.group_documents, public.group_change_log from anon, authenticated;
```

- [ ] **Step 5: Add the environment variable and run checks**

Append `GROUP_KEY_PEPPER=replace-with-an-independent-at-least-32-byte-secret` to `.env.example`.

Run: `npm test -- --run tests/unit/key-group-schema.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit schema and contracts**

```bash
git add .env.example supabase/migrations/202608090002_key_groups.sql src/types/key-group.ts tests/unit/key-group-schema.test.ts
git commit -m "feat: add key group schema and contracts"
```

### Task 2: Generate keys and validate a complete Local Library import

**Files:**
- Create: `src/lib/key-group.ts`
- Create: `src/lib/key-group-snapshot.ts`
- Create: `src/server/key-groups/secrets.ts`
- Create: `tests/unit/key-group-domain.test.ts`

**Interfaces:**
- Consumes: Local `Folder[]`, `Document[]`, Web Crypto, and `GROUP_KEY_PEPPER`.
- Produces: `generateGroupKey()`, `isValidGroupKey()`, `buildLocalGroupCreation()`, `validateLocalGroupCreation()`, and `digestGroupKey()`.

- [ ] **Step 1: Write failing key and import tests**

```ts
// tests/unit/key-group-domain.test.ts
it("generates a copyable key with at least 128 random bits", () => {
  const key = generateGroupKey();
  expect(key).toMatch(/^mdez-group-[A-Za-z0-9_-]{22}$/);
  expect(isValidGroupKey(key)).toBe(true);
});

it("copies hierarchy and Markdown but strips GitHub source metadata", () => {
  const input = buildLocalGroupCreation("Writers", "mdez-group-AAAAAAAAAAAAAAAAAAAAAA", [{ id: "f1", parentId: null, name: "Book", order: 0, sourceId: "gh", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-02T00:00:00Z" }], [{ id: "d1", folderId: "f1", title: "one.md", body: "# One", order: 0, sourceId: "gh", createdAt: "2026-08-03T00:00:00Z", updatedAt: "2026-08-04T00:00:00Z" }]);
  expect(input.import.folders[0]).toEqual({ clientId: "f1", parentClientId: null, name: "Book", order: 0, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-02T00:00:00Z" });
  expect(input.import.documents[0]).toEqual({ clientId: "d1", folderClientId: "f1", title: "one.md", body: "# One", order: 0, createdAt: "2026-08-03T00:00:00Z", updatedAt: "2026-08-04T00:00:00Z" });
  expect(JSON.stringify(input)).not.toContain("sourceId");
});

it("rejects more than 50 MiB total before upload", () => {
  const documents = Array.from({ length: 11 }, (_, index) => ({ clientId: `d${index}`, folderClientId: null, title: `${index}.md`, body: "x".repeat(5 * 1024 * 1024), order: index, createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }));
  expect(() => validateLocalGroupCreation({ key: "mdez-group-AAAAAAAAAAAAAAAAAAAAAA", import: { name: "Large", folders: [], documents } })).toThrow("Group Markdown must total 50 MiB or less");
});
```

- [ ] **Step 2: Run the test and verify domain modules are missing**

Run: `npm test -- --run tests/unit/key-group-domain.test.ts`

Expected: FAIL because the exports do not exist.

- [ ] **Step 3: Implement browser key generation and structural validation**

Generate 16 random browser bytes with `crypto.getRandomValues`, encode base64url without padding, and prefix `mdez-group-`. Validate the exact regex before any API request. `validateLocalGroupCreation` must verify the key plus: trimmed group name 1–100 characters; unique client IDs; every parent/folder reference exists; no folder cycle; parseable creation/update timestamps; page count; each page byte size; and total byte size. Return a normalized deep copy rather than mutating Local records.

```ts
export function generateGroupKey(): string;
export function isValidGroupKey(value: string): boolean;
export function validateLocalGroupCreation(value: unknown): LocalGroupCreation;
export function buildLocalGroupCreation(name: string, key: string, folders: Folder[], documents: Document[]): LocalGroupCreation;
```

- [ ] **Step 4: Implement server HMAC**

```ts
// src/server/key-groups/secrets.ts
import "server-only";
import { createHmac } from "node:crypto";

export function digestGroupKey(key: string): Buffer {
  const pepper = process.env.GROUP_KEY_PEPPER;
  if (!pepper || Buffer.byteLength(pepper) < 32) throw new Error("GROUP_KEY_PEPPER must contain at least 32 bytes");
  return createHmac("sha256", pepper).update(key, "utf8").digest();
}
```

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- --run tests/unit/key-group-domain.test.ts`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: PASS.

```bash
git add src/lib/key-group.ts src/lib/key-group-snapshot.ts src/server/key-groups/secrets.ts tests/unit/key-group-domain.test.ts
git commit -m "feat: validate key group creation data"
```

### Task 3: Create, authorize, join, and read groups transactionally

**Files:**
- Create: `src/server/key-groups/store.ts`
- Create: `src/server/key-groups/postgres-store.ts`
- Create: `src/server/key-groups/authorize.ts`
- Create: `src/server/key-groups/service.ts`
- Create: `tests/unit/key-group-service.test.ts`

**Interfaces:**
- Consumes: validated `LocalGroupCreation`, `digestGroupKey()`, database `Sql`, and failed-key rate limit decisions.
- Produces: `KeyGroupStore`, `createGroupService()`, `joinGroupService()`, and `getGroupSnapshotService()`.

- [ ] **Step 1: Write failing all-or-nothing and authorization tests**

```ts
// tests/unit/key-group-service.test.ts
it("creates one group and its complete snapshot in one store call", async () => {
  const store = fakeGroupStore();
  const result = await createGroupService({ key: validKey, import: validImport }, { store, address: "198.51.100.1" });
  expect(store.createGroup).toHaveBeenCalledOnce();
  expect(result.folders).toHaveLength(validImport.folders.length);
  expect(result.documents).toHaveLength(validImport.documents.length);
});

it("does not reveal whether a malformed or unknown key exists", async () => {
  const store = fakeGroupStore({ findByKeyDigest: async () => null });
  await expect(joinGroupService("mdez-group-BBBBBBBBBBBBBBBBBBBBBB", { store, address: "198.51.100.1" }))
    .rejects.toMatchObject({ code: "INVALID_KEY", message: "Group key is invalid" });
});

it("allows a valid key to read a soft-deleted group for restoration", async () => {
  const store = fakeGroupStore({ snapshot: deletedSnapshot });
  await expect(getGroupSnapshotService(validKey, { store, address: "198.51.100.1" }))
    .resolves.toMatchObject({ group: { deletedAt: expect.any(String) } });
});
```

- [ ] **Step 2: Run and confirm the store/service boundary is missing**

Run: `npm test -- --run tests/unit/key-group-service.test.ts`

Expected: FAIL because the group server modules do not exist.

- [ ] **Step 3: Define the persistence interface**

```ts
// src/server/key-groups/store.ts
export interface KeyGroupStore {
  createGroup(input: LocalGroupImport, keyDigest: Buffer): Promise<GroupSnapshot>;
  findGroupIdByDigest(keyDigest: Buffer): Promise<string | null>;
  getSnapshot(groupId: string): Promise<GroupSnapshot | null>;
  getChanges(groupId: string, afterRevision: number): Promise<GroupChangesResult>;
  createFolder(groupId: string, input: { name: string; parentId: string | null }): Promise<GroupFolder>;
  updateFolder(groupId: string, id: string, input: { name?: string; parentId?: string | null; order?: number; expectedVersion: number }): Promise<GroupFolder>;
  deleteFolder(groupId: string, id: string, expectedVersion: number): Promise<number>;
  createDocument(groupId: string, input: { title: string; body: string; folderId: string | null }): Promise<GroupDocument>;
  updateDocument(groupId: string, id: string, input: { title?: string; body?: string; folderId?: string | null; order?: number; expectedVersion: number }): Promise<GroupDocument>;
  deleteDocument(groupId: string, id: string, expectedVersion: number): Promise<number>;
  renameGroup(groupId: string, name: string): Promise<GroupSummary>;
  softDeleteGroup(groupId: string, now: Date): Promise<GroupSummary>;
  restoreGroup(groupId: string, now: Date): Promise<GroupSummary>;
  purgeDeletedGroups(now: Date): Promise<number>;
}
```

Define `KeyGroupError` codes `INVALID_KEY | DELETED | NOT_FOUND | CONFLICT | LIMIT_EXCEEDED`. The authorization service computes a digest, queries by digest, and applies the failed-key limiter only when no group matches; it must emit the same public `INVALID_KEY` response for malformed and unknown keys. For every group-ID route, `authorizeGroup(groupId, key, address)` must require the digest lookup to return that exact `groupId`; a valid key for a different group receives the same `INVALID_KEY` result.

- [ ] **Step 4: Implement atomic Postgres creation and snapshot reads**

In `PostgresKeyGroupStore.createGroup`, use `sql.begin(async transaction => ...)`. Insert the group, build maps from client folder IDs to generated UUIDs in parent-first order, insert folders, then documents, and create revision-0 snapshot state. Preserve each imported `createdAt` and `updatedAt` value in its new group row. If any insert fails, the transaction rolls back. Recheck page/byte limits inside the transaction. Do not copy `sourceId` or GitHub rows.

All query output must map snake_case timestamps and numbers into the exact public types. Snapshot reads order folders/documents by `sort_order, id` and use one transaction snapshot so group metadata and content share a revision.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- --run tests/unit/key-group-service.test.ts tests/unit/key-group-domain.test.ts`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: PASS.

```bash
git add src/server/key-groups tests/unit/key-group-service.test.ts
git commit -m "feat: create and authorize key groups"
```

### Task 4: Add versioned mutations and the incremental change feed

**Files:**
- Modify: `src/server/key-groups/postgres-store.ts`
- Modify: `src/server/key-groups/service.ts`
- Create: `tests/unit/key-group-mutations.test.ts`

**Interfaces:**
- Consumes: the full `KeyGroupStore` mutation interface and authorized group ID.
- Produces: atomic folder/document CRUD, monotonic group revisions, `409` conflict data, 90-day change-feed fallback, soft delete, restore, and purge.

- [ ] **Step 1: Write failing mutation/concurrency tests**

```ts
// tests/unit/key-group-mutations.test.ts
it("increments entity version and group revision in one mutation", async () => {
  const updated = await store.updateDocument(groupId, documentId, { body: "second", expectedVersion: 1 });
  expect(updated.version).toBe(2);
  expect(updated.groupRevision).toBe(2);
  expect(await store.getChanges(groupId, 1)).toMatchObject({ status: "changes", revision: 2, changes: [{ entityType: "document", entityId: documentId, operation: "update" }] });
});

it("rejects a stale write without changing Markdown", async () => {
  await expect(store.updateDocument(groupId, documentId, { body: "stale", expectedVersion: 1 }))
    .rejects.toMatchObject({ code: "CONFLICT", conflict: { entityId: documentId, expectedVersion: 1, currentVersion: 2 } });
  expect((await store.getSnapshot(groupId))?.documents[0].body).toBe("second");
});

it("requests a reset when the cursor predates retained changes", async () => {
  expect(await store.getChanges(groupId, 0)).toEqual({ status: "reset_required", revision: 12 });
});
```

Use a real disposable Supabase test database when `TEST_SUPABASE_DATABASE_URL` is set; otherwise run the deterministic fake-transaction contract so local CI remains available. Never point these tests at production.

- [ ] **Step 2: Run the tests and confirm mutation methods are incomplete**

Run: `npm test -- --run tests/unit/key-group-mutations.test.ts`

Expected: FAIL on the first missing mutation/revision behavior.

- [ ] **Step 3: Implement one transaction template for every mutation**

Every create/update/delete transaction must:

1. Lock `key_groups` with `select ... for update` and reject content mutation when `deleted_at` is set.
2. Recheck size totals where body/page counts can change; the runtime must already have consumed the atomic per-group mutation rate bucket before calling the store.
3. Increment `key_groups.revision` and capture the returned revision.
4. For updates/deletes, constrain the SQL `where id = ... and version = expectedVersion`; if zero rows change, query the current version and throw `KeyGroupError("CONFLICT", ...)`.
5. Set entity `version = version + 1`, `group_revision = newRevision`, and `updated_at = now()`.
6. Insert exactly one `group_change_log` record with the same revision and operation.
7. Commit only after every step succeeds.

Folder deletion must reject a non-empty folder with the message “Move or delete its pages and subfolders first.” Document creation/update must recalculate UTF-8 byte limits before commit.

Use this update shape for documents; folder mutations use the same lock/version/revision/log order:

```ts
return this.sql.begin(async tx => {
  const [group] = await tx<{ revision: number; deleted_at: Date | null }[]>`
    select revision, deleted_at from key_groups where id = ${groupId} for update`;
  if (!group || group.deleted_at) throw new KeyGroupError("DELETED", "Group is deleted");
  const nextRevision = Number(group.revision) + 1;
  const rows = await tx<GroupDocumentRow[]>`
    update group_documents set
      title = coalesce(${input.title ?? null}, title),
      markdown = coalesce(${input.body ?? null}, markdown),
      folder_id = case when ${input.folderId !== undefined}
        then ${input.folderId ?? null}::uuid else folder_id end,
      version = version + 1, group_revision = ${nextRevision}, updated_at = now()
    where group_id = ${groupId} and id = ${id} and version = ${input.expectedVersion}
    returning *`;
  if (rows.length !== 1) throw await this.documentConflict(tx, groupId, id, input.expectedVersion);
  await tx`update key_groups set revision = ${nextRevision}, updated_at = now() where id = ${groupId}`;
  await tx`insert into group_change_log (group_id, revision, entity_type, entity_id, operation)
           values (${groupId}, ${nextRevision}, 'document', ${id}, 'update')`;
  return mapDocument(rows[0]);
});
```

- [ ] **Step 4: Implement changes, deletion lifecycle, and retention**

`getChanges(groupId, afterRevision)` returns ordered log records plus current rows for changed group/folder/document IDs; delete operations remain log-only so the browser can remove them. If `afterRevision` is lower than the earliest retained revision while current revision is newer, return `{ status: "reset_required", revision }`. Soft delete sets `deleted_at = now`, `purge_after = now + interval '7 days'`; restore clears both only before `purge_after`; purge deletes groups with `purge_after <= now`, relying on cascades. The daily cleanup also deletes change-log rows older than 90 days while retaining at least the latest revision marker per group.

- [ ] **Step 5: Run the mutation and schema suite**

Run: `npm test -- --run tests/unit/key-group-mutations.test.ts tests/unit/key-group-service.test.ts tests/unit/key-group-schema.test.ts`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit transactional collaboration**

```bash
git add src/server/key-groups/postgres-store.ts src/server/key-groups/service.ts tests/unit/key-group-mutations.test.ts
git commit -m "feat: add versioned group mutations"
```

### Task 5: Expose the complete Key Group HTTP API

**Files:**
- Create: `src/server/key-groups/runtime.ts`
- Create: `src/app/api/key-groups/route.ts`
- Create: `src/app/api/key-groups/join/route.ts`
- Create: `src/app/api/key-groups/[groupId]/route.ts`
- Create: `src/app/api/key-groups/[groupId]/changes/route.ts`
- Create: `src/app/api/key-groups/[groupId]/folders/route.ts`
- Create: `src/app/api/key-groups/[groupId]/folders/[folderId]/route.ts`
- Create: `src/app/api/key-groups/[groupId]/documents/route.ts`
- Create: `src/app/api/key-groups/[groupId]/documents/[documentId]/route.ts`
- Create: `src/app/api/cron/key-groups/route.ts`
- Create: `tests/unit/key-group-route.test.ts`

**Interfaces:**
- Consumes: group services, the `x-mdez-group-key` header, `requestAddress()`, and shared rate limits.
- Produces: create/join/snapshot/change/CRUD/delete/restore/purge endpoints.

- [ ] **Step 1: Write failing route contract tests**

```ts
// tests/unit/key-group-route.test.ts
it("never accepts a group key in a URL", async () => {
  const { GET } = await import("@/app/api/key-groups/[groupId]/route");
  const response = await GET(new Request(`https://mdez.app/api/key-groups/g1?key=${validKey}`), { params: Promise.resolve({ groupId: "g1" }) });
  expect(response.status).toBe(401);
});

it("returns a typed 409 conflict without the attempted Markdown", async () => {
  vi.mocked(runtime.updateDocument).mockRejectedValue(Object.assign(new Error("conflict"), { code: "CONFLICT", conflict: { entityType: "document", entityId: "d1", expectedVersion: 1, currentVersion: 2 } }));
  const { PATCH } = await import("@/app/api/key-groups/[groupId]/documents/[documentId]/route");
  const response = await PATCH(new Request("https://mdez.app/api/key-groups/g1/documents/d1", { method: "PATCH", headers: { "x-mdez-group-key": validKey }, body: JSON.stringify({ body: "my draft", expectedVersion: 1 }) }), { params: Promise.resolve({ groupId: "g1", documentId: "d1" }) });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "VERSION_CONFLICT", conflict: { entityType: "document", entityId: "d1", expectedVersion: 1, currentVersion: 2 } });
});
```

- [ ] **Step 2: Run the route tests and verify routes are absent**

Run: `npm test -- --run tests/unit/key-group-route.test.ts`

Expected: FAIL because Key Group routes do not exist.

- [ ] **Step 3: Compose the runtime and implement the route matrix**

Use this exact public matrix; every group-ID request requires `x-mdez-group-key`, verifies the digest belongs to that `groupId`, and returns `Cache-Control: no-store`:

| Method and path | Body/query | Success |
|---|---|---:|
| `POST /api/key-groups` | `LocalGroupImport` body + key header | `201 GroupSnapshot` |
| `POST /api/key-groups/join` | empty; key header | `200 GroupSnapshot` |
| `GET /api/key-groups/:groupId` | key header | `200 GroupSnapshot` |
| `GET /api/key-groups/:groupId/changes?after=N` | key header | `200 GroupChangesResult` |
| `PATCH /api/key-groups/:groupId` | `name` or `{ restore: true }` | `200 GroupSummary` |
| `DELETE /api/key-groups/:groupId` | key header | `200 GroupSummary` soft-deleted |
| `POST /api/key-groups/:groupId/folders` | `name,parentId` | `201 GroupFolder` |
| `PATCH/DELETE .../:groupId/folders/:id` | fields + `expectedVersion` | `200` |
| `POST /api/key-groups/:groupId/documents` | `title,body,folderId` | `201 GroupDocument` |
| `PATCH/DELETE .../:groupId/documents/:id` | fields + `expectedVersion` | `200` |
| `GET /api/cron/key-groups` | bearer cron secret | `200 { groups, changes, buckets }` |

Map missing/malformed key to `401`, soft-deleted mutation to `410`, unknown entity to `404`, limits to `413`, stale versions to `409`, and rate limits to `429` with `Retry-After`. Never include submitted keys, bodies, or database errors in responses/logs. Validate every ID as UUID or the project's generated-ID format before querying.

All route files must obtain the key through one helper and never inspect query parameters for it:

```ts
export function requireGroupKey(request: Request): string {
  const key = request.headers.get("x-mdez-group-key")?.trim() ?? "";
  if (!isValidGroupKey(key)) throw new KeyGroupError("INVALID_KEY", "Group key is invalid");
  return key;
}
```

- [ ] **Step 4: Run route and service checks**

Run: `npm test -- --run tests/unit/key-group-route.test.ts tests/unit/key-group-service.test.ts tests/unit/key-group-mutations.test.ts`

Expected: all tests PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit all API routes**

```bash
git add src/server/key-groups/runtime.ts src/app/api/key-groups src/app/api/cron/key-groups tests/unit/key-group-route.test.ts
git commit -m "feat: expose key group api"
```

### Task 6: Remember group access and cache its latest snapshot in IndexedDB

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/lib/key-group-repository.ts`
- Create: `src/lib/key-group-client.ts`
- Create: `tests/unit/key-group-repository.test.ts`

**Interfaces:**
- Consumes: Key Group HTTP matrix and Quick Share's Dexie version 3 database.
- Produces: `RememberedGroup`, `CachedGroupState`, browser client methods, `rememberGroup()`, `loadRememberedGroups()`, `cacheGroupSnapshot()`, `forgetGroup()`.

- [ ] **Step 1: Write failing persistence and header tests**

```ts
// tests/unit/key-group-repository.test.ts
it("remembers a raw key locally and removes cache on leave", async () => {
  await rememberGroup({ groupId: "g1", name: "Writers", key: validKey, joinedAt: "2026-08-09T00:00:00Z", lastOpenedAt: "2026-08-09T00:00:00Z" });
  await cacheGroupSnapshot(snapshot);
  expect(await loadRememberedGroups()).toEqual([expect.objectContaining({ key: validKey })]);
  await forgetGroup("g1");
  expect(await loadCachedGroup("g1")).toBeNull();
});

it("sends the group key only in its private header", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot), { status: 200 })));
  await getGroupSnapshot("g1", validKey);
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).not.toContain(validKey);
  expect(new Headers(init?.headers).get("x-mdez-group-key")).toBe(validKey);
});
```

- [ ] **Step 2: Run and verify the new stores/clients are absent**

Run: `npm test -- --run tests/unit/key-group-repository.test.ts`

Expected: FAIL because group persistence and client functions do not exist.

- [ ] **Step 3: Add Dexie version 4 without changing earlier stores**

```ts
export type RememberedGroup = { groupId: string; name: string; key: string; joinedAt: string; lastOpenedAt: string };
export type CachedGroupState = { groupId: string; revision: number; snapshot: GroupSnapshot; cachedAt: string };
```

Add `rememberedGroups: "groupId, lastOpenedAt"` and `cachedGroups: "groupId, cachedAt"` to a version-4 schema that repeats every prior store. `forgetGroup(groupId)` deletes both rows in one Dexie transaction. Never place group keys in `localStorage`, session storage, URLs, exported archives, or Quick Share records.

- [ ] **Step 4: Implement one typed API client**

```ts
export function createKeyGroup(input: LocalGroupCreation): Promise<GroupSnapshot>;
export function joinKeyGroup(key: string): Promise<GroupSnapshot>;
export function getGroupSnapshot(groupId: string, key: string): Promise<GroupSnapshot>;
export function getGroupChanges(groupId: string, key: string, after: number): Promise<GroupChangesResult>;
export function renameKeyGroup(groupId: string, key: string, name: string): Promise<GroupSummary>;
export function createGroupFolder(groupId: string, key: string, input: { name: string; parentId: string | null }): Promise<GroupFolder>;
export function updateGroupFolder(groupId: string, key: string, id: string, input: { name?: string; parentId?: string | null; order?: number; expectedVersion: number }): Promise<GroupFolder>;
export function deleteGroupFolder(groupId: string, key: string, id: string, expectedVersion: number): Promise<void>;
export function createGroupDocument(groupId: string, key: string, input: { title: string; body: string; folderId: string | null }): Promise<GroupDocument>;
export function updateGroupDocument(groupId: string, key: string, id: string, input: { title?: string; body?: string; folderId?: string | null; order?: number; expectedVersion: number }): Promise<GroupDocument>;
export function deleteGroupDocument(groupId: string, key: string, id: string, expectedVersion: number): Promise<void>;
export function deleteKeyGroup(groupId: string, key: string): Promise<GroupSummary>;
export function restoreKeyGroup(groupId: string, key: string): Promise<GroupSummary>;
```

`createKeyGroup` must destructure `{ key, import: payload }`, send `payload` as JSON, and send `key` only in `x-mdez-group-key`. Centralize fetch/error decoding. Convert a `409` body into a `KeyGroupConflictError` containing only `GroupConflict`; keep the attempted draft in caller state, not the error or logs.

- [ ] **Step 5: Run persistence regressions and commit**

Run: `npm test -- --run tests/unit/key-group-repository.test.ts tests/unit/shared-link-repository.test.ts tests/unit/repository.test.ts tests/unit/useWorkspaceLibrary.test.tsx`

Expected: all tests PASS and Local Library/Quick Share rows survive Dexie version 4.

```bash
git add src/lib/db.ts src/lib/key-group-repository.ts src/lib/key-group-client.ts tests/unit/key-group-repository.test.ts
git commit -m "feat: remember key group access locally"
```

### Task 7: Add group creation, joining, and Local/Group workspace switching

**Files:**
- Create: `src/components/mdez/WorkspaceSwitcher.tsx`
- Create: `src/components/mdez/CreateGroupDialog.tsx`
- Create: `src/components/mdez/JoinGroupDialog.tsx`
- Create: `src/hooks/useKeyGroupLibrary.ts`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Create: `tests/unit/key-group-entry.test.tsx`

**Interfaces:**
- Consumes: `useWorkspaceLibrary()` Local snapshot, `buildLocalGroupCreation()`, group browser client/repository.
- Produces: workspace mode `local | { groupId: string }`, create/join dialogs, and `KeyGroupLibraryController` matching the existing workspace actions.

- [ ] **Step 1: Write failing creation/join/switch tests**

```tsx
// tests/unit/key-group-entry.test.tsx
it("copies the complete Local Library exactly once when creating", async () => {
  const user = userEvent.setup();
  render(<MdezWorkspace />);
  await user.click(screen.getByRole("button", { name: "Workspaces" }));
  await user.click(screen.getByRole("button", { name: "Create group" }));
  await user.type(screen.getByRole("textbox", { name: "Group name" }), "Writers");
  await user.click(screen.getByRole("button", { name: "Create and copy Local Library" }));
  expect(createKeyGroup).toHaveBeenCalledWith(expect.objectContaining({ name: "Writers", folders: expect.any(Array), documents: expect.any(Array) }));
  expect(screen.getByRole("button", { name: "Current workspace: Writers" })).toBeVisible();
});

it("joins with one key and remembers the returned group", async () => {
  const user = userEvent.setup();
  render(<JoinGroupDialog open onClose={vi.fn()} onJoined={vi.fn()} />);
  await user.type(screen.getByLabelText("Group key"), validKey);
  await user.click(screen.getByRole("button", { name: "Join group" }));
  expect(joinKeyGroup).toHaveBeenCalledWith(validKey);
  expect(rememberGroup).toHaveBeenCalledWith(expect.objectContaining({ key: validKey }));
});
```

- [ ] **Step 2: Run tests and verify entry UI is missing**

Run: `npm test -- --run tests/unit/key-group-entry.test.tsx`

Expected: FAIL because the switcher/dialogs/hook do not exist.

- [ ] **Step 3: Implement creation and joining**

Creation shows group name, exact folder/page/byte counts, the statements “This copies Local Library once; the two libraries will not stay in sync,” “Anyone with this key has full management access,” and “A lost key cannot be recovered.” Show the generated key with Copy and Download `.txt` actions after success. Do not close until the raw key is saved to IndexedDB. Disable submit on limit violations and render the exact violated limit.

Joining accepts only the key, trims surrounding whitespace, never updates the browser URL, uses a password-style field with Show/Hide, and displays the same “Group key is invalid” message for malformed/unknown keys. Remember and cache only after a successful join.

- [ ] **Step 4: Implement workspace switching without duplicating the shell**

`useKeyGroupLibrary(groupId)` loads cached data immediately, resolves the remembered key internally, refreshes the snapshot, and returns the same action names MdezWorkspace already consumes: folder/document creation, rename, move, reorder, delete, body save, title save, selection, loading, and error. Reordering sends the moved entity's `expectedVersion` and transactionally normalizes sibling `sort_order` values. Use adapter functions to map `GroupFolder/GroupDocument` to the existing display `Folder/Document` shapes while retaining `version` in a side map.

`WorkspaceSwitcher` shows Local Library first, remembered groups newest-opened first, Create group, and Join group. `MdezWorkspace` owns only the active workspace ID and selects Local or Group controller; keep one editor, preview, sidebar, import/export, and Quick Share UI tree. Hide GitHub Refresh while in a group because imports were copied as ordinary Markdown; allow Markdown import, page/folder creation, export, and Quick Share.

Expose this adapter boundary so the shell does not branch for every action:

```ts
export type WorkspaceController = ReturnType<typeof useWorkspaceLibrary> & {
  kind: "local" | "group";
  group?: GroupSummary;
  refresh?: () => Promise<void>;
  hasConflict?: boolean;
};

export function useKeyGroupLibrary(groupId: string): WorkspaceController;
```

- [ ] **Step 5: Run entry, workspace, and responsive tests**

Run: `npm test -- --run tests/unit/key-group-entry.test.tsx tests/unit/useWorkspaceLibrary.test.tsx tests/unit/production-readiness.test.tsx`

Expected: all tests PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit entry and switching UI**

```bash
git add src/components/mdez/WorkspaceSwitcher.tsx src/components/mdez/CreateGroupDialog.tsx src/components/mdez/JoinGroupDialog.tsx src/hooks/useKeyGroupLibrary.ts src/components/mdez/MdezWorkspace.tsx tests/unit/key-group-entry.test.tsx
git commit -m "feat: create and join key group workspaces"
```

### Task 8: Add optimistic saves and conflict recovery

**Files:**
- Modify: `src/hooks/useDocumentDrafts.ts`
- Modify: `src/hooks/useKeyGroupLibrary.ts`
- Create: `src/components/mdez/GroupConflictDialog.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Create: `tests/unit/key-group-conflict.test.tsx`

**Interfaces:**
- Consumes: `KeyGroupConflictError`, document version map, and existing 650ms latest-save queue.
- Produces: conflict state that preserves the attempted title/body and two explicit recovery actions.

- [ ] **Step 1: Write failing save-conflict tests**

```tsx
// tests/unit/key-group-conflict.test.tsx
it("keeps a stale draft visible and offers both approved recovery actions", async () => {
  vi.mocked(updateGroupDocument).mockRejectedValue(new KeyGroupConflictError({ entityType: "document", entityId: "d1", expectedVersion: 1, currentVersion: 2 }));
  render(<GroupWorkspaceFixture initialBody="shared" />);
  await userEvent.type(screen.getByRole("textbox", { name: "Markdown editor" }), " local draft");
  expect(await screen.findByRole("dialog", { name: "This page changed in the group" })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Markdown editor" })).toHaveValue("shared local draft");
  expect(screen.getByRole("button", { name: "Reload shared version" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Copy my draft to a new page" })).toBeVisible();
});

it("copies the exact stale body into a new group page", async () => {
  await userEvent.click(screen.getByRole("button", { name: "Copy my draft to a new page" }));
  expect(createGroupDocument).toHaveBeenCalledWith("g1", validKey, expect.objectContaining({ title: "Welcome (conflict copy).md", body: "shared local draft" }));
});
```

- [ ] **Step 2: Run and confirm conflicts currently collapse into generic save errors**

Run: `npm test -- --run tests/unit/key-group-conflict.test.tsx`

Expected: FAIL because conflict state and recovery dialog do not exist.

- [ ] **Step 3: Extend the draft controller with typed persistence failures**

Add an optional `onPersistConflict(conflict, draft)` callback to `useDocumentDrafts` where `draft` is `{ id, title, body, field: "title" | "body" }`. In the catch branches, detect `KeyGroupConflictError`, call the callback, keep draft maps unchanged, clear the saving marker, and do not replace it with `SAVE_ERROR_MESSAGE`. Local persistence behavior remains byte-for-byte equivalent when the callback is absent.

```ts
type PersistedDraftConflict = { id: string; title: string; body: string; field: "title" | "body" };
type Options = {
  documents: Document[];
  selectedDocumentId: string | null;
  setDocuments: Dispatch<SetStateAction<Document[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  persistBody: (id: string, body: string) => Promise<Document>;
  persistTitle: (id: string, title: string) => Promise<Document>;
  onPersistConflict?: (conflict: GroupConflict, draft: PersistedDraftConflict) => void;
};
```

- [ ] **Step 4: Build both explicit recovery paths**

`Reload shared version` fetches a full group snapshot, replaces the stale cached entity/version, discards only that document's conflicted draft after confirmation, and closes the dialog. `Copy my draft to a new page` creates a sibling page with the exact draft, a collision-safe ` (conflict copy)` suffix, selects the new page after success, then refreshes the original. If creation fails, keep the dialog and draft open. Disable both buttons while an action is running.

- [ ] **Step 5: Run conflict and Local save regressions**

Run: `npm test -- --run tests/unit/key-group-conflict.test.tsx tests/unit/useDocumentDrafts.test.tsx tests/unit/latest-save-queue.test.ts`

Expected: all tests PASS and Local autosave remains 650ms/latest-write-wins.

- [ ] **Step 6: Commit safe concurrent editing**

```bash
git add src/hooks/useDocumentDrafts.ts src/hooks/useKeyGroupLibrary.ts src/components/mdez/GroupConflictDialog.tsx src/components/mdez/MdezWorkspace.tsx tests/unit/key-group-conflict.test.tsx
git commit -m "feat: recover key group edit conflicts"
```

### Task 9: Add incremental refresh, leave, delete, and restore controls

**Files:**
- Create: `src/hooks/useGroupRefresh.ts`
- Create: `src/components/mdez/GroupSettingsDialog.tsx`
- Modify: `src/hooks/useKeyGroupLibrary.ts`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Create: `tests/unit/key-group-refresh.test.tsx`
- Create: `tests/unit/group-settings-dialog.test.tsx`

**Interfaces:**
- Consumes: group revision, unsaved/conflict state, change endpoint, snapshot endpoint, and remembered-group repository.
- Produces: safe focus/timer/manual refresh and group lifecycle UI.

- [ ] **Step 1: Write failing refresh/lifecycle tests**

```tsx
// tests/unit/key-group-refresh.test.tsx
it("polls after 30 seconds only when no draft is unsaved", async () => {
  vi.useFakeTimers();
  const { rerender } = renderHook(({ dirty }) => useGroupRefresh({ groupId: "g1", key: validKey, revision: 4, hasUnsavedDraft: dirty, onChanges: vi.fn(), onReset: vi.fn() }), { initialProps: { dirty: true } });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(getGroupChanges).not.toHaveBeenCalled();
  rerender({ dirty: false });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(getGroupChanges).toHaveBeenCalledWith("g1", validKey, 4);
});

it("performs a full snapshot reset when the server requests it", async () => {
  vi.mocked(getGroupChanges).mockResolvedValue({ status: "reset_required", revision: 90 });
  await refresh();
  expect(getGroupSnapshot).toHaveBeenCalledWith("g1", validKey);
});
```

- [ ] **Step 2: Run and verify refresh/lifecycle modules are absent**

Run: `npm test -- --run tests/unit/key-group-refresh.test.tsx tests/unit/group-settings-dialog.test.tsx`

Expected: FAIL because the hook and settings dialog do not exist.

- [ ] **Step 3: Implement safe incremental refresh**

Use one in-flight promise guard. Trigger on `window.focus`, manual Refresh, and a 30-second interval. Skip automatic triggers while save status is `Unsaved` or `Saving...`, a conflict dialog is open, or the tab is hidden. Apply the endpoint's `records` by entity ID and use delete log entries to remove cached entities only when they have no local draft. On `reset_required`, fetch/cache the snapshot. Show “Updated from group” unobtrusively; do not steal focus or selection.

```ts
export type GroupRefreshOptions = {
  groupId: string;
  key: string;
  revision: number;
  hasUnsavedDraft: boolean;
  hasConflict?: boolean;
  onChanges: (result: Extract<GroupChangesResult, { status: "changes" }>) => Promise<void> | void;
  onReset: (snapshot: GroupSnapshot) => Promise<void> | void;
};

export function useGroupRefresh(options: GroupRefreshOptions): { refresh: () => Promise<void>; refreshing: boolean };
```

- [ ] **Step 4: Implement lifecycle controls with explicit warnings**

`Rename group` validates 1–100 characters and uses the shared group revision flow. `Leave group` deletes only the remembered key/cache from this browser and returns to Local Library; it does not change Supabase. `Delete group` warns that all key holders lose editing, calls soft delete, and shows the deletion date plus seven-day purge date. While deleted, show only Restore, Leave, export last cached copy, and deletion status; block edits. Any key holder can Restore before purge. After purge, an attempted refresh becomes the same invalid-key state and offers Leave Group.

- [ ] **Step 5: Run refresh, settings, and workspace tests**

Run: `npm test -- --run tests/unit/key-group-refresh.test.tsx tests/unit/group-settings-dialog.test.tsx tests/unit/key-group-entry.test.tsx tests/unit/useWorkspaceLibrary.test.tsx`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit refresh and lifecycle controls**

```bash
git add src/hooks/useGroupRefresh.ts src/hooks/useKeyGroupLibrary.ts src/components/mdez/GroupSettingsDialog.tsx src/components/mdez/MdezWorkspace.tsx tests/unit/key-group-refresh.test.tsx tests/unit/group-settings-dialog.test.tsx
git commit -m "feat: manage key group refresh and lifecycle"
```

### Task 10: Verify two-holder collaboration and deploy Key Groups

**Files:**
- Create: `tests/e2e/key-groups.spec.ts`
- Modify: `vercel.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: complete Key Group UI/API plus existing Quick Share and Vercel cleanup.
- Produces: a production-verified Key Groups release with two independent browser sessions.

- [ ] **Step 1: Write failing two-context browser journeys**

```ts
// tests/e2e/key-groups.spec.ts
test("two browsers join one key and share saved Markdown", async ({ browser }) => {
  const creatorContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const creator = await creatorContext.newPage();
  const joiner = await joinerContext.newPage();
  await installKeyGroupApiModel(creatorContext);
  await installKeyGroupApiModel(joinerContext);

  await creator.goto("/");
  await createGroupFromLocalLibrary(creator, "Writers");
  const key = await creator.getByLabel("Group key").inputValue();
  await joiner.goto("/");
  await joinGroup(joiner, key);
  await creator.getByRole("textbox", { name: "Markdown editor" }).fill("# Saved by creator");
  await expect(creator.getByText("Saved")).toBeVisible();
  await joiner.getByRole("button", { name: "Refresh group" }).click();
  await expect(joiner.getByRole("heading", { name: "Saved by creator" })).toBeVisible();
});
```

Define the test helpers in the same file with these signatures:

```ts
type KeyGroupApiModel = { revision: number; snapshot: GroupSnapshot; key: string; deletedAt: string | null };
function installKeyGroupApiModel(context: BrowserContext, model?: KeyGroupApiModel): Promise<KeyGroupApiModel>;
function createGroupFromLocalLibrary(page: Page, name: string): Promise<void>;
function joinGroup(page: Page, key: string): Promise<void>;
```

The route model must validate `x-mdez-group-key`, share one mutable `KeyGroupApiModel` between both contexts, increment versions/revisions conditionally, return `409` for stale versions, provide incremental records/deletions, and implement soft delete/restore. `createGroupFromLocalLibrary` and `joinGroup` use only visible role/label selectors.

The API model must be shared between the contexts and implement revisions/expected versions, not just return static fixtures. Add journeys for: full Local copy; Local/Group independence; remembered re-entry after reload; Leave removing access locally; stale concurrent edit conflict and both recovery actions; 30-second safe refresh; Quick Share of a Group page as view-only; soft delete/restore; expired purge state; 1,000-page/5-MiB/50-MiB limits; no key in any observed URL. Run in existing desktop and mobile projects.

- [ ] **Step 2: Run Key Group E2E and confirm remaining expectations fail**

Run: `npm run test:e2e -- tests/e2e/key-groups.spec.ts`

Expected: FAIL until the complete UI integration and selectors match the contract.

- [ ] **Step 3: Extend cron configuration and operational documentation**

Add `{ "path": "/api/cron/key-groups", "schedule": "43 3 * * *" }` to the existing `vercel.json` `crons` array without removing Quick Share cleanup.

Document in `README.md`: applying migration 002 after migration 001; setting `GROUP_KEY_PEPPER`; creating a test group; verifying readable Markdown and HMAC-only key storage in Supabase; testing two signed-out browsers; restoring inside seven days; manually invoking purge; rotating a pepper only with an explicit key invalidation/data migration plan. State that losing the group key means access cannot be recovered.

- [ ] **Step 4: Run focused browser coverage until it passes**

Run: `npm run test:e2e -- tests/e2e/key-groups.spec.ts`

Expected: all Key Group tests PASS in desktop and mobile projects.

- [ ] **Step 5: Run the complete release gate**

Run: `npm test`

Expected: all unit tests PASS, including Quick Share and Local Library regressions.

Run: `npm run lint`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: production build PASS and includes every Key Group route and both cron routes.

Run: `npm run test:e2e`

Expected: full desktop/mobile suite PASS, including Local Library, Quick Share, and Key Groups.

- [ ] **Step 6: Commit release coverage and operations**

```bash
git add tests/e2e/key-groups.spec.ts vercel.json README.md
git commit -m "test: verify key group collaboration flow"
```

- [ ] **Step 7: Deploy and run the production smoke sequence**

Apply migration 002 to the Supabase project, set `GROUP_KEY_PEPPER` in Vercel Preview, and deploy. In two clean browser profiles: create from a non-trivial Local Library; compare folder/page counts; join with the copied key; edit/save/refresh in both directions; force a stale-version conflict; recover by copying the draft; Quick Share a group page and confirm view-only; leave and rejoin; soft-delete and restore. Inspect network history for keys in headers only and inspect logs for absence of keys/Markdown.

After Preview passes, merge and repeat the core create/join/edit/conflict/delete/restore flow on Production. Confirm the scheduled cleanup returns deletion counts with `CRON_SECRET` and rejects requests without it.

Expected: Key Groups are independently production-verified without changing Local Library or Quick Share behavior.

Rollback: promote the last verified Quick-Share-only Vercel deployment, stop the Key Group cron, and leave migration 002 tables untouched for recovery. Do not drop group tables or rotate `GROUP_KEY_PEPPER` during rollback; redeploy the fixed release against the preserved rows.
