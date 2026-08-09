import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

import { PostgresKeyGroupStore } from "@/server/key-groups/postgres-store";

vi.mock("server-only", () => ({}));

const groupId = "00000000-0000-4000-8000-000000000001";
const documentId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-08-09T00:00:00.000Z");

type Log = { revision: number; entity_type: "document"; entity_id: string; operation: "update"; changed_at: Date };

function fakeTransactionSql() {
  const state = {
    group: { id: groupId, name: "Writers", revision: 1, deleted_at: null as Date | null, purge_after: null as Date | null, created_at: now, updated_at: now },
    document: { id: documentId, folder_id: null as string | null, title: "one.md", markdown: "first", sort_order: 0, version: 1, group_revision: 1, created_at: now, updated_at: now },
    logs: [] as Log[],
  };

  const tag = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?").replace(/\s+/g, " ").trim().toLowerCase();
    if (query.includes("select revision, deleted_at from public.key_groups")) return [{ revision: state.group.revision, deleted_at: state.group.deleted_at }];
    if (query.includes("from public.group_documents") && query.includes("for update")) return [{ ...state.document }];
    if (query.includes("sum(octet_length(markdown))")) return [{ total_bytes: 0 }];
    if (query.startsWith("update public.group_documents")) {
      const [title, markdown, folderId, sortOrder, revision, , , expectedVersion] = values as [string, string, string | null, number, number, string, string, number];
      if (state.document.version !== expectedVersion) return [];
      state.document = { ...state.document, title, markdown, folder_id: folderId, sort_order: sortOrder, version: state.document.version + 1, group_revision: revision, updated_at: now };
      return [{ ...state.document }];
    }
    if (query.startsWith("update public.key_groups set revision")) {
      state.group.revision = Number(values[0]);
      state.group.updated_at = now;
      return [];
    }
    if (query.startsWith("insert into public.group_change_log")) {
      state.logs.push({ revision: Number(values[1]), entity_type: "document", entity_id: String(values[3]), operation: "update", changed_at: now });
      return [];
    }
    if (query.includes("select id, name, revision, deleted_at")) return [{ ...state.group }];
    if (query.includes("select min(revision) as earliest_revision")) return [{ earliest_revision: state.logs.length ? Math.min(...state.logs.map((entry) => entry.revision)) : null }];
    if (query.includes("select revision, entity_type, entity_id, operation, changed_at")) return state.logs.filter((entry) => entry.revision > Number(values[1]));
    if (query.includes("from public.group_folders")) return [];
    if (query.includes("from public.group_documents") && query.includes("group_revision >")) return state.document.group_revision > Number(values[1]) ? [{ ...state.document }] : [];
    if (query.includes("from public.group_documents")) return [{ ...state.document }];
    throw new Error(`Unhandled fake SQL: ${query}`);
  };
  (tag as unknown as { begin: (callback: (tx: unknown) => unknown) => unknown }).begin = (callback) => callback(tag);
  return { sql: tag as unknown as Sql, state };
}

describe("Key Group transactional mutations", () => {
  it("increments entity version and group revision in one mutation", async () => {
    const { sql } = fakeTransactionSql();
    const store = new PostgresKeyGroupStore(sql);
    const updated = await store.updateDocument(groupId, documentId, { body: "second", expectedVersion: 1 });
    expect(updated.version).toBe(2);
    expect(updated.groupRevision).toBe(2);
    expect(await store.getChanges(groupId, 1)).toMatchObject({ status: "changes", revision: 2, changes: [{ entityType: "document", entityId: documentId, operation: "update" }] });
  });

  it("rejects a stale write without changing Markdown", async () => {
    const { sql } = fakeTransactionSql();
    const store = new PostgresKeyGroupStore(sql);
    await store.updateDocument(groupId, documentId, { body: "second", expectedVersion: 1 });
    await expect(store.updateDocument(groupId, documentId, { body: "stale", expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "CONFLICT", conflict: { entityId: documentId, expectedVersion: 1, currentVersion: 2 } });
    expect((await store.getSnapshot(groupId))?.documents[0].body).toBe("second");
  });

  it("requests a reset when the cursor predates retained changes", async () => {
    const { sql, state } = fakeTransactionSql();
    state.group.revision = 12;
    state.logs.push({ revision: 5, entity_type: "document", entity_id: documentId, operation: "update", changed_at: now });
    const store = new PostgresKeyGroupStore(sql);
    expect(await store.getChanges(groupId, 0)).toEqual({ status: "reset_required", revision: 12 });
  });
});
