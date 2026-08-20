# Mdez Quick Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user publish the currently selected Markdown page as an unlisted, view-only link with creator-selected expiry and creator-only deletion.

**Architecture:** The browser sends one title/body snapshot to a Next.js route handler. Server-only services validate and rate-limit the request, create opaque identifiers, HMAC the management token, and store readable Markdown in Supabase Postgres through its transaction pooler; the public reader fetches only by public ID. The creator keeps the raw management token in IndexedDB so shared links can be listed and deleted without an account.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `postgres`, Supabase Postgres, Dexie/IndexedDB, React Markdown, Vitest, Testing Library, Playwright, Vercel Cron

## Global Constraints

- Execute this plan in a fresh worktree and `codex/quick-share` branch created from the latest `origin/main`; do not implement it on the current historical feature branch.
- The approved design is `docs/superpowers/specs/2026-08-09-mdez-quick-share-key-groups-design.md`; Quick Share must be production-verified before Key Groups starts.
- Quick Share publishes exactly one immutable title/Markdown snapshot and is view-only for everyone opening the link.
- Expiry choices are `1h`, `1d`, `7d`, `30d`, and `never`; default to `7d`.
- Store Markdown as readable Postgres text. Use at least 128 random bits for both public IDs and management tokens; store only an HMAC-SHA-256 management-token digest.
- Limit a page body to 5 MiB measured as UTF-8 bytes. Return `404` for unknown links, `410` for expired links, and `403` for an invalid management token.
- A creator can delete a share before expiry only while its locally stored management token remains available. Anyone with the public URL can read until deletion or expiry.
- Never put management tokens in URLs, database rows, analytics, or logs. Never log request bodies or Markdown.
- Use parameterized SQL, keep raw HTML disabled in Markdown rendering, and return `Cache-Control: no-store` for public share reads.
- Enforce 20 Quick Share creates per IP per hour and 120 public reads per public-ID/IP pair per minute. HMAC network identifiers with `RATE_LIMIT_PEPPER`; never persist raw IP addresses.
- Required server variables are `SUPABASE_DATABASE_URL`, `MANAGEMENT_TOKEN_PEPPER`, `RATE_LIMIT_PEPPER`, and `CRON_SECRET`; none may use the `NEXT_PUBLIC_` prefix.
- Preserve all existing Local Library behavior, accessibility targets, desktop/mobile layouts, GitHub import, export, and IndexedDB data.

---

## File Map

| Responsibility | File |
|---|---|
| Postgres connection and environment checks | `src/server/database.ts` |
| Database schema | `supabase/migrations/202608090001_quick_shares.sql` |
| Shared rate-limit storage | `src/server/rate-limit.ts` |
| Public domain types and expiry helpers | `src/types/quick-share.ts`, `src/lib/quick-share.ts` |
| Server token generation and HMAC | `src/server/quick-shares/secrets.ts` |
| Persistence boundary | `src/server/quick-shares/store.ts`, `src/server/quick-shares/postgres-store.ts` |
| Use-case orchestration | `src/server/quick-shares/service.ts` |
| HTTP endpoints | `src/app/api/quick-shares/route.ts`, `src/app/api/quick-shares/[publicId]/route.ts`, `src/app/api/cron/quick-shares/route.ts` |
| Browser API and IndexedDB ownership data | `src/lib/quick-share-client.ts`, `src/lib/db.ts`, `src/lib/shared-link-repository.ts` |
| Editor and management UI | `src/components/mdez/QuickShareDialog.tsx`, `src/components/mdez/SharedLinksDialog.tsx`, `src/components/mdez/MdezWorkspace.tsx` |
| Public reader | `src/app/share/[publicId]/page.tsx`, `src/components/mdez/PublicSharedPage.tsx`, `src/components/mdez/MarkdownReader.tsx` |
| Unit and browser coverage | `tests/unit/quick-share*.test.ts(x)`, `tests/e2e/quick-share.spec.ts` |

### Task 1: Add the server database boundary and Quick Share schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.env.example`
- Create: `src/server/database.ts`
- Create: `supabase/migrations/202608090001_quick_shares.sql`
- Create: `tests/unit/quick-share-schema.test.ts`

**Interfaces:**
- Consumes: `process.env.SUPABASE_DATABASE_URL: string | undefined`.
- Produces: `getDatabase(): Sql`, `closeDatabaseForTests(): Promise<void>`, tables `quick_shares` and `rate_limit_buckets`.

- [ ] **Step 1: Install the pooled Postgres client**

Run: `npm install postgres`

Expected: `postgres` appears in `dependencies` and the lockfile changes.

- [ ] **Step 2: Write the failing schema and connection tests**

```ts
// tests/unit/quick-share-schema.test.ts
import { readFileSync } from "node:fs";

describe("Quick Share database boundary", () => {
  it("defines private share and rate-limit tables", () => {
    const sql = readFileSync("supabase/migrations/202608090001_quick_shares.sql", "utf8");
    expect(sql).toContain("create table public.quick_shares");
    expect(sql).toContain("management_token_digest bytea not null");
    expect(sql).toContain("markdown text not null");
    expect(sql).toContain("alter table public.quick_shares enable row level security");
    expect(sql).toContain("create table public.rate_limit_buckets");
  });

  it("rejects a missing pooled database URL", async () => {
    vi.resetModules();
    delete process.env.SUPABASE_DATABASE_URL;
    const { getDatabase } = await import("@/server/database");
    expect(() => getDatabase()).toThrow("SUPABASE_DATABASE_URL is required");
  });
});
```

