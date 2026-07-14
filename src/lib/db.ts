import Dexie, { type EntityTable } from "dexie";
import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";

export class MdezDatabase extends Dexie {
  folders!: EntityTable<Folder, "id">;
  documents!: EntityTable<Document, "id">;
  githubSources!: EntityTable<GitHubSource, "id">;

  constructor(databaseName = "mdez") {
    super(databaseName);

    this.version(1).stores({
      folders: "id, parentId, order, updatedAt",
      documents: "id, folderId, order, updatedAt"
    });

    this.version(2).stores({
      folders: "id, parentId, sourceId, order, updatedAt",
      documents: "id, folderId, sourceId, order, updatedAt",
      githubSources: "id, &normalizedUrl, rootFolderId, updatedAt"
    });
  }
}

export const db = new MdezDatabase();
