import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

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