- [ ] **Step 3: Run the test and confirm the missing modules fail**

Run: `npm test -- --run tests/unit/quick-share-schema.test.ts`

Expected: FAIL because the migration and `@/server/database` do not exist.

- [ ] **Step 4: Add the environment contract and lazy database connection**

```dotenv
# .env.example
SUPABASE_DATABASE_URL=postgres://postgres.PROJECT_REF:PASSWORD@POOLER_HOST:6543/postgres
MANAGEMENT_TOKEN_PEPPER=replace-with-at-least-32-random-bytes
RATE_LIMIT_PEPPER=replace-with-a-different-at-least-32-byte-secret
CRON_SECRET=replace-with-an-independent-random-secret
```

```ts
// src/server/database.ts
import "server-only";
import postgres, { type Sql } from "postgres";

let database: Sql | null = null;

export function getDatabase(): Sql {
  const url = process.env.SUPABASE_DATABASE_URL;
  if (!url) throw new Error("SUPABASE_DATABASE_URL is required");
  database ??= postgres(url, { prepare: false, max: 3, idle_timeout: 20 });
  return database;
}

export async function closeDatabaseForTests(): Promise<void> {
  if (!database) return;
  await database.end({ timeout: 1 });
  database = null;
}
```

- [ ] **Step 5: Add the exact migration**

```sql
-- supabase/migrations/202608090001_quick_shares.sql
create table public.quick_shares (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (char_length(public_id) between 22 and 64),
  management_token_digest bytea not null,
  title text not null check (char_length(title) between 1 and 300),
  markdown text not null,
  size_bytes integer not null check (size_bytes between 0 and 5242880),
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index quick_shares_expires_at_idx
  on public.quick_shares (expires_at)
  where expires_at is not null;

create table public.rate_limit_buckets (
  bucket_key bytea primary key,
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null,
  expires_at timestamptz not null
);

create index rate_limit_buckets_expires_at_idx on public.rate_limit_buckets (expires_at);

alter table public.quick_shares enable row level security;
alter table public.rate_limit_buckets enable row level security;
revoke all on public.quick_shares from anon, authenticated;
revoke all on public.rate_limit_buckets from anon, authenticated;
```

- [ ] **Step 6: Run the focused checks**

Run: `npm test -- --run tests/unit/quick-share-schema.test.ts`

Expected: 2 tests PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the database foundation**

```bash
git add package.json package-lock.json .env.example src/server/database.ts supabase/migrations/202608090001_quick_shares.sql tests/unit/quick-share-schema.test.ts
git commit -m "feat: add quick share database foundation"
```

### Task 2: Define expiry, validation, identifiers, and token digests

**Files:**
- Create: `src/types/quick-share.ts`
- Create: `src/lib/quick-share.ts`
- Create: `src/server/quick-shares/secrets.ts`
- Create: `tests/unit/quick-share-domain.test.ts`

**Interfaces:**
- Consumes: `MANAGEMENT_TOKEN_PEPPER` and UTF-8 title/body input.
- Produces: `QuickShareExpiry`, `CreateQuickShareInput`, `QuickSharePayload`, `expiryDate()`, `validateQuickShareInput()`, `createOpaqueSecret()`, and `digestManagementToken()`.

- [ ] **Step 1: Write failing domain tests**

```ts
// tests/unit/quick-share-domain.test.ts
import { expiryDate, validateQuickShareInput } from "@/lib/quick-share";
import { createOpaqueSecret, digestManagementToken } from "@/server/quick-shares/secrets";

describe("Quick Share domain", () => {
  const now = new Date("2026-08-09T00:00:00.000Z");

  it.each([
    ["1h", "2026-08-09T01:00:00.000Z"],
    ["1d", "2026-08-10T00:00:00.000Z"],
    ["7d", "2026-08-16T00:00:00.000Z"],
    ["30d", "2026-09-08T00:00:00.000Z"]
  ] as const)("maps %s to an absolute expiry", (choice, expected) => {
    expect(expiryDate(choice, now)?.toISOString()).toBe(expected);
  });

  it("maps never to null", () => expect(expiryDate("never", now)).toBeNull());

  it("rejects Markdown above five MiB", () => {
    expect(() => validateQuickShareInput({ title: "Large", markdown: "x".repeat(5 * 1024 * 1024 + 1), expiry: "7d" }))
      .toThrow("Markdown must be 5 MiB or smaller");
  });

  it("creates 128-bit-or-stronger opaque secrets and stable HMAC digests", () => {
    process.env.MANAGEMENT_TOKEN_PEPPER = "a".repeat(32);
    const token = createOpaqueSecret();
    expect(Buffer.from(token, "base64url").byteLength).toBeGreaterThanOrEqual(16);
    expect(digestManagementToken(token)).toEqual(digestManagementToken(token));
    expect(digestManagementToken(token)).toHaveLength(32);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing exports fail**

Run: `npm test -- --run tests/unit/quick-share-domain.test.ts`

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 3: Add public types and pure validation**

```ts
// src/types/quick-share.ts
export type QuickShareExpiry = "1h" | "1d" | "7d" | "30d" | "never";

