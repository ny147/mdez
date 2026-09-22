# Full-Library Backup and Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one versioned, human-readable Local Library backup and a validated, preview-first, additive restore that never overwrites existing content.

**Architecture:** Focused browser-only modules own the archive contract, ZIP building/parsing, and immutable restore planning. `MdezWorkspace` coordinates the UI, while one repository transaction remaps IDs and writes books, pages, retained GitHub sources, and bookmarks atomically.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, Dexie 4, JSZip 3, Web Crypto SHA-256, Vitest 2, Testing Library, Playwright 1.49, Tailwind CSS 3.

**Spec:** `docs/superpowers/specs/2026-09-22-full-library-backup-restore-design.md`

## Global Constraints

- Backup and restore target the Local Library only; Key Group content is never archived.
- Restore is additive and never deletes, replaces, or overwrites current content.
- Accept only `mdez-library-backup` schema version `1`; legacy book ZIP and generic ZIP import remain unsupported.
- Include all books, empty books, pages, Unsorted placement, relative ordering, timestamps, Local Library bookmarks, and safe public GitHub provenance.
- Exclude recent/resume history, preferences, Shared Link records/tokens, Key Group records/keys/cache, credentials, and server data.
- Enforce 100 MiB ZIP, 10,000 pages, 20 MiB per page, and 250 MiB total extracted Markdown.
- Use no new runtime dependency and perform no network request during backup parsing or restore.
- All restore writes must occur in one Dexie transaction over `folders`, `documents`, `githubSources`, and `pageBookmarks`.
- Existing page Markdown export, book ZIP export, GitHub import/refresh, workspace isolation, and autosave behavior must remain unchanged.
- Never log Markdown bodies, archive payloads, group keys, management tokens, credentials, or raw IP addresses.

## Review Focus

- A backup containing both `Plan.md` and `plan.md` paths must be rejected case-insensitively before any write.
- A second tab adding a colliding book or GitHub source after preview must make the plan stale and produce zero writes.
- A duplicate GitHub repository must restore all records owned by that source as detached local content without dangling `sourceId` values.
- A page whose UTF-8 byte length differs from its JavaScript string length must validate and round-trip by bytes, not UTF-16 code units.
- A transaction failure after books and sources are inserted must roll back those records and all pages/bookmarks.

---

## File Map

| File | Responsibility |
| --- | --- |
| `src/types/backup.ts` | Stable schema-v1, parsed backup, restore plan, error, and result contracts. |
| `src/lib/archive-path.ts` | Shared safe ZIP-path parsing used by GitHub import and workspace backup. |
| `src/lib/workspace-backup.ts` | Deterministic manifest/ZIP creation plus strict, mutation-free parsing. |
| `src/lib/workspace-restore-plan.ts` | Deterministic book collision and GitHub retain/detach planning with a stale-plan signature. |
| `src/lib/repository.ts` | One atomic additive restore operation. |
| `src/components/mdez/import/BackupImportPanel.tsx` | Backup file selection, drag/drop, preview, warnings, and validation messages. |
| `src/components/mdez/ImportDialog.tsx` | Fourth roving tab and preview/confirm state machine. |
| `src/components/mdez/ShelfPane.tsx` | Local-only visible backup action and busy/empty states. |
| `src/components/mdez/MdezWorkspace.tsx` | Backup download and Local Library restore orchestration. |
| `src/hooks/usePageBookmarks.ts` | Refresh bookmarks after repository-level restore. |
| `src/app/styles/workspace.css` | Four-action responsive Shelf layout only where existing utilities are insufficient. |
| `tests/unit/archive-path.test.ts` | Shared path rejection and GitHub behavior-preservation tests. |
| `tests/unit/workspace-backup.test.ts` | Builder/parser round-trip, format validation, integrity, and limits. |
| `tests/unit/workspace-restore.test.ts` | Planning, fresh-ID remapping, staleness, and atomic rollback. |
| `tests/unit/backup-import-panel.test.tsx` | Restore panel semantics and interaction states. |
| `tests/unit/import-dialog.test.tsx` | Fourth-tab keyboard and preview-confirm flow. |
| `tests/unit/library-view-ui.test.tsx` | Shelf backup action visibility, disabled, and busy states. |
| `tests/unit/usePageBookmarks.test.tsx` | Bookmark refresh after out-of-hook writes. |
| `tests/unit/production-readiness.test.tsx` | Import-dialog decomposition guard includes the backup panel. |
| `tests/e2e/mdez.spec.ts` | Desktop/mobile backup download, preview, restore, persistence, and zero-write failures. |
| `README.md`, `PRODUCT.md`, `docs/library-backup.md` | User-facing behavior, privacy, limits, compatibility, and recovery instructions. |

### Task 1: Define Contracts and Share ZIP Path Safety

**Files:**
- Create: `src/types/backup.ts`
- Create: `src/lib/archive-path.ts`
- Create: `tests/unit/archive-path.test.ts`
- Modify: `src/lib/github-import.ts`
- Test: `tests/unit/github-import.test.ts`

**Interfaces:**
- Consumes: JSZip entry names and existing `Folder`, `Document`, `PageBookmark`, and `GitHubSource` records.
- Produces: `splitSafeArchivePath(path: string): string[]`, schema-v1 backup types, `ParsedWorkspaceBackup`, `WorkspaceRestorePlan`, and `WorkspaceRestoreResult` used by every later task.

