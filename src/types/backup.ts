import type { PageBookmark } from "@/lib/db";
import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";

export type WorkspaceBackupManifestV1 = {
  format: "mdez-library-backup";
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  books: BackupBookV1[];
  pages: BackupPageV1[];
  bookmarks: BackupBookmarkV1[];
  githubSources: BackupGitHubSourceV1[];
};

export type BackupBookV1 = Omit<Folder, "parentId">;
export type BackupPageV1 = Omit<Document, "body" | "folderId"> & {
  bookId: string | null;
  path: string;
  byteLength: number;
  sha256: string;
};
export type BackupBookmarkV1 = { pageId: string; createdAt: string };
export type BackupGitHubSourceV1 = Omit<GitHubSource, "rootFolderId"> & { rootBookId: string };

export type WorkspaceBackupInput = {
  appVersion: string;
  exportedAt: string;
  books: Folder[];
  pages: Document[];
  bookmarks: PageBookmark[];
  githubSources: GitHubSource[];
};

export type ParsedBackupPage = { metadata: BackupPageV1; body: string };
export type ParsedWorkspaceBackup = {
  manifest: WorkspaceBackupManifestV1;
  pages: ParsedBackupPage[];
  totalMarkdownBytes: number;
};

export type PlannedBackupBook = BackupBookV1 & {
  restoredName: string;
  renamed: boolean;
};
export type PlannedBackupSource = BackupGitHubSourceV1 & {
  action: "retain" | "detach";
};
export type WorkspaceRestoreSummary = {
  bookCount: number;
  emptyBookCount: number;
  pageCount: number;
  unsortedPageCount: number;
  bookmarkCount: number;
  totalMarkdownBytes: number;
};
export type WorkspaceRestorePlan = {
  parsed: ParsedWorkspaceBackup;
  baseSignature: string;
  books: PlannedBackupBook[];
  sources: PlannedBackupSource[];
  summary: WorkspaceRestoreSummary;
};
export type WorkspaceRestoreResult = {
  bookCount: number;
  pageCount: number;
  bookmarkCount: number;
  firstDocumentId: string | null;
};

export type WorkspaceBackupErrorCode =
  | "unreadable_file"
  | "invalid_zip"
  | "unsupported_version"
  | "unsafe_structure"
  | "damaged_content"
  | "limit_exceeded"
  | "stale_preview";

export class WorkspaceBackupError extends Error {
  constructor(public readonly code: WorkspaceBackupErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceBackupError";
  }
}