export type CreateQuickShareInput = {
  title: string;
  markdown: string;
  expiry: QuickShareExpiry;
};

export type QuickSharePayload = {
  publicId: string;
  title: string;
  markdown: string;
  createdAt: string;
  expiresAt: string | null;
};

export type CreateQuickShareResult = QuickSharePayload & {
  url: string;
  managementToken: string;
};
```

```ts
// src/lib/quick-share.ts
import type { CreateQuickShareInput, QuickShareExpiry } from "@/types/quick-share";

const durations: Record<Exclude<QuickShareExpiry, "never">, number> = {
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};

export function expiryDate(expiry: QuickShareExpiry, now = new Date()): Date | null {
  return expiry === "never" ? null : new Date(now.getTime() + durations[expiry]);
}

export function validateQuickShareInput(value: unknown): CreateQuickShareInput {
  if (!value || typeof value !== "object") throw new Error("A share payload is required");
  const input = value as Partial<CreateQuickShareInput>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 300) throw new Error("Title must contain 1 to 300 characters");
  if (typeof input.markdown !== "string") throw new Error("Markdown must be text");
  if (new TextEncoder().encode(input.markdown).byteLength > 5 * 1024 * 1024) {
    throw new Error("Markdown must be 5 MiB or smaller");
  }
  if (!(["1h", "1d", "7d", "30d", "never"] as const).includes(input.expiry as QuickShareExpiry)) {
    throw new Error("Choose a valid expiry");
  }
  return { title, markdown: input.markdown, expiry: input.expiry as QuickShareExpiry };
}
```

- [ ] **Step 4: Add server-only opaque-secret and HMAC helpers**

```ts
// src/server/quick-shares/secrets.ts
import "server-only";
import { createHmac, randomBytes } from "node:crypto";

export function createOpaqueSecret(): string {
  return randomBytes(16).toString("base64url");
}

export function digestManagementToken(token: string): Buffer {
  const pepper = process.env.MANAGEMENT_TOKEN_PEPPER;
  if (!pepper || Buffer.byteLength(pepper) < 32) {
    throw new Error("MANAGEMENT_TOKEN_PEPPER must contain at least 32 bytes");
  }
  return createHmac("sha256", pepper).update(token, "utf8").digest();
}
```

- [ ] **Step 5: Run domain tests and typecheck**

Run: `npm test -- --run tests/unit/quick-share-domain.test.ts`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the domain layer**

```bash
git add src/types/quick-share.ts src/lib/quick-share.ts src/server/quick-shares/secrets.ts tests/unit/quick-share-domain.test.ts
git commit -m "feat: define quick share domain rules"
```

### Task 3: Implement persistence, expiry decisions, and durable rate limits

**Files:**
- Create: `src/server/quick-shares/store.ts`
- Create: `src/server/quick-shares/postgres-store.ts`
- Create: `src/server/quick-shares/service.ts`
- Create: `src/server/rate-limit.ts`
- Create: `tests/unit/quick-share-service.test.ts`

**Interfaces:**
- Consumes: `getDatabase(): Sql`, `expiryDate()`, `createOpaqueSecret()`, and `digestManagementToken()`.
- Produces: `QuickShareStore`, `createQuickShareService()`, `readQuickShareService()`, `deleteQuickShareService()`, `purgeExpiredQuickShares()`, `consumeRateLimit()`.

- [ ] **Step 1: Write failing service tests against an in-memory port**

```ts
// tests/unit/quick-share-service.test.ts
import { createQuickShareService, deleteQuickShareService, readQuickShareService } from "@/server/quick-shares/service";
import type { QuickShareRecord, QuickShareStore } from "@/server/quick-shares/store";

function memoryStore(): QuickShareStore & { rows: Map<string, QuickShareRecord> } {
  const rows = new Map<string, QuickShareRecord>();
  return {
    rows,
    insert: async (row) => { rows.set(row.publicId, row); return row; },
    findByPublicId: async (id) => rows.get(id) ?? null,
    deleteByPublicIdAndDigest: async (id, digest) => {
      const row = rows.get(id);
      if (!row) return "not_found";
      if (!row.managementTokenDigest.equals(digest)) return "forbidden";
      rows.delete(id); return "deleted";
    },
    purgeExpired: async () => 0
  };
}

it("creates an immutable snapshot and returns the raw management token once", async () => {
  process.env.MANAGEMENT_TOKEN_PEPPER = "p".repeat(32);
  const store = memoryStore();
  const result = await createQuickShareService(
    { title: "Guide", markdown: "# Hello", expiry: "7d" },
    { store, now: () => new Date("2026-08-09T00:00:00Z"), origin: "https://mdez.app" }
  );
  expect(result.url).toBe(`https://mdez.app/share/${result.publicId}`);
  expect(store.rows.get(result.publicId)?.markdown).toBe("# Hello");
  expect(store.rows.get(result.publicId)?.managementTokenDigest).toHaveLength(32);
});