- [ ] **Step 1: Write failing shared path-safety tests**

Create `tests/unit/archive-path.test.ts` with explicit valid and invalid cases:

```ts
import { describe, expect, it } from "vitest";
import { splitSafeArchivePath } from "@/lib/archive-path";

describe("safe archive paths", () => {
  it("returns normalized segments for a relative forward-slash path", () => {
    expect(splitSafeArchivePath("books/notes/page.md")).toEqual(["books", "notes", "page.md"]);
  });

  it.each([
    "",
    "/absolute.md",
    "C:/drive.md",
    "books\\page.md",
    "books/../page.md",
    "books/./page.md",
    "books//page.md",
    "books/bad\nname.md"
  ])("rejects unsafe path %j", (path) => {
    expect(() => splitSafeArchivePath(path)).toThrow("Unsafe archive path");
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `npm test -- tests/unit/archive-path.test.ts`

Expected: FAIL because `@/lib/archive-path` does not exist.

- [ ] **Step 3: Add the shared path parser and route GitHub import through it**

Create `src/lib/archive-path.ts`:

```ts
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;

export function splitSafeArchivePath(path: string): string[] {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    /^[A-Za-z]:\//.test(path) ||
    path.includes("\\") ||
    CONTROL_CHARACTER.test(path)
  ) {
    throw new Error("Unsafe archive path.");
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error("Unsafe archive path.");
  }
  return segments;
}
```

In `src/lib/github-import.ts`, replace its duplicated character/path checks with `splitSafeArchivePath(originalPath)` inside `validateEntryPath`. Catch that helper's error and retain the current GitHub-facing message `The repository contains an unsafe archive path.`. Preserve the generated-root and mixed-root checks unchanged.

- [ ] **Step 4: Define the exact backup interfaces**

Create `src/types/backup.ts` with these exported contracts:

```ts
import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";
import type { PageBookmark } from "@/lib/db";

export type WorkspaceBackupManifestV1 = {
  format: "mdez-library-backup";
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  books: BackupBookV1[];
  pages: BackupPageV1[];
  bookmarks: BackupBookmarkV1[];
  githubSources: BackupGitHubSourceV1[];
};

export type BackupBookV1 = Omit<Folder, "parentId">;
export type BackupPageV1 = Omit<Document, "body" | "folderId"> & {
  bookId: string | null;
  path: string;
  byteLength: number;
  sha256: string;
};
export type BackupBookmarkV1 = { pageId: string; createdAt: string };
export type BackupGitHubSourceV1 = Omit<GitHubSource, "rootFolderId"> & { rootBookId: string };

export type WorkspaceBackupInput = {
  appVersion: string;
  exportedAt: string;
  books: Folder[];
  pages: Document[];
  bookmarks: PageBookmark[];
  githubSources: GitHubSource[];
};

export type ParsedBackupPage = { metadata: BackupPageV1; body: string };
export type ParsedWorkspaceBackup = {
  manifest: WorkspaceBackupManifestV1;
  pages: ParsedBackupPage[];
  totalMarkdownBytes: number;
};

export type PlannedBackupBook = BackupBookV1 & {
  restoredName: string;
  renamed: boolean;
};
export type PlannedBackupSource = BackupGitHubSourceV1 & {
  action: "retain" | "detach";
};
export type WorkspaceRestoreSummary = {
  bookCount: number;
  emptyBookCount: number;
  pageCount: number;
  unsortedPageCount: number;
  bookmarkCount: number;
  totalMarkdownBytes: number;
};
export type WorkspaceRestorePlan = {
  parsed: ParsedWorkspaceBackup;
  baseSignature: string;
  books: PlannedBackupBook[];
  sources: PlannedBackupSource[];
  summary: WorkspaceRestoreSummary;
};
export type WorkspaceRestoreResult = {
  bookCount: number;
  pageCount: number;
  bookmarkCount: number;
  firstDocumentId: string | null;
};

export type WorkspaceBackupErrorCode =
  | "unreadable_file"
  | "invalid_zip"
  | "unsupported_version"
  | "unsafe_structure"
  | "damaged_content"
  | "limit_exceeded"
  | "stale_preview";

export class WorkspaceBackupError extends Error {
  constructor(public readonly code: WorkspaceBackupErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceBackupError";
  }
}
```

- [ ] **Step 5: Run path and GitHub regression tests**

Run: `npm test -- tests/unit/archive-path.test.ts tests/unit/github-import.test.ts`

Expected: PASS, including all existing GitHub unsafe-path messages.

- [ ] **Step 6: Commit the contracts and safety extraction**

```sh
git add src/types/backup.ts src/lib/archive-path.ts src/lib/github-import.ts tests/unit/archive-path.test.ts tests/unit/github-import.test.ts
git commit -m "refactor: share safe archive path validation"
```

### Task 2: Build and Strictly Parse Version-1 Backups

**Files:**
- Create: `src/lib/workspace-backup.ts`
- Create: `tests/unit/workspace-backup.test.ts`

**Interfaces:**
- Consumes: `WorkspaceBackupInput` from Task 1.
- Produces: `createWorkspaceBackupBlob(input): Promise<Blob>`, `parseWorkspaceBackup(blob): Promise<ParsedWorkspaceBackup>`, `WORKSPACE_BACKUP_LIMITS`, and `validateBackupByteLimits(lengths)`.

- [ ] **Step 1: Write failing deterministic builder and round-trip tests**

Create fixtures containing one normal book, one empty book, one Unsorted page, duplicate slugged titles, a Unicode page, bookmarks, and one source-owned book. Pin time by passing `exportedAt` rather than mocking `Date`.

```ts
const input: WorkspaceBackupInput = {
  appVersion: "0.1.0",
  exportedAt: "2026-09-22T00:00:00.000Z",
  books: [book, emptyBook, githubBook],
  pages: [bookPage, duplicateTitlePage, unicodeUnsortedPage, githubPage],
  bookmarks: [{ workspaceId: "local", documentId: bookPage.id, createdAt: timestamp }],
  githubSources: [source]
};

