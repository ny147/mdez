import Dexie from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MdezDatabase } from "@/lib/db";
import { getWorkspaceResume, recordWorkspaceOpened } from "@/lib/workspace-resume";

const names: string[] = [];
const createDatabase = () => {
  const name = `mdez-resume-${crypto.randomUUID()}`;
  names.push(name);
  return new MdezDatabase(name);
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)));
});

describe("workspace resume history", () => {
  it("persists only the latest rapid open and keeps workspaces isolated", async () => {
    const database = createDatabase();
    await Promise.all([
      recordWorkspaceOpened("local", "a", database),
      recordWorkspaceOpened("local", "b", database),
      recordWorkspaceOpened("group:test", "a", database)
    ]);
    expect((await getWorkspaceResume("local", database))?.documentId).toBe("b");
    expect((await getWorkspaceResume("group:test", database))?.documentId).toBe("a");
    database.close();

    const reopened = new MdezDatabase(database.name);
    expect((await getWorkspaceResume("local", reopened))?.documentId).toBe("b");
    reopened.close();
  });

  it("keeps missing targets as history and rejects failed writes", async () => {
    const database = createDatabase();
    await recordWorkspaceOpened("local", "now-missing", database);
    expect((await getWorkspaceResume("local", database))?.documentId).toBe("now-missing");
    vi.spyOn(database.workspaceResume, "put").mockRejectedValueOnce(new Error("unavailable"));
    await expect(recordWorkspaceOpened("local", "next", database)).rejects.toThrow("unavailable");
    expect((await getWorkspaceResume("local", database))?.documentId).toBe("now-missing");
    database.close();
  });
});
