import { db, type MdezDatabase, type PageBookmark } from "@/lib/db";

export type { PageBookmark } from "@/lib/db";

export function listBookmarks(workspaceId: string, database: MdezDatabase = db): Promise<PageBookmark[]> {
  return database.pageBookmarks.where("workspaceId").equals(workspaceId).sortBy("createdAt");
}

export async function setBookmark(
  workspaceId: string,
  documentId: string,
  enabled: boolean,
  database: MdezDatabase = db
): Promise<void> {
  await database.transaction("rw", database.pageBookmarks, async () => {
    const key: [string, string] = [workspaceId, documentId];
    if (enabled) {
      await database.pageBookmarks.put({ workspaceId, documentId, createdAt: new Date().toISOString() });
    } else {
      await database.pageBookmarks.delete(key);
    }
  });
}