it("creates a schema-v1 ZIP and round-trips every included record", async () => {
  const blob = await createWorkspaceBackupBlob(input);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  expect(Object.keys(zip.files)).toEqual(expect.arrayContaining([
    "manifest.json",
    "books/notes/plan.md",
    "books/notes/plan-2.md",
    "unsorted/untitled.md"
  ]));

  const parsed = await parseWorkspaceBackup(blob);
  expect(parsed.manifest).toMatchObject({
    format: "mdez-library-backup",
    schemaVersion: 1,
    appVersion: "0.1.0"
  });
  expect(parsed.manifest.books).toContainEqual(expect.objectContaining({ id: emptyBook.id }));
  expect(parsed.pages.find((page) => page.metadata.id === unicodeUnsortedPage.id)?.body)
    .toBe(unicodeUnsortedPage.body);
  expect(new TextEncoder().encode(unicodeUnsortedPage.body).byteLength)
    .toBeGreaterThan(unicodeUnsortedPage.body.length);
  expect(parsed.manifest.bookmarks).toEqual([{ pageId: bookPage.id, createdAt: timestamp }]);
});
```

- [ ] **Step 2: Write failing integrity, structure, and compatibility tests**

Add named tests that mutate generated ZIPs and assert typed errors:

```ts
it.each([
  ["missing manifest", "invalid_zip"],
  ["unsupported schema", "unsupported_version"],
  ["undeclared file", "unsafe_structure"],
  ["missing declared file", "damaged_content"],
  ["case-insensitive duplicate path", "unsafe_structure"],
  ["duplicate book ID", "unsafe_structure"],
  ["dangling book reference", "unsafe_structure"],
  ["invalid timestamp", "unsafe_structure"],
  ["checksum mismatch", "damaged_content"],
  ["invalid UTF-8", "damaged_content"]
])("rejects %s with %s and no mutation", async (_name, code) => {
  const archive = await malformedArchive(_name);
  await expect(parseWorkspaceBackup(archive)).rejects.toMatchObject({ code });
});
```

Implement `malformedArchive` in the test file with JSZip transformations for each listed case; do not mock the parser.

- [ ] **Step 3: Write failing exact numeric limit tests without allocating 250 MiB**

Test the pure length guard for boundary and boundary-plus-one values, and use one actual compressed archive to prove parser integration:

```ts
expect(() => validateBackupByteLimits([20 * 1024 * 1024])).not.toThrow();
expect(() => validateBackupByteLimits([20 * 1024 * 1024 + 1])).toThrow(/20 MiB/);
expect(() => validateBackupByteLimits(Array.from({ length: 10_000 }, () => 1))).not.toThrow();
expect(() => validateBackupByteLimits(Array.from({ length: 10_001 }, () => 1))).toThrow(/10,000/);
expect(() => validateBackupByteLimits([250 * 1024 * 1024])).toThrow(/20 MiB/);
expect(() => validateBackupByteLimits(Array.from({ length: 13 }, () => 20 * 1024 * 1024)))
  .toThrow(/250 MiB/);
```

Also assert the builder refuses the same per-page/count/total inputs and the parser rejects a Blob whose compressed size exceeds 100 MiB before calling JSZip.

- [ ] **Step 4: Run the focused test and verify failures**

Run: `npm test -- tests/unit/workspace-backup.test.ts`

Expected: FAIL because `workspace-backup.ts` does not exist.

- [ ] **Step 5: Implement deterministic building**

Create `src/lib/workspace-backup.ts` with exact exported limits and helpers:

```ts
export const WORKSPACE_BACKUP_LIMITS = {
  zipBytes: 100 * 1024 * 1024,
  pages: 10_000,
  pageBytes: 20 * 1024 * 1024,
  markdownBytes: 250 * 1024 * 1024
} as const;

