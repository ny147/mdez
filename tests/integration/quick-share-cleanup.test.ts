import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sql } from "postgres";

import { PostgresQuickShareStore } from "@/server/quick-shares/postgres-store";
import { ensureQuickShareSchema, openTestDatabase } from "./support/postgres";

const PUBLIC_IDS = [
  "cleanup-past-000000001",
  "cleanup-equal-00000001",
  "cleanup-future-0000001",
  "cleanup-never-00000001"
];

describe("Quick Share cleanup", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = openTestDatabase();
    await ensureQuickShareSchema(sql);
  });

  afterAll(async () => {
    if (sql) {
      await sql`delete from public.quick_shares where public_id in ${sql(PUBLIC_IDS)}`;
      await sql.end();
    }
  });

  it("deletes past and exact-deadline rows idempotently", async () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    await sql`delete from public.quick_shares where public_id in ${sql(PUBLIC_IDS)}`;
    for (const [publicId, expiresAt] of [
      [PUBLIC_IDS[0], new Date("2026-09-14T23:59:59.999Z")],
      [PUBLIC_IDS[1], now],
      [PUBLIC_IDS[2], new Date("2026-09-15T00:00:00.001Z")],
      [PUBLIC_IDS[3], null]
    ] as const) {
      await sql`
        insert into public.quick_shares
          (public_id, management_token_digest, title, markdown, size_bytes, created_at, expires_at)
        values
          (${publicId}, ${Buffer.alloc(32)}, 'Cleanup fixture', '# fixture', 9, ${now}, ${expiresAt})
      `;
    }

    const store = new PostgresQuickShareStore(sql);
    await expect(store.purgeExpired(now)).resolves.toBe(2);
    await expect(store.purgeExpired(now)).resolves.toBe(0);

    const remaining = await sql<{ public_id: string }[]>`
      select public_id from public.quick_shares
      where public_id in ${sql(PUBLIC_IDS)}
      order by public_id
    `;
    expect(remaining.map((row) => row.public_id).sort()).toEqual([
      PUBLIC_IDS[2],
      PUBLIC_IDS[3]
    ].sort());
  });
});