it("returns expired instead of the Markdown", async () => {
  const store = memoryStore();
  store.rows.set("gone", {
    publicId: "gone", managementTokenDigest: Buffer.alloc(32), title: "Gone", markdown: "secret",
    sizeBytes: 6, createdAt: new Date("2026-08-01Z"), expiresAt: new Date("2026-08-02Z")
  });
  await expect(readQuickShareService("gone", { store, now: () => new Date("2026-08-09Z") }))
    .rejects.toMatchObject({ code: "EXPIRED" });
});

it("requires the matching management token to delete", async () => {
  process.env.MANAGEMENT_TOKEN_PEPPER = "p".repeat(32);
  const store = memoryStore();
  const created = await createQuickShareService(
    { title: "Delete", markdown: "text", expiry: "never" },
    { store, now: () => new Date("2026-08-09Z"), origin: "https://mdez.app" }
  );
  await expect(deleteQuickShareService(created.publicId, "wrong", { store })).rejects.toMatchObject({ code: "FORBIDDEN" });
  await deleteQuickShareService(created.publicId, created.managementToken, { store });
  expect(store.rows.size).toBe(0);
});
```

- [ ] **Step 2: Run the service test and confirm missing services fail**

Run: `npm test -- --run tests/unit/quick-share-service.test.ts`

Expected: FAIL because the store and service modules do not exist.

- [ ] **Step 3: Define the persistence port and service errors**

```ts
// src/server/quick-shares/store.ts
export type QuickShareRecord = {
  publicId: string;
  managementTokenDigest: Buffer;
  title: string;
  markdown: string;
  sizeBytes: number;
  createdAt: Date;
  expiresAt: Date | null;
};

export interface QuickShareStore {
  insert(record: QuickShareRecord): Promise<QuickShareRecord>;
  findByPublicId(publicId: string): Promise<QuickShareRecord | null>;
  deleteByPublicIdAndDigest(publicId: string, digest: Buffer): Promise<"deleted" | "not_found" | "forbidden">;
  purgeExpired(now: Date): Promise<number>;
}

export class QuickShareError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "EXPIRED" | "FORBIDDEN", message: string) { super(message); }
}
```

- [ ] **Step 4: Implement the service with dependency injection**

```ts
// src/server/quick-shares/service.ts
import { expiryDate, validateQuickShareInput } from "@/lib/quick-share";
import type { CreateQuickShareResult, QuickSharePayload } from "@/types/quick-share";
import { createOpaqueSecret, digestManagementToken } from "./secrets";
import { QuickShareError, type QuickShareStore } from "./store";

export async function createQuickShareService(input: unknown, deps: { store: QuickShareStore; now: () => Date; origin: string }): Promise<CreateQuickShareResult> {
  const valid = validateQuickShareInput(input);
  const publicId = createOpaqueSecret();
  const managementToken = createOpaqueSecret();
  const createdAt = deps.now();
  const record = await deps.store.insert({
    publicId, managementTokenDigest: digestManagementToken(managementToken), title: valid.title,
    markdown: valid.markdown, sizeBytes: new TextEncoder().encode(valid.markdown).byteLength,
    createdAt, expiresAt: expiryDate(valid.expiry, createdAt)
  });
  return { publicId, managementToken, url: `${deps.origin}/share/${publicId}`, title: record.title,
    markdown: record.markdown, createdAt: record.createdAt.toISOString(), expiresAt: record.expiresAt?.toISOString() ?? null };
}

export async function readQuickShareService(publicId: string, deps: { store: QuickShareStore; now: () => Date }): Promise<QuickSharePayload> {
  const row = await deps.store.findByPublicId(publicId);
  if (!row) throw new QuickShareError("NOT_FOUND", "Shared page not found");
  if (row.expiresAt && row.expiresAt <= deps.now()) throw new QuickShareError("EXPIRED", "Shared page expired");
  return { publicId: row.publicId, title: row.title, markdown: row.markdown,
    createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null };
}

export async function deleteQuickShareService(publicId: string, token: string, deps: { store: QuickShareStore }): Promise<void> {
  if (!token) throw new QuickShareError("FORBIDDEN", "Management token is invalid");
  const result = await deps.store.deleteByPublicIdAndDigest(publicId, digestManagementToken(token));
  if (result === "not_found") throw new QuickShareError("NOT_FOUND", "Shared page not found");
  if (result === "forbidden") throw new QuickShareError("FORBIDDEN", "Management token is invalid");
}