export function validateBackupByteLimits(lengths: readonly number[]) {
  if (lengths.length > WORKSPACE_BACKUP_LIMITS.pages) {
    throw new WorkspaceBackupError("limit_exceeded", "A backup can contain at most 10,000 pages.");
  }
  if (lengths.some((length) => length > WORKSPACE_BACKUP_LIMITS.pageBytes)) {
    throw new WorkspaceBackupError("limit_exceeded", "Each page must be 20 MiB or smaller.");
  }
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total > WORKSPACE_BACKUP_LIMITS.markdownBytes) {
    throw new WorkspaceBackupError("limit_exceeded", "A backup can contain at most 250 MiB of Markdown.");
  }
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
```

Sort books by `order`, then name, then ID. Emit each book's pages by `order`, title, then ID; emit Unsorted pages last by the same page ordering. Use `slugifyTitle`, reserve paths through a case-folded set, and add `-2`, `-3`, and later suffixes before `.md`. Require `parentId === null`, valid timestamps, unique sibling orders, valid source relationships, and bookmarks whose `workspaceId` is exactly `local` and whose document exists.

Encode with `TextEncoder`, compute hashes from those bytes, place the bytes in JSZip, write the completed manifest, and generate with:

```ts
const blob = await zip.generateAsync({
  type: "blob",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
  mimeType: "application/zip"
});
if (blob.size > WORKSPACE_BACKUP_LIMITS.zipBytes) {
  throw new WorkspaceBackupError("limit_exceeded", "The backup ZIP is larger than 100 MiB.");
}
return blob;
```

- [ ] **Step 6: Implement strict mutation-free parsing**

Reject a Blob over 100 MiB before `JSZip.loadAsync`. Convert JSZip load failures to `invalid_zip`. Inspect every original entry name through `entry.unsafeOriginalName ?? entry.name`, reject case-folded duplicates, unsafe paths, undeclared non-directory entries, and directory entries not implied by declared files.

Parse `manifest.json` with explicit type guards: exact format/version, arrays, unique non-empty IDs, finite nonnegative integer orders, unique sibling orders, ISO timestamps with `createdAt <= updatedAt`, 64-character lowercase hex hashes, unique paths, valid book/source/page/bookmark references, and one source per case-folded normalized URL. Do not use type assertions as validation.

Decode every declared page as `uint8array`, run `validateBackupByteLimits` incrementally, compare byte length and `sha256`, and decode via:

```ts
let body: string;
try {
  body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
} catch {
  throw new WorkspaceBackupError("damaged_content", `${metadata.path} is not valid UTF-8.`);
}
```

Return pages in manifest order. Do not access IndexedDB, render Markdown, or call `fetch`.

- [ ] **Step 7: Run builder/parser and existing export tests**

Run: `npm test -- tests/unit/workspace-backup.test.ts tests/unit/export.test.ts tests/unit/github-import.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the archive round trip**

```sh
git add src/lib/workspace-backup.ts tests/unit/workspace-backup.test.ts
git commit -m "feat: create and validate library backups"
```

### Task 3: Plan Restore Outcomes and Commit Them Atomically

**Files:**
- Create: `src/lib/workspace-restore-plan.ts`
- Create: `tests/unit/workspace-restore.test.ts`
- Modify: `src/lib/repository.ts`

**Interfaces:**
- Consumes: `ParsedWorkspaceBackup`, current local `Folder[]` and `GitHubSource[]`.
- Produces: `createWorkspaceRestorePlan(parsed, existing)`, `workspaceRestoreBaseSignature(existing)`, and `restoreWorkspaceBackup(plan): Promise<WorkspaceRestoreResult>`.

- [ ] **Step 1: Write failing collision, source, and summary planning tests**

Use a parsed fixture with incoming books named `Notes`, `notes`, and `Research`, plus two different GitHub sources. Assert deterministic outcomes:

```ts
const plan = createWorkspaceRestorePlan(parsed, {
  folders: [{ ...existingBook, name: "Notes" }],
  sources: [{ ...existingSource, normalizedUrl: "https://github.com/openai/codex" }]
});

expect(plan.books.map(({ restoredName, renamed }) => ({ restoredName, renamed }))).toEqual([
  { restoredName: "Notes (restored)", renamed: true },
  { restoredName: "notes (restored 2)", renamed: true },
  { restoredName: "Research", renamed: false }
]);
expect(plan.sources.map(({ action }) => action)).toEqual(["detach", "retain"]);
expect(plan.summary).toEqual({
  bookCount: 3,
  emptyBookCount: 1,
  pageCount: 4,
  unsortedPageCount: 1,
  bookmarkCount: 1,
  totalMarkdownBytes: parsed.totalMarkdownBytes
});
```

Use `generatedNameCollisionKey` for comparison, but implement the specified suffixes `(restored)`, `(restored 2)`, and later rather than the migration helper's `(2)` format.

- [ ] **Step 2: Write failing atomic repository tests**

Against fake IndexedDB, seed existing books, Unsorted pages, one bookmark, and one source. Cover:

```ts
it("remaps every ID and appends restored records atomically", async () => {
  const result = await restoreWorkspaceBackup(plan);
  const content = await listContent();
  const restored = content.documents.filter((page) => !existingIds.has(page.id));

  expect(restored).toHaveLength(plan.summary.pageCount);
  expect(restored.every((page) => !archivePageIds.has(page.id))).toBe(true);
  expect(content.folders.find((book) => book.name === "Notes (restored)")).toBeDefined();
  expect(restored.find((page) => page.title === "Loose")?.folderId).toBeNull();
  expect(await db.pageBookmarks.get(["local", result.firstDocumentId!])).toBeDefined();
});

it("detaches every record owned by a duplicate source", async () => {
  await restoreWorkspaceBackup(duplicateSourcePlan);
  const content = await listContent();
  expect(content.sources).toHaveLength(1);
  expect(content.folders.filter((book) => book.name.includes("restored")).every((book) => !book.sourceId)).toBe(true);
  expect(content.documents.filter((page) => restoredTitles.has(page.title)).every((page) => !page.sourceId)).toBe(true);
});
```

