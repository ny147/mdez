import { readFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertDistinctLocalTestDatabaseUrls } from "./support/postgres";

const migrations = [
  "supabase/migrations/202608090001_quick_shares.sql",
  "supabase/migrations/202608090002_key_groups.sql",
  "supabase/migrations/202609110001_flat_books.sql"
];

function chainDatabaseUrl(): string {
  const value = process.env.MDEZ_CHAIN_DATABASE_URL;
  if (!value) throw new Error("MDEZ_CHAIN_DATABASE_URL is required for the fresh migration-chain test.");

  const url = new URL(value);
  const database = url.pathname.slice(1);
  if (!database.endsWith("_test")) {
    throw new Error("MDEZ_CHAIN_DATABASE_URL must name a dedicated database ending in _test.");
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("MDEZ_CHAIN_DATABASE_URL must use localhost or 127.0.0.1.");
  }
  const primaryValue = process.env.MDEZ_TEST_DATABASE_URL;
  assertDistinctLocalTestDatabaseUrls(value, primaryValue);
  return value;
}

describe("fresh migration chain", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = postgres(chainDatabaseUrl(), { max: 1, prepare: false });
    for (const file of migrations) {
      await sql.unsafe(readFileSync(file, "utf8"));
    }
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("creates every sharing table with row-level security and no browser-role privileges", async () => {
    const tables = ["quick_shares", "key_groups", "group_folders", "group_documents"];
    const rows = await sql<{ name: string | null }[]>`
      select to_regclass('public.quick_shares')::text as name
      union all select to_regclass('public.key_groups')::text
      union all select to_regclass('public.group_folders')::text
      union all select to_regclass('public.group_documents')::text
    `;
    expect(rows.every((row) => row.name !== null)).toBe(true);

    const security = await sql<{ table_name: string; rls_enabled: boolean }[]>`
      select relname as table_name, relrowsecurity as rls_enabled
      from pg_class
      where oid = any(${tables.map((table) => `public.${table}`)}::regclass[])
      order by relname
    `;
    expect(security).toHaveLength(tables.length);
    expect(security.every((table) => table.rls_enabled)).toBe(true);

    const privileges = await sql<{ role_name: string; table_name: string; has_privilege: boolean }[]>`
      select role_name, table_name,
        has_table_privilege(role_name, 'public.' || table_name,
          'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as has_privilege
      from unnest(array['anon', 'authenticated']) as role_name
      cross join unnest(${tables}::text[]) as table_name
    `;
    expect(privileges).toHaveLength(8);
    expect(privileges.every((entry) => !entry.has_privilege)).toBe(true);
  });

  it("rejects nested books after the flat-books migration", async () => {
    const groupId = "00000000-0000-4000-8000-000000000201";
    const parentId = "00000000-0000-4000-8000-000000000202";
    const childId = "00000000-0000-4000-8000-000000000203";
    await sql`insert into public.key_groups (id, name, key_digest) values (${groupId}, 'Chain test', decode('21', 'hex'))`;
    await sql`insert into public.group_folders (id, group_id, parent_id, name, sort_order, group_revision) values
      (${parentId}, ${groupId}, null, 'Parent', 0, 0),
      (${childId}, ${groupId}, null, 'Child', 1, 0)`;

    await expect(sql`update public.group_folders set parent_id = ${parentId} where id = ${childId}`)
      .rejects.toMatchObject({ code: "23514" });
  });
});
