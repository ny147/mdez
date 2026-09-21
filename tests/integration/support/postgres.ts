import postgres, { type Sql } from "postgres";
import { readFileSync } from "node:fs";

function localDatabaseIdentity(value: string): string | null {
  const url = new URL(value);
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
  return `loopback:${url.port || "5432"}${url.pathname}`;
}

export function assertDistinctLocalTestDatabaseUrls(chainValue: string, primaryValue?: string): void {
  if (!primaryValue) return;
  const chainIdentity = localDatabaseIdentity(chainValue);
  const primaryIdentity = localDatabaseIdentity(primaryValue);
  if (chainIdentity !== null && chainIdentity === primaryIdentity) {
    throw new Error("MDEZ_CHAIN_DATABASE_URL must differ from MDEZ_TEST_DATABASE_URL.");
  }
}

export function testDatabaseUrl(): string {
  const value = process.env.MDEZ_TEST_DATABASE_URL;
  if (!value) throw new Error("MDEZ_TEST_DATABASE_URL is required for PostgreSQL integration tests.");
  const database = new URL(value).pathname.slice(1);
  if (!database.endsWith("_test")) throw new Error("MDEZ_TEST_DATABASE_URL must name a dedicated database ending in _test.");
  return value;
}

export function openTestDatabase(): Sql {
  return postgres(testDatabaseUrl(), { max: 4, prepare: false });
}

export async function ensureQuickShareSchema(sql: Sql): Promise<void> {
  await sql`select pg_advisory_lock(734620)`;
  try {
    const rows = await sql<{ table_name: string | null }[]>`
      select to_regclass('public.quick_shares')::text as table_name
    `;
    if (!rows[0]?.table_name) {
      await sql.unsafe(readFileSync("supabase/migrations/202608090001_quick_shares.sql", "utf8"));
    }
  } finally {
    await sql`select pg_advisory_unlock(734620)`;
  }
}

export async function ensureKeyGroupSchema(sql: Sql): Promise<void> {
  await sql`select pg_advisory_lock(734621)`;
  try {
    const rows = await sql<{ table_name: string | null }[]>`select to_regclass('public.key_groups')::text as table_name`;
    if (!rows[0]?.table_name) {
      const prerequisite = readFileSync("supabase/migrations/202608090001_quick_shares.sql", "utf8")
        + "\n" + readFileSync("supabase/migrations/202608090002_key_groups.sql", "utf8");
      await sql.unsafe(prerequisite);
    }
  } finally {
    await sql`select pg_advisory_unlock(734621)`;
  }
}