Add a stale-plan test by creating another colliding book after preview, and a rollback test by spying on the second `db.documents.add` to throw after folders and retained sources were inserted. Snapshot all four tables before the call and assert exact equality afterward.

- [ ] **Step 3: Run restore tests and verify missing-module/function failures**

Run: `npm test -- tests/unit/workspace-restore.test.ts`

Expected: FAIL because planning and repository restore APIs do not exist.

- [ ] **Step 4: Implement immutable restore planning**

Create `src/lib/workspace-restore-plan.ts`. Define the stale-plan signature from sorted, collision-relevant state:

```ts
export function workspaceRestoreBaseSignature(input: { folders: Folder[]; sources: GitHubSource[] }) {
  return JSON.stringify({
    books: input.folders
      .map(({ id, name }) => ({ id, key: generatedNameCollisionKey(name) }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    sources: input.sources
      .map(({ id, normalizedUrl }) => ({ id, url: normalizedUrl.toLocaleLowerCase("en-US") }))
      .sort((left, right) => left.id.localeCompare(right.id))
  });
}
```

Allocate book names in manifest order against existing and earlier incoming names. Mark a source `detach` when its normalized URL already exists; otherwise mark it `retain` and reserve its URL so duplicate incoming sources cannot be retained twice. Compute empty-book count from page references and return a deeply copied plan whose arrays are not shared with caller-owned state.

- [ ] **Step 5: Implement one repository transaction**

Add `restoreWorkspaceBackup(plan)` to `src/lib/repository.ts`. Open:

```ts
const existing = {
  folders: await db.folders.toArray(),
  sources: await db.githubSources.toArray()
};
if (workspaceRestoreBaseSignature(existing) !== plan.baseSignature) {
  throw new WorkspaceBackupError(
    "stale_preview",
    "The Local Library changed. Preview this backup again before restoring."
  );
}
```

Place that check at the start of `db.transaction("rw", db.folders, db.documents, db.githubSources, db.pageBookmarks, async () => { ... })`. Inside the same callback, use `Math.max(-1, ...orders) + 1` for existing book and Unsorted starting orders. Sort incoming books/pages by archive order and assign sequential destination orders to preserve relative order without importing gaps. Build `bookIds`, `sourceIds`, and `pageIds` maps with `createId`.

For a detached source, omit `sourceId` from every owned book/page. For a retained source, create one fresh `GitHubSource` whose `rootFolderId` is the mapped `rootBookId`, then attach only records whose archive `sourceId` matches it. Add bookmarks as `{ workspaceId: "local", documentId: mappedId, createdAt }`.

Return the first mapped document in manifest order and exact inserted counts. Throw on any missing mapping even though the parser already validates references; this preserves the repository boundary.

- [ ] **Step 6: Run repository and restore suites**

Run: `npm test -- tests/unit/workspace-restore.test.ts tests/unit/repository.test.ts tests/unit/page-bookmarks.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit planning and persistence**

```sh
git add src/lib/workspace-restore-plan.ts src/lib/repository.ts tests/unit/workspace-restore.test.ts
git commit -m "feat: restore library backups atomically"
```

### Task 4: Add the Preview-First Restore Interface

**Files:**
- Create: `src/components/mdez/import/BackupImportPanel.tsx`
- Create: `tests/unit/backup-import-panel.test.tsx`
- Create: `tests/unit/import-dialog.test.tsx`
- Modify: `src/components/mdez/ImportDialog.tsx`
- Modify: `tests/unit/production-readiness.test.tsx`

**Interfaces:**
- Consumes: `WorkspaceRestorePlan`, `onRequestBackupPreview(file)`, and `onRestoreBackup(plan)` callbacks supplied by the workspace.
- Produces: a fourth import tab with a validated preview and explicit confirmation; it performs no persistence directly.

- [ ] **Step 1: Write failing panel presentation tests**

Render `BackupImportPanel` with a valid plan and assert the exact high-value content:

```tsx
render(
  <BackupImportPanel
    preview={plan}
    message=""
    busyAction={null}
    onFile={onFile}
    onDraggingChange={vi.fn()}
    dragging={false}
  />
);

