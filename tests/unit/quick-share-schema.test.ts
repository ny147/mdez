import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