export function purgeExpiredQuickShares(now: Date, store: QuickShareStore): Promise<number> { return store.purgeExpired(now); }
```

- [ ] **Step 5: Implement parameterized Postgres queries and the atomic rate bucket**

Implement `PostgresQuickShareStore` with `sql` tagged-template queries for insert/read/delete/purge. Use `timingSafeEqual` after retrieving the stored digest, then delete by `public_id`; this avoids digest-comparison timing leakage. Implement:

```ts
export class PostgresQuickShareStore implements QuickShareStore {
  constructor(private readonly sql: Sql) {}
  insert(record: QuickShareRecord): Promise<QuickShareRecord>;
  findByPublicId(publicId: string): Promise<QuickShareRecord | null>;
  deleteByPublicIdAndDigest(publicId: string, digest: Buffer): Promise<"deleted" | "not_found" | "forbidden">;
  purgeExpired(now: Date): Promise<number>;
}
```

```ts
// src/server/rate-limit.ts
export type RateLimitRule = { scope: string; identifier: string; limit: number; windowSeconds: number };
export type RateLimitDecision = { allowed: boolean; remaining: number; retryAfterSeconds: number };
export async function consumeRateLimit(rule: RateLimitRule, now = new Date()): Promise<RateLimitDecision>;
```

Hash `${scope}:${identifier}` with HMAC-SHA-256 and `RATE_LIMIT_PEPPER`. In one `insert ... on conflict ... do update` statement, reset a stale window or increment an active window, return its count and expiry, and delete expired buckets in the cron task. Never return or store `identifier`.

- [ ] **Step 6: Run service tests and static checks**

Run: `npm test -- --run tests/unit/quick-share-service.test.ts tests/unit/quick-share-schema.test.ts`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit persistence and services**

```bash
git add src/server/quick-shares src/server/rate-limit.ts tests/unit/quick-share-service.test.ts
git commit -m "feat: add quick share persistence services"
```

### Task 4: Expose create, read, delete, and cleanup HTTP routes

**Files:**
- Create: `src/app/api/quick-shares/route.ts`
- Create: `src/app/api/quick-shares/[publicId]/route.ts`
- Create: `src/app/api/cron/quick-shares/route.ts`
- Create: `src/server/request-address.ts`
- Create: `src/server/quick-shares/runtime.ts`
- Create: `tests/unit/quick-share-route.test.ts`

**Interfaces:**
- Consumes: Quick Share services, `PostgresQuickShareStore`, and `consumeRateLimit()`.
- Produces: `POST /api/quick-shares`, `GET|DELETE /api/quick-shares/:publicId`, and `GET /api/cron/quick-shares`.

- [ ] **Step 1: Write route tests with mocked service boundaries**

```ts
// tests/unit/quick-share-route.test.ts
vi.mock("@/server/quick-shares/runtime", () => ({
  createShare: vi.fn(), readShare: vi.fn(), deleteShare: vi.fn(), purgeShares: vi.fn()
}));

it("creates a share and never echoes a digest", async () => {
  const { createShare } = await import("@/server/quick-shares/runtime");
  vi.mocked(createShare).mockResolvedValue({ publicId: "public", managementToken: "private", url: "https://mdez.app/share/public", title: "T", markdown: "M", createdAt: "2026-08-09T00:00:00.000Z", expiresAt: null });
  const { POST } = await import("@/app/api/quick-shares/route");
  const response = await POST(new Request("https://mdez.app/api/quick-shares", { method: "POST", body: JSON.stringify({ title: "T", markdown: "M", expiry: "never" }) }));
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ managementToken: "private" });
});

