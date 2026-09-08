import Dexie, { type EntityTable, type Table } from "dexie";
import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";
import type { GroupSnapshot } from "@/types/key-group";

export type StoredSharedLink = {
  publicId: string;
  url: string;
  title: string;
  managementToken: string;
  createdAt: string;
  expiresAt: string | null;
};

export type RememberedGroup = {
  groupId: string;
  name: string;
  key: string;
  joinedAt: string;
  lastOpenedAt: string;
};

export type CachedGroupState = {
  groupId: string;
  revision: number;
  snapshot: GroupSnapshot;
  cachedAt: string;
};

export type PageBookmark = {
  workspaceId: string;
  documentId: string;
  createdAt: string;
};

export type WorkspaceResume = {
  workspaceId: string;
  documentId: string;
  openedAt: string;
};

export class MdezDatabase extends Dexie {
  folders!: EntityTable<Folder, "id">;
  documents!: EntityTable<Document, "id">;
  githubSources!: EntityTable<GitHubSource, "id">;
  sharedLinks!: EntityTable<StoredSharedLink, "publicId">;
  rememberedGroups!: EntityTable<RememberedGroup, "groupId">;
  cachedGroups!: EntityTable<CachedGroupState, "groupId">;
  pageBookmarks!: Table<PageBookmark, [string, string]>;
  workspaceResume!: EntityTable<WorkspaceResume, "workspaceId">;

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

    this.version(3).stores({
      folders: "id, parentId, sourceId, order, updatedAt",
      documents: "id, folderId, sourceId, order, updatedAt",
      githubSources: "id, &normalizedUrl, rootFolderId, updatedAt",
      sharedLinks: "publicId, createdAt, expiresAt"
    });

    this.version(4).stores({
      folders: "id, parentId, sourceId, order, updatedAt",
      documents: "id, folderId, sourceId, order, updatedAt",
      githubSources: "id, &normalizedUrl, rootFolderId, updatedAt",
      sharedLinks: "publicId, createdAt, expiresAt",
      rememberedGroups: "groupId, lastOpenedAt",
      cachedGroups: "groupId, cachedAt"
    });

    this.version(5).stores({
      folders: "id, parentId, sourceId, order, updatedAt",
      documents: "id, folderId, sourceId, order, updatedAt",
      githubSources: "id, &normalizedUrl, rootFolderId, updatedAt",
      sharedLinks: "publicId, createdAt, expiresAt",
      rememberedGroups: "groupId, lastOpenedAt",
      cachedGroups: "groupId, cachedAt",
      pageBookmarks: "[workspaceId+documentId], workspaceId",
      workspaceResume: "workspaceId"
    });
  }
}

export const db = new MdezDatabase();