expect(screen.getByText("3 books")).toBeVisible();
expect(screen.getByText("1 empty book")).toBeVisible();
expect(screen.getByText("4 pages")).toBeVisible();
expect(screen.getByText("1 Unsorted page")).toBeVisible();
expect(screen.getByText("1 bookmark")).toBeVisible();
expect(screen.getByText("Notes → Notes (restored)")).toBeVisible();
expect(screen.getByText(/restored as a local copy/i)).toBeVisible();
expect(screen.queryByText(parsed.pages[0].body)).not.toBeInTheDocument();
```

Add tests for `.mdez.zip` input acceptance, drag/drop, busy disabled state, and an error message associated with the panel.

- [ ] **Step 2: Write failing Import dialog state-machine tests**

Render `ImportDialog` with callback spies. Press ArrowRight from `GitHub repository` and assert focus/selection moves to `Restore backup`; Home returns to `Paste text`; End selects restore. Then select a file and verify:

```ts
expect(onRequestBackupPreview).toHaveBeenCalledWith(file);
expect(screen.getByRole("button", { name: "Restore backup" })).toBeEnabled();
fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));
await waitFor(() => expect(onRestoreBackup).toHaveBeenCalledWith(plan));
```

Assert choosing a second file clears the old preview before the second promise resolves. A stale-preview error clears the plan; other restore failures keep it for retry. All tabs and Close are disabled while parsing/restoring.

- [ ] **Step 3: Run UI tests and verify failures**

Run: `npm test -- tests/unit/backup-import-panel.test.tsx tests/unit/import-dialog.test.tsx tests/unit/production-readiness.test.tsx`

Expected: FAIL because the panel and callback props do not exist.

- [ ] **Step 4: Implement the focused backup panel**

Create `BackupImportPanel.tsx` as a controlled component. Its input uses:

```tsx
<input
  ref={ref}
  className="sr-only"
  type="file"
  aria-label="Choose Mdez backup"
  accept=".mdez.zip,application/zip"
  disabled={busyAction !== null}
  onChange={(event) => {
    const file = event.currentTarget.files?.[0];
    if (file) onFile(file);
    event.currentTarget.value = "";
  }}
/>
```

The visible drop zone says `Drop an Mdez backup here` and `Choose Mdez backup`. The preview heading is `Backup ready to restore`. Render `<time dateTime={exportedAt}>`, formatted byte size, count badges, a rename list, and source outcomes. Use singular/plural copy from numeric counts. Never render page bodies or full archive entry lists.

- [ ] **Step 5: Add the fourth Import source and state transitions**

In `ImportDialog.tsx`:

```ts
type ImportSource = "paste" | "files" | "github" | "backup";
type BusyAction = "local" | "preview" | "github" | "backup-preview" | "backup-restore" | null;

type ImportDialogProps = {
  folders: Folder[];
  selectedFolderId: string | null;
  onClose: () => void;
  onImport: (items: ImportItem[], folderId: string | null) => Promise<void>;
  onRequestGitHubPreview: (url: string) => Promise<GitHubImportSession>;
  onImportGitHub: (session: GitHubImportSession) => Promise<void>;
  onRequestBackupPreview: (file: File) => Promise<WorkspaceRestorePlan>;
  onRestoreBackup: (plan: WorkspaceRestorePlan) => Promise<void>;
};
```

Append `{ value: "backup", label: "Restore backup", icon: ArchiveRestore }` to `sourceOptions`. Add `backupPreview`, `backupRef`, and backup drag state. `previewBackup(file)` clears message/preview before awaiting the callback. `restoreBackup()` retains the plan on ordinary failure, but clears it when `error instanceof WorkspaceBackupError && error.code === "stale_preview"`.

Hide `Add pages to` for both GitHub and backup. Render `BackupImportPanel` in `import-panel-backup`. Add the footer confirmation button only when the backup tab is selected; disable it without a preview or while busy.

Update `production-readiness.test.tsx` so the decomposition list includes `BackupImportPanel` and asserts it does not import `@/lib/repository`.

- [ ] **Step 6: Run Import UI tests**

Run: `npm test -- tests/unit/backup-import-panel.test.tsx tests/unit/import-dialog.test.tsx tests/unit/production-readiness.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the restore interface**

```sh
git add src/components/mdez/import/BackupImportPanel.tsx src/components/mdez/ImportDialog.tsx tests/unit/backup-import-panel.test.tsx tests/unit/import-dialog.test.tsx tests/unit/production-readiness.test.tsx
git commit -m "feat: preview library backup restores"
```

### Task 5: Wire Backup Download, Restore Completion, and Bookmark Refresh

**Files:**
- Modify: `src/components/mdez/ShelfPane.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/hooks/usePageBookmarks.ts`
- Modify: `src/app/styles/workspace.css`
- Modify: `tests/unit/library-view-ui.test.tsx`
- Create: `tests/unit/usePageBookmarks.test.tsx`

**Interfaces:**
- Consumes: Task 2 archive APIs, Task 3 plan/repository APIs, Task 4 Import callbacks, current Local Library state, draft-overlaid pages, and local bookmark records.
- Produces: visible Local Library backup action, download orchestration, restore completion navigation, and refreshed bookmark state.

- [ ] **Step 1: Write failing Shelf action tests**

Extend the shared `ShelfPane` props with `onBackup`, `backupBusy`, and `backupDisabled`. Assert:

```tsx
const onBackup = vi.fn();
render(<ShelfPane {...emptyShelfProps} onBackup={onBackup} backupBusy={false} backupDisabled={false} />);
fireEvent.click(screen.getByRole("button", { name: "Back up library" }));
expect(onBackup).toHaveBeenCalledOnce();

render(<ShelfPane {...emptyShelfProps} onBackup={onBackup} backupBusy={false} backupDisabled />);
expect(screen.getByRole("button", { name: "Back up library" })).toBeDisabled();
expect(screen.getByRole("button", { name: "Back up library" }))
  .toHaveAttribute("title", "Create a book or page before backing up your library.");
```

Assert busy copy `Preparing backup…` and disabled duplicate activation. Existing tests continue to pass by adding explicit defaults to `emptyShelfProps` rather than making production props optional.

