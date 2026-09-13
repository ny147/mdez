import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sql } from "postgres";

import { PostgresKeyGroupStore } from "@/server/key-groups/postgres-store";
import { ensureKeyGroupSchema, openTestDatabase } from "./support/postgres";

describe("shared book deletion concurrency", () => {
  let sqlA: Sql;
  let sqlB: Sql;
  beforeAll(async () => {
    sqlA = openTestDatabase();
    sqlB = openTestDatabase();
    await ensureKeyGroupSchema(sqlA);
  });
  afterAll(async () => { await Promise.all([sqlA?.end(), sqlB?.end()]); });

  it("waits for the group lock before taking the target book lock", async () => {
    const groupId = "00000000-0000-4000-8000-000000000101";
    const folderId = "00000000-0000-4000-8000-000000000102";
    await sqlA`insert into public.key_groups (id, name, key_digest) values (${groupId}, 'Concurrency', decode('01', 'hex'))`;
    await sqlA`insert into public.group_folders (id, group_id, parent_id, name, sort_order, group_revision) values (${folderId}, ${groupId}, null, 'Book', 0, 0)`;

    let groupLocked!: () => void;
    let release!: () => void;
    const locked = new Promise<void>((resolve) => { groupLocked = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    const holder = sqlA.begin(async (tx) => {
      await tx`select id from public.key_groups where id = ${groupId} for update`;
      groupLocked();
      await released;
      await tx`set local lock_timeout = '250ms'`;
      const rows = await tx<{ id: string }[]>`select id from public.group_folders where id = ${folderId} for update`;
      expect(rows[0]?.id).toBe(folderId);
    });

    await locked;
    const deletion = new PostgresKeyGroupStore(sqlB).deleteFolder(groupId, folderId, 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    release();
    await holder;
    await expect(deletion).resolves.toBe(1);
    expect((await sqlA`select id from public.group_folders where id = ${folderId}`)).toHaveLength(0);
    await sqlA`delete from public.group_change_log where group_id = ${groupId}`;
    await sqlA`delete from public.key_groups where id = ${groupId}`;
  });
});
