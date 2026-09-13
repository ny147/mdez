import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sql } from "postgres";

import { ensureKeyGroupSchema, openTestDatabase } from "./support/postgres";

const migration = readFileSync("supabase/migrations/202609110001_flat_books.sql", "utf8");

describe("flat shared-book migration", () => {
  let sql: Sql;
  beforeAll(async () => {
    sql = openTestDatabase();
    await ensureKeyGroupSchema(sql);
  });
  afterAll(async () => { await sql?.end(); });

  it("preserves duplicate root names and allocates bounded nested names atomically", async () => {
    await sql.begin(async (tx) => {
      const groupId = "00000000-0000-4000-8000-000000000001";
      await tx`insert into public.key_groups (id, name, key_digest) values (${groupId}, 'Test', decode('00', 'hex'))`;
      await tx`insert into public.group_folders (id, group_id, parent_id, name, sort_order, group_revision) values
        ('00000000-0000-4000-8000-000000000011', ${groupId}, null, 'Notes', 0, 0),
        ('00000000-0000-4000-8000-000000000012', ${groupId}, null, 'Notes', 1, 0),
        ('00000000-0000-4000-8000-000000000013', ${groupId}, null, 'Notes / Ideas (2)', 2, 0),
        ('00000000-0000-4000-8000-000000000014', ${groupId}, '00000000-0000-4000-8000-000000000011', ${"x".repeat(300)}, 3, 0)`;
      await tx.unsafe(migration);
      const rows = await tx<{ name: string; parent_id: string | null }[]>`select name, parent_id from public.group_folders where group_id = ${groupId} order by sort_order`;
      expect(rows.slice(0, 2).map((row) => row.name)).toEqual(["Notes", "Notes"]);
      expect(rows.every((row) => row.parent_id === null)).toBe(true);
      expect(Array.from(rows[3].name).length).toBeLessThanOrEqual(300);
      throw new Error("ROLLBACK_TEST_FIXTURE");
    }).catch((error) => {
      if (!(error instanceof Error) || error.message !== "ROLLBACK_TEST_FIXTURE") throw error;
    });
  });
});
