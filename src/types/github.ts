export type GitHubRepositoryRef = {
  owner: string;
  repository: string;
  normalizedUrl: string;
};

export type GitHubArchiveRequest = {
  url: string;
};

export type GitHubArchiveErrorCode =
  | "invalid_repository"
  | "repository_unavailable"
  | "private_repository"
  | "rate_limited"
  | "timeout"
  | "archive_oversized"
  | "invalid_archive"
  | "empty_repository"
  | "upstream_error";

export type GitHubArchiveError = {
  code: GitHubArchiveErrorCode;
  message: string;
};

export type GitHubArchiveErrorResponse = {
  ok: false;
  error: GitHubArchiveError;
};

export type GitHubIgnoredEntryReason =
  | "obsidian"
  | "hidden_configuration"
  | "unsupported_file"
  | "empty_markdown";

export type GitHubIgnoredEntry = {
  path: string;
  reason: GitHubIgnoredEntryReason;
};

export type GitHubFolderDraft = {
  path: string;
  name: string;
  parentPath: string | null;
  order: number;
};

export type GitHubDocumentDraft = {
  path: string;
  title: string;
  body: string;
  folderPath: string | null;
  order: number;
  byteSize: number;
};

export type GitHubImportPreview = {
  repository: GitHubRepositoryRef;
  branch: string;
  markdownCount: number;
  ignoredCount: number;
  totalMarkdownBytes: number;
  folders: GitHubFolderDraft[];
  documents: GitHubDocumentDraft[];
  ignoredEntries: GitHubIgnoredEntry[];
};

export type GitHubImportSession = GitHubImportPreview & {
  fetchedAt: string;
};

export type GitHubSource = {
  id: string;
  owner: string;
  repository: string;
  normalizedUrl: string;
  branch: string;
  rootFolderId: string;
  lastRefreshedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type GitHubImportResult = {
  source: GitHubSource;
  rootFolderId: string;
  firstDocumentId: string | null;
  folderCount: number;
  documentCount: number;
};