it.each([["NOT_FOUND", 404], ["EXPIRED", 410]])("maps %s reads to %i", async (code, status) => {
  const { readShare } = await import("@/server/quick-shares/runtime");
  vi.mocked(readShare).mockRejectedValue(Object.assign(new Error(code), { code }));
  const { GET } = await import("@/app/api/quick-shares/[publicId]/route");
  const response = await GET(new Request("https://mdez.app/api/quick-shares/x"), { params: Promise.resolve({ publicId: "x" }) });
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
```

- [ ] **Step 2: Run the route tests and verify failure**

Run: `npm test -- --run tests/unit/quick-share-route.test.ts`

Expected: FAIL because the runtime and routes do not exist.

- [ ] **Step 3: Add a narrow runtime composition module and the routes**

Create `src/server/quick-shares/runtime.ts` beside the store files. It constructs `PostgresQuickShareStore(getDatabase())`, applies create/read rate limits, and exports:

```ts
export function createShare(input: unknown, context: { origin: string; address: string }): Promise<CreateQuickShareResult>;
export function readShare(publicId: string, address: string): Promise<QuickSharePayload>;
export function deleteShare(publicId: string, token: string): Promise<void>;
export function purgeShares(): Promise<{ shares: number; buckets: number }>;
```

Route behavior must be exact:

| Route | Success | Errors |
|---|---:|---|
| `POST /api/quick-shares` | `201` JSON result | `400` invalid body, `413` oversized, `429` rate-limited |
| `GET /api/quick-shares/:id` | `200` public payload + `no-store` | `404`, `410`, `429` |
| `DELETE /api/quick-shares/:id` | `204` | `403` invalid token, `404` unknown link |
| `GET /api/cron/quick-shares` | `200` deletion counts | `401` unless `Authorization: Bearer ${CRON_SECRET}` |

Extract the client address from the first `x-forwarded-for` value, falling back to `x-real-ip`, then `unknown`; pass it only to the HMAC rate limiter. Set `export const dynamic = "force-dynamic"` on read and cron routes.

- [ ] **Step 4: Run route and service tests**

Run: `npm test -- --run tests/unit/quick-share-route.test.ts tests/unit/quick-share-service.test.ts`

Expected: all tests PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit the HTTP boundary**

```bash
git add src/app/api/quick-shares src/app/api/cron/quick-shares src/server/request-address.ts src/server/quick-shares/runtime.ts tests/unit/quick-share-route.test.ts
git commit -m "feat: expose quick share api"
```

### Task 5: Persist creator-owned shared links in IndexedDB

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/lib/quick-share-client.ts`
- Create: `src/lib/shared-link-repository.ts`
- Create: `tests/unit/shared-link-repository.test.ts`

**Interfaces:**
- Consumes: `CreateQuickShareInput`, `CreateQuickShareResult`, and `DELETE /api/quick-shares/:publicId`.
- Produces: `StoredSharedLink`, `createQuickShare()`, `deleteQuickShare()`, `listSharedLinks()`, `rememberSharedLink()`, and `forgetSharedLink()`.

- [ ] **Step 1: Write the failing IndexedDB ownership test**

```ts
// tests/unit/shared-link-repository.test.ts
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { forgetSharedLink, listSharedLinks, rememberSharedLink } from "@/lib/shared-link-repository";

afterEach(() => db.delete());

it("keeps the management token only in the creator browser", async () => {
  await rememberSharedLink({ publicId: "abc", url: "https://mdez.app/share/abc", title: "Guide", managementToken: "private", createdAt: "2026-08-09T00:00:00Z", expiresAt: null });
  expect(await listSharedLinks()).toEqual([expect.objectContaining({ publicId: "abc", managementToken: "private" })]);
  await forgetSharedLink("abc");
  expect(await listSharedLinks()).toEqual([]);
});
```

- [ ] **Step 2: Run the test and verify the missing table fails**

Run: `npm test -- --run tests/unit/shared-link-repository.test.ts`

Expected: FAIL because `sharedLinks` and its repository do not exist.

- [ ] **Step 3: Extend Dexie without replacing existing stores**

Add this type and table to `src/lib/db.ts`, then create database version 3 with every version-2 store declaration unchanged plus `sharedLinks: "publicId, createdAt, expiresAt"`:

```ts
export type StoredSharedLink = {
  publicId: string;
  url: string;
  title: string;
  managementToken: string;
  createdAt: string;
  expiresAt: string | null;
};
```

Expose `sharedLinks!: EntityTable<StoredSharedLink, "publicId">`. Do not delete expired local rows automatically; keep them visible with an Expired label until the creator removes them.

- [ ] **Step 4: Implement browser API and repository functions**

```ts
// src/lib/quick-share-client.ts
export async function createQuickShare(input: CreateQuickShareInput): Promise<CreateQuickShareResult>;
export async function deleteQuickShare(publicId: string, managementToken: string): Promise<void>;
```

`createQuickShare` posts JSON and throws a user-safe message from `{ error: string }` on non-2xx. `deleteQuickShare` sends `x-mdez-management-token`, accepts `204`, and never places the token in the URL. The repository is a thin `db.sharedLinks.put/orderBy("createdAt").reverse()/delete` wrapper.

- [ ] **Step 5: Run IndexedDB, regression, and type checks**

Run: `npm test -- --run tests/unit/shared-link-repository.test.ts tests/unit/repository.test.ts tests/unit/useWorkspaceLibrary.test.tsx`

Expected: all tests PASS and existing library records survive the schema upgrade.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit browser ownership storage**

```bash
git add src/lib/db.ts src/lib/quick-share-client.ts src/lib/shared-link-repository.ts tests/unit/shared-link-repository.test.ts
git commit -m "feat: remember creator shared links"
```

### Task 6: Add the share and shared-link management UI

**Files:**
- Create: `src/components/mdez/QuickShareDialog.tsx`
- Create: `src/components/mdez/SharedLinksDialog.tsx`
- Modify: `src/components/mdez/MdezWorkspace.tsx`
- Modify: `src/components/mdez/EditorToolbar.tsx`
- Create: `tests/unit/quick-share-dialog.test.tsx`
- Create: `tests/unit/shared-links-dialog.test.tsx`

**Interfaces:**
- Consumes: the selected live document `{ title, body }`, `createQuickShare()`, and shared-link repository functions.
- Produces: `QuickShareDialog({ document, open, onClose })` and `SharedLinksDialog({ open, onClose })`.

- [ ] **Step 1: Write failing accessible-dialog tests**

```tsx
// tests/unit/quick-share-dialog.test.tsx
it("defaults to seven days and copies the returned public URL", async () => {
  const user = userEvent.setup();
  vi.mocked(createQuickShare).mockResolvedValue({ publicId: "abc", url: "https://mdez.app/share/abc", managementToken: "secret", title: "Guide", markdown: "# Guide", createdAt: "2026-08-09T00:00:00Z", expiresAt: "2026-08-16T00:00:00Z" });
  render(<QuickShareDialog open document={{ title: "Guide", body: "# Guide" }} onClose={vi.fn()} />);
  expect(screen.getByRole("combobox", { name: "Link expiration" })).toHaveValue("7d");
  await user.click(screen.getByRole("button", { name: "Create view-only link" }));
  expect(createQuickShare).toHaveBeenCalledWith({ title: "Guide", markdown: "# Guide", expiry: "7d" });
  expect(await screen.findByDisplayValue("https://mdez.app/share/abc")).toBeVisible();
});

// tests/unit/shared-links-dialog.test.tsx
it("deletes with the locally stored management token", async () => {
  vi.mocked(listSharedLinks).mockResolvedValue([{ publicId: "abc", url: "/share/abc", title: "Guide", managementToken: "secret", createdAt: "2026-08-09T00:00:00Z", expiresAt: null }]);
  const user = userEvent.setup();
  render(<SharedLinksDialog open onClose={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "Delete Guide shared link" }));
  await user.click(screen.getByRole("button", { name: "Delete link" }));
  expect(deleteQuickShare).toHaveBeenCalledWith("abc", "secret");
  expect(forgetSharedLink).toHaveBeenCalledWith("abc");
});
```

- [ ] **Step 2: Run tests and verify the components are missing**

Run: `npm test -- --run tests/unit/quick-share-dialog.test.tsx tests/unit/shared-links-dialog.test.tsx`

Expected: FAIL because both dialog components do not exist.

- [ ] **Step 3: Build the share dialog state machine**

Implement states `idle | creating | created | error`. The dialog contains title copy “Create view-only link”, the five expiry options in the approved order, “Anyone with this link can read this snapshot” disclosure, and a disabled submit button during creation. On success call `rememberSharedLink`, show a readonly URL field, copy button, expiry, “Changes to this page will not update this link,” and “Clearing browser data removes your ability to delete this link early.” Keep focus trapped, close on Escape, restore trigger focus, and meet 44px mobile target sizes.

```ts
type QuickShareDialogProps = { document: Pick<Document, "title" | "body">; open: boolean; onClose: () => void };
type QuickShareDialogState =
  | { status: "idle"; expiry: QuickShareExpiry }
  | { status: "creating"; expiry: QuickShareExpiry }
  | { status: "created"; result: CreateQuickShareResult }
  | { status: "error"; expiry: QuickShareExpiry; message: string };
```

- [ ] **Step 4: Build shared-link management and integrate both entry points**

`SharedLinksDialog` lists newest first with Open, Copy, and Delete. Require a confirmation before deletion, keep the row on network failure, and remove it only after the API succeeds. Label past expiries “Expired”; label null expiry “Never expires”.

```ts
type SharedLinksDialogProps = { open: boolean; onClose: () => void };
type PendingDeletion = { publicId: string; title: string } | null;
```

In `MdezWorkspace`, pass the selected item from `drafts.liveDocuments`, not the last persisted body. Add “Quick Share” to `EditorToolbar` document actions and “Shared links” to the existing workspace-level action area. Disable Quick Share when no document is selected. Do not change formatting-button behavior.

- [ ] **Step 5: Run component and workspace regression tests**

Run: `npm test -- --run tests/unit/quick-share-dialog.test.tsx tests/unit/shared-links-dialog.test.tsx tests/unit/production-readiness.test.tsx`

Expected: all tests PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit the creator UI**

```bash
git add src/components/mdez/QuickShareDialog.tsx src/components/mdez/SharedLinksDialog.tsx src/components/mdez/MdezWorkspace.tsx src/components/mdez/EditorToolbar.tsx tests/unit/quick-share-dialog.test.tsx tests/unit/shared-links-dialog.test.tsx
git commit -m "feat: add quick share creator controls"
```

### Task 7: Build the unlisted public reader

**Files:**
- Create: `src/components/mdez/MarkdownReader.tsx`
- Modify: `src/components/mdez/PreviewPane.tsx`
- Create: `src/components/mdez/PublicSharedPage.tsx`
- Create: `src/app/share/[publicId]/page.tsx`
- Create: `tests/unit/public-shared-page.test.tsx`

**Interfaces:**
- Consumes: `GET /api/quick-shares/:publicId` and existing safe React Markdown plugins/styles.
- Produces: `MarkdownReader({ title, markdown, showTableOfContents? })` and the `/share/:publicId` route.

- [ ] **Step 1: Write failing public reader tests**

```tsx
// tests/unit/public-shared-page.test.tsx
it("renders shared Markdown without editing controls or raw HTML", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ publicId: "abc", title: "Guide", markdown: "# Hello\n<script>alert(1)</script>", createdAt: "2026-08-09T00:00:00Z", expiresAt: null }), { status: 200 })));
  render(<PublicSharedPage publicId="abc" />);
  expect(await screen.findByRole("heading", { name: "Hello" })).toBeVisible();
  expect(document.querySelector("script")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});

it.each([[404, "Shared page not found"], [410, "This shared page has expired"]])("shows a terminal state for %i", async (status, message) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
  render(<PublicSharedPage publicId="abc" />);
  expect(await screen.findByText(message)).toBeVisible();
});
```

- [ ] **Step 2: Run the test and confirm the public reader is missing**

Run: `npm test -- --run tests/unit/public-shared-page.test.tsx`

Expected: FAIL because the reader modules do not exist.

- [ ] **Step 3: Extract one safe Markdown renderer from PreviewPane**

Move only the React Markdown rendering and heading-ID logic from `PreviewPane` into `MarkdownReader`. Keep the existing plugin list and omit `rehype-raw`; accept title/Markdown strings rather than a `Document`. Refactor `PreviewPane` to call it and prove its existing reader typography and table-of-contents tests remain unchanged.

- [ ] **Step 4: Implement the public fetch states and route shell**

`PublicSharedPage` must use an `AbortController`, request with `{ cache: "no-store" }`, and render `loading`, `ready`, `not-found`, `expired`, or `error`. The ready state contains Mdez branding, snapshot title, expiry text, and `MarkdownReader`; it contains no editor, import, local-library, management-token, or delete controls.

```tsx
// src/app/share/[publicId]/page.tsx
import type { Metadata } from "next";
import { PublicSharedPage } from "@/components/mdez/PublicSharedPage";

export const metadata: Metadata = {
  title: "Shared page · Mdez",
  robots: { index: false, follow: false }
};

export default async function SharePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <PublicSharedPage publicId={publicId} />;
}
```

- [ ] **Step 5: Run public and existing preview tests**

Run: `npm test -- --run tests/unit/public-shared-page.test.tsx tests/unit/markdown.test.ts tests/unit/headings.test.ts tests/unit/production-readiness.test.tsx`

Expected: all tests PASS and no raw HTML executes.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the public reader**

```bash
git add src/components/mdez/MarkdownReader.tsx src/components/mdez/PreviewPane.tsx src/components/mdez/PublicSharedPage.tsx src/app/share/[publicId]/page.tsx tests/unit/public-shared-page.test.tsx
git commit -m "feat: add view only shared page reader"
```

### Task 8: Add browser journeys, Vercel cleanup, and production gates

**Files:**
- Create: `tests/e2e/quick-share.spec.ts`
- Create: `vercel.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: creator UI, public reader, all Quick Share endpoints, and Vercel cron authorization.
- Produces: an independently deployable Quick Share release and its operational instructions.

- [ ] **Step 1: Write failing desktop/mobile journeys**

```ts
// tests/e2e/quick-share.spec.ts
test("creates, opens, and deletes a view-only snapshot", async ({ page, context }) => {
  await page.route("**/api/quick-shares", route => route.request().method() === "POST"
    ? route.fulfill({ status: 201, json: { publicId: "share-1", url: `${new URL(route.request().url()).origin}/share/share-1`, managementToken: "owner-token", title: "Welcome", markdown: "# Shared snapshot", createdAt: new Date().toISOString(), expiresAt: null } })
    : route.continue());
  await page.route("**/api/quick-shares/share-1", route => route.request().method() === "GET"
    ? route.fulfill({ status: 200, json: { publicId: "share-1", title: "Welcome", markdown: "# Shared snapshot", createdAt: new Date().toISOString(), expiresAt: null } })
    : route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.getByRole("button", { name: "Quick Share" }).click();
  await page.getByRole("button", { name: "Create view-only link" }).click();
  const shared = await context.newPage();
  await shared.goto("/share/share-1");
  await expect(shared.getByRole("heading", { name: "Shared snapshot" })).toBeVisible();
  await expect(shared.getByRole("textbox")).toHaveCount(0);
});
```

Add separate tests for default `7d`, `410` expired, `404` unknown, failed delete retaining its local row, and a 5 MiB rejection. The existing Playwright desktop and mobile projects must both execute the file.

- [ ] **Step 2: Run the browser file and confirm the unimplemented expectations fail**

Run: `npm run test:e2e -- tests/e2e/quick-share.spec.ts`

Expected: FAIL until all creator and public-reader selectors/behaviors are connected.

- [ ] **Step 3: Configure daily idempotent cleanup and document operations**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/quick-shares", "schedule": "17 3 * * *" }]
}
```

Document in `README.md`: applying the Supabase migration, copying the transaction-pooler URL, setting the four server-only variables in Preview and Production, redeploying after variables change, manually invoking the cron with its bearer secret, and confirming expired rows disappear. State clearly that Supabase contains readable Markdown and token HMACs, not raw management tokens.

- [ ] **Step 4: Run the browser journey until it passes**

Run: `npm run test:e2e -- tests/e2e/quick-share.spec.ts`

Expected: all Quick Share tests PASS in desktop and mobile projects.

- [ ] **Step 5: Run the full local release gate**

Run: `npm test`

Expected: all unit tests PASS.

Run: `npm run lint`

Expected: PASS with no warnings treated as errors.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: production build PASS and includes `/share/[publicId]`, `/api/quick-shares`, and the cleanup route.

Run: `npm run test:e2e`

Expected: the full desktop/mobile suite PASS.

- [ ] **Step 6: Commit release coverage and configuration**

```bash
git add tests/e2e/quick-share.spec.ts vercel.json README.md
git commit -m "test: verify quick share release flow"
```

- [ ] **Step 7: Deploy and perform the production smoke test**

Apply the migration, set Preview variables, deploy the feature branch, and verify: create with each expiry option; open the link in a signed-out browser; edit the source and confirm the snapshot does not change; delete from the creator browser; verify the public URL stops returning content. Merge only after Preview passes. Then set Production variables, deploy `main`, repeat create/open/delete, and inspect Vercel logs to confirm no Markdown or secrets appear.

Expected: Quick Share is independently usable in production; only then begin `docs/superpowers/plans/2026-08-09-mdez-key-groups.md`.

Rollback: promote the previous verified Vercel deployment and stop the Quick Share cron. Leave migration 001 tables in place so existing links can be recovered by redeploying the fixed release; do not drop share rows or rotate `MANAGEMENT_TOKEN_PEPPER` during rollback.