- [ ] **Step 2: Write failing bookmark refresh-hook tests**

Render the hook with workspace `local`, insert a bookmark directly through the database after initial load, call `refresh`, and assert `bookmarkedIds` updates. Switch to a group workspace and prove refresh never leaks local records.

```ts
const { result } = renderHook(() => usePageBookmarks("local"));
await waitFor(() => expect(result.current.isReady).toBe(true));
await db.pageBookmarks.put({ workspaceId: "local", documentId: "restored", createdAt: timestamp });
await act(() => result.current.refresh());
expect(result.current.bookmarkedIds).toEqual(new Set(["restored"]));
```

- [ ] **Step 3: Run focused tests and verify failures**

Run: `npm test -- tests/unit/library-view-ui.test.tsx tests/unit/usePageBookmarks.test.tsx`

Expected: FAIL because the Shelf props and bookmark `refresh` API do not exist.

- [ ] **Step 4: Add the Shelf backup action and bookmark refresh**

Add a `HardDriveDownload` secondary button to `ShelfPane` before `New page`:

```tsx
<button
  type="button"
  onClick={onBackup}
  disabled={backupBusy || backupDisabled}
  aria-label="Back up library"
  title={backupDisabled ? "Create a book or page before backing up your library." : undefined}
  className="secondary-button"
>
  <HardDriveDownload aria-hidden="true" />
  {backupBusy ? "Preparing backup…" : "Back up"}
</button>
```

Refactor `usePageBookmarks` so one `useCallback` loads current-workspace records and is used by both the effect and exported `refresh(): Promise<void>`. Preserve cancellation in the effect and existing error copy. `refresh` rejects after setting the error so restore orchestration can report incomplete metadata refresh without hiding successful content restore.

Keep the existing mobile `.library-actions` two-column grid. Remove or override `button:last-child { grid-column: 1 / -1; }` so four actions form two balanced rows; verify 320px width has no horizontal overflow.

- [ ] **Step 5: Wire Local Library backup creation**

In `MdezWorkspace.tsx`, import `packageMetadata` from `../../../package.json`, `listBookmarks`, `listContent`, backup functions, planner, and `restoreWorkspaceBackup`. Add `backupBusy` state.

`handleLibraryBackup` must refuse active Key Groups and duplicate activation, then execute:

```ts
setBackupBusy(true);
setOperationStatus({ message: "Preparing library backup…", state: "loading" });
try {
  const bookmarks = await listBookmarks("local");
  const blob = await createWorkspaceBackupBlob({
    appVersion: packageMetadata.version,
    exportedAt: new Date().toISOString(),
    books: localLibrary.folders,
    pages: activeGroupId ? localLibrary.documents : liveDocuments,
    bookmarks,
    githubSources: localLibrary.sources
  });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `mdez-library-${date}.mdez.zip`);
  setOperationStatus({ message: "Library backup downloaded", state: "saved" });
} catch (error) {
  localLibrary.setError(error instanceof Error ? error.message : "Mdez could not create the library backup.");
  setOperationStatus({ message: "Library backup failed; your library was not changed", state: "error" });
} finally {
  setBackupBusy(false);
}
```

The action is rendered only when `activeGroupId === null`; disable it when both `localLibrary.folders` and `localLibrary.documents` are empty. The code path deliberately uses `liveDocuments` only while Local Library is active, because group drafts must never enter a local backup.

- [ ] **Step 6: Wire preview and restore callbacks**

Add:

```ts
async function handleRequestBackupPreview(file: File) {
  setOperationStatus({ message: "Checking library backup", state: "loading" });
  const [parsed, localContent] = await Promise.all([
    parseWorkspaceBackup(file),
    listContent()
  ]);
  const plan = createWorkspaceRestorePlan(parsed, localContent);
  setOperationStatus({ message: "Library backup ready to restore", state: "saved" });
  return plan;
}

async function handleRestoreBackup(plan: WorkspaceRestorePlan) {
  setOperationStatus({ message: "Restoring library backup", state: "loading" });
  let result: WorkspaceRestoreResult;
  try {
    result = await restoreWorkspaceBackup(plan);
  } catch (error) {
    setOperationStatus({ message: "Restore failed; your existing library was unchanged", state: "error" });
    throw error;
  }

  setActiveGroupId(null);
  await localLibrary.refreshContent(result.firstDocumentId);
  let bookmarkRefreshFailed = false;
  if (activeGroupId === null) {
    try {
      await bookmarkMetadata.refresh();
    } catch {
      bookmarkRefreshFailed = true;
    }
  }
  setLibraryFilter("all");
  setLibraryQuery("");
  setViewMode(result.firstDocumentId ? "editor" : "shelf");
  setOperationStatus({
    message: bookmarkRefreshFailed
      ? "Pages restored; bookmarks will appear after reload"
      : `Restored ${result.pageCount} ${result.pageCount === 1 ? "page" : "pages"} in ${result.bookCount} ${result.bookCount === 1 ? "book" : "books"}`,
    state: "saved"
  });
}
```

When restore starts from Local Library, refresh the bound bookmark controller immediately. When it starts from a Key Group, `setActiveGroupId(null)` changes `workspaceId` to `local`, and the hook's existing workspace-change effect loads restored Local Library bookmarks on the next render. Pass both backup callbacks into `ImportDialog`.

