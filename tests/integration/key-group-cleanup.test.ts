import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sql } from "postgres";

import { PostgresKeyGroupStore } from "@/server/key-groups/postgres-store";
import { ensureKeyGroupSchema, openTestDatabase } from "./support/postgres";

const GROUP_IDS = [
  "00000000-0000-4000-8000-000000000301",
  "00000000-0000-4000-8000-000000000302",
  "00000000-0000-4000-8000-000000000303",
  "00000000-0000-4000-8000-000000000304"
];

describe("Key Group cleanup", () => {
  let sql: Sql;
  let store: PostgresKeyGroupStore;

  beforeAll(async () => {
    sql = openTestDatabase();
    await ensureKeyGroupSchema(sql);
    store = new PostgresKeyGroupStore(sql);
  });

  afterAll(async () => {
    if (sql) {
      await sql`delete from public.key_groups where id in ${sql(GROUP_IDS)}`;
      await sql.end();
    }
  });

  it("restores a deleted group before its exact seven-day deadline", async () => {
    const deletedAt = new Date("2026-09-08T00:00:00.000Z");
    const restoreAt = new Date("2026-09-14T23:59:59.999Z");
    const groupId = GROUP_IDS[0];
    await sql`insert into public.key_groups (id, name, key_digest) values (${groupId}, 'Restorable', decode('31', 'hex'))`;
    await sql`insert into public.group_documents (group_id, title, markdown, sort_order, group_revision) values (${groupId}, 'Draft', '# safe', 0, 0)`;

    const deleted = await store.softDeleteGroup(groupId, deletedAt);
    expect(deleted.deletedAt).toBe(deletedAt.toISOString());
    expect(deleted.purgeAfter).toBe("2026-09-15T00:00:00.000Z");

    const restored = await store.restoreGroup(groupId, restoreAt);
    expect(restored.deletedAt).toBeNull();
    expect(restored.purgeAfter).toBeNull();
    expect(await sql`select id from public.group_documents where group_id = ${groupId}`).toHaveLength(1);
  });

  it("purges at the deadline, retains active and unexpired groups, cascades children, and is idempotent", async () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    const expiredId = GROUP_IDS[1];
    const unexpiredId = GROUP_IDS[2];
    const activeId = GROUP_IDS[3];
    await sql`insert into public.key_groups (id, name, key_digest) values
      (${expiredId}, 'Expired', decode('32', 'hex')),
      (${unexpiredId}, 'Unexpired', decode('33', 'hex')),
      (${activeId}, 'Active', decode('34', 'hex'))`;
    const [{ id: folderId }] = await sql<{ id: string }[]>`
      insert into public.group_folders (group_id, parent_id, name, sort_order, group_revision)
      values (${expiredId}, null, 'Book', 0, 0)
      returning id
    `;
    await sql`
      insert into public.group_documents (group_id, folder_id, title, markdown, sort_order, group_revision)
      values (${expiredId}, ${folderId}, 'Draft', '# remove', 0, 0)
    `;
    await store.softDeleteGroup(expiredId, new Date("2026-09-08T00:00:00.000Z"));
    await store.softDeleteGroup(unexpiredId, new Date("2026-09-08T00:00:00.001Z"));

    await expect(store.purgeDeletedGroups(now)).resolves.toBe(1);
    await expect(store.purgeDeletedGroups(now)).resolves.toBe(0);

    const remaining = await sql<{ id: string }[]>`
      select id from public.key_groups where id in ${sql([expiredId, unexpiredId, activeId])} order by id
    `;
    expect(remaining.map((row) => row.id)).toEqual([unexpiredId, activeId].sort());
    expect(await sql`select id from public.group_folders where group_id = ${expiredId}`).toHaveLength(0);
    expect(await sql`select id from public.group_documents where group_id = ${expiredId}`).toHaveLength(0);
  });
});
