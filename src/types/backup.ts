import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";

export type WorkspaceBackupManifestV1 = {
  app: "Mdez";
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  workspace: { kind: "local" | "group"; id: string | null; name: string };
  folders: Folder[];
  documents: Array<Omit<Document, "body"> & { path: string }>;
  githubSources: GitHubSource[];
};

export type ParsedWorkspaceBackup = {
  manifest: WorkspaceBackupManifestV1;
  documents: Array<Omit<Document, "body"> & { body: string; path: string }>;
};

export type WorkspaceBackupPreview = {
  workspaceName: string;
  workspaceKind: "local" | "group";
  exportedAt: string;
  folderCount: number;
  documentCount: number;
  warnings: string[];
  parsed: ParsedWorkspaceBackup;
};

export type PreparedWorkspaceRestore = {
  rootLabel: string;
  folders: Folder[];
  documents: Document[];
  githubSources: GitHubSource[];
  firstDocumentId: string | null;
};