If bookmark refresh fails after the transaction commits, keep the restore success result, show `Pages restored; bookmarks will appear after reload`, and do not misreport the committed content as rolled back.

- [ ] **Step 7: Run affected unit suites**

Run: `npm test -- tests/unit/library-view-ui.test.tsx tests/unit/usePageBookmarks.test.tsx tests/unit/import-dialog.test.tsx tests/unit/workspace-backup.test.ts tests/unit/workspace-restore.test.ts tests/unit/production-readiness.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit workspace orchestration**

```sh
git add src/components/mdez/ShelfPane.tsx src/components/mdez/MdezWorkspace.tsx src/hooks/usePageBookmarks.ts src/app/styles/workspace.css tests/unit/library-view-ui.test.tsx tests/unit/usePageBookmarks.test.tsx
git commit -m "feat: connect library backup and restore"
```

### Task 6: Prove the Complete Recovery Flow and Publish the Contract

**Files:**
- Modify: `tests/e2e/mdez.spec.ts`
- Modify: `README.md`
- Modify: `PRODUCT.md`
- Create: `docs/library-backup.md`
- Modify only if terminology changes: `CONTEXT.md`

**Interfaces:**
- Consumes: the complete user-visible flow from Tasks 1–5.
- Produces: browser-level recovery evidence and user documentation; no new runtime interface.

- [ ] **Step 1: Add a desktop round-trip E2E test**

Seed the Local Library through its public UI with a book page, a same-titled second page, an empty book, an Unsorted page, and a bookmark. Capture the download:

```ts
const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "Back up library" }).click();
const download = await downloadPromise;
expect(download.suggestedFilename()).toMatch(/^mdez-library-\d{4}-\d{2}-\d{2}\.mdez\.zip$/);
const backupPath = await download.path();
expect(backupPath).not.toBeNull();
```

Keep the original library, select the downloaded file in `Restore backup`, and assert preview counts and `(<name> restored)` rename copy before confirming. Reload after restore and assert both original and restored books/pages exist and the restored bookmark is visible.

- [ ] **Step 2: Add zero-write and workspace-scope E2E cases**

Create a corrupt `.mdez.zip` fixture in the test with JSZip by altering a Markdown file after manifest creation. Select it and assert the damaged-content message, disabled confirmation, and unchanged book/page counts after reload.

Add a Key Group scenario using the existing route fixtures: open Import from the group, restore a valid local backup, assert the app switches to `Local Library`, restored content appears there, and the Key Group snapshot remains unchanged.

- [ ] **Step 3: Add mobile layout and keyboard coverage**

In the mobile project, assert four Shelf actions render as two rows without document-level horizontal overflow. Open Import, use End/Home and ArrowLeft/ArrowRight across all four tabs, upload a backup, and confirm the preview and footer button remain visible and keyboard reachable at Pixel 7 dimensions.

- [ ] **Step 4: Run the targeted E2E flows**

Run:

```sh
npm run test:e2e -- tests/e2e/mdez.spec.ts -g "library backup|Restore backup|corrupt backup|Key Group restore"
```

Expected: PASS in Chromium desktop and mobile projects.

- [ ] **Step 5: Update product and recovery documentation**

Update `README.md` so the quick-start and data-storage sections state that page/book exports are partial, while `Back up library` creates the complete restorable Local Library archive. State that the archive is plaintext and should be stored accordingly.

Update `PRODUCT.md` under Export & Portability to require versioned full-library backup, validated preview, additive restore, bookmark preservation, and exclusion of Key Groups/Shared Links.

Create `docs/library-backup.md` with these concrete sections:

1. `Create a complete backup` — Local Library requirement and download steps.
2. `What the archive contains` — books/pages/bookmarks/public GitHub provenance and excluded secrets/state.
3. `Restore safely` — validation, preview, additive semantics, renamed books, detached duplicate sources, and atomicity.
4. `Limits and compatibility` — 100 MiB/10,000/20 MiB/250 MiB, schema 1, plaintext, and newer-version guidance.
5. `Troubleshooting` — unreadable, invalid ZIP, unsupported, unsafe, damaged, oversized, stale preview, and write failure outcomes.

Do not change `CONTEXT.md` unless implementation introduces a user-facing term beyond the already canonical `Local Library`, `book`, `page`, and `Unsorted pages`.

- [ ] **Step 6: Run all required verification**

Run in order and inspect every exit code/output:

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
git status --short --branch
```

Expected: every command exits `0`; status contains only task-owned changes before the documentation commit.

- [ ] **Step 7: Commit E2E evidence and documentation**

```sh
git add tests/e2e/mdez.spec.ts README.md PRODUCT.md docs/library-backup.md CONTEXT.md
git commit -m "docs: publish library backup recovery flow"
```

If `CONTEXT.md` did not change, omit it from `git add`.

- [ ] **Step 8: Complete repository handoff without integrating main**

Fetch `origin`, report whether the branch is behind `origin/main`, push `codex/full-library-backup-restore` with its own upstream, and open a pull request targeting `main`. Use a draft PR if any required check is unavailable or failing; otherwise mark it ready for review. Attach the PR to the task. Do not merge, enable auto-merge, delete the branch, or modify local/remote `main`; the user merges manually.
