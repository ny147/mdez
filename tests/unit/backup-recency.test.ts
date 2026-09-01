import { beforeEach, describe, expect, it } from "vitest";

import { backupRecencyKey, readBackupRecency, writeBackupRecency } from "@/lib/backup-recency";

describe("backup recency", () => {
  beforeEach(() => localStorage.clear());

  it("uses distinct versioned keys", () => {
    expect(backupRecencyKey({ kind: "local", id: null })).toBe("mdez:backup-recency:v1:local");
    expect(backupRecencyKey({ kind: "group", id: "one" })).not.toBe(backupRecencyKey({ kind: "group", id: "two" }));
  });

  it("round-trips a valid timestamp", () => {
    const workspace = { kind: "local" as const, id: null };
    const preparedAt = new Date(Date.now() - 1000).toISOString();
    writeBackupRecency(workspace, preparedAt);
    expect(readBackupRecency(workspace)).toEqual({ preparedAt });
  });

  it("returns null for corrupt, invalid, or future data", () => {
    const workspace = { kind: "local" as const, id: null };
    localStorage.setItem(backupRecencyKey(workspace), "not json");
    expect(readBackupRecency(workspace)).toBeNull();
    localStorage.setItem(backupRecencyKey(workspace), JSON.stringify({ preparedAt: "invalid" }));
    expect(readBackupRecency(workspace)).toBeNull();
    localStorage.setItem(backupRecencyKey(workspace), JSON.stringify({ preparedAt: new Date(Date.now() + 60_000).toISOString() }));
    expect(readBackupRecency(workspace)).toBeNull();
  });
});
