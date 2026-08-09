export const GROUP_LIMITS = {
  pages: 1000,
  pageBytes: 5 * 1024 * 1024,
  totalBytes: 50 * 1024 * 1024,
} as const;

export type GroupFolder = {
  id: string;
  parentId: string | null;
  name: string;
  order: number;
  version: number;
  groupRevision: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupDocument = {
  id: string;
  folderId: string | null;
  title: string;
  body: string;
  order: number;
  version: number;
  groupRevision: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupSummary = {
  id: string;
  name: string;
  revision: number;
  deletedAt: string | null;
  purgeAfter: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GroupSnapshot = {
  group: GroupSummary;
  folders: GroupFolder[];
  documents: GroupDocument[];
};

export type GroupChange = {
  revision: number;
  entityType: "group" | "folder" | "document";
  entityId: string;
  operation: "create" | "update" | "delete";
  changedAt: string;
};

export type GroupChangesResult =
  | {
      status: "changes";
      revision: number;
      changes: GroupChange[];
      records: {
        group: GroupSummary | null;
        folders: GroupFolder[];
        documents: GroupDocument[];
      };
    }
  | { status: "reset_required"; revision: number };

export type LocalGroupImport = {
  name: string;
  folders: Array<{
    clientId: string;
    parentClientId: string | null;
    name: string;
    order: number;
    createdAt: string;
    updatedAt: string;
  }>;
  documents: Array<{
    clientId: string;
    folderClientId: string | null;
    title: string;
    body: string;
    order: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type LocalGroupCreation = { key: string; import: LocalGroupImport };

export type GroupConflict = {
  entityType: "folder" | "document";
  entityId: string;
  expectedVersion: number;
  currentVersion: number;
};
