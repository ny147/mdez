import JSZip, { type JSZipObject } from "jszip";

import { parseGitHubRepositoryUrl } from "@/lib/github";
import { fileNameToTitle } from "@/lib/markdown";
import type {
  GitHubArchiveErrorCode,
  GitHubArchiveErrorResponse,
  GitHubDocumentDraft,
  GitHubFolderDraft,
  GitHubIgnoredEntry,
  GitHubIgnoredEntryReason,
  GitHubImportSession,
  GitHubRepositoryRef
} from "@/types/github";

const MAX_MARKDOWN_FILES = 1_000;
const MAX_MARKDOWN_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_MARKDOWN_BYTES = 50 * 1024 * 1024;
const MARKDOWN_EXTENSION = /\.(md|markdown)$/i;
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;

export class GitHubImportError extends Error {
  constructor(
    message: string,
    public readonly code: GitHubArchiveErrorCode = "invalid_archive",
    public readonly status?: number
  ) {
    super(message);
    this.name = "GitHubImportError";
  }
}

type ValidatedEntry = {
  entry: JSZipObject;
  relativePath: string;
  segments: string[];
};

function comparePaths(left: string, right: string): number {
  const foldedLeft = left.toLocaleLowerCase("en-US");
  const foldedRight = right.toLocaleLowerCase("en-US");

  if (foldedLeft < foldedRight) {
    return -1;
  }

  if (foldedLeft > foldedRight) {
    return 1;
  }

  return left < right ? -1 : left > right ? 1 : 0;
}

function invalidArchive(message: string): never {
  throw new GitHubImportError(message, "invalid_archive");
}

function validateEntryPath(entry: JSZipObject): { root: string; segments: string[] } {
  const originalPath = entry.unsafeOriginalName ?? entry.name;
  const path = originalPath.endsWith("/") ? originalPath.slice(0, -1) : originalPath;

  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    /^[A-Za-z]:\//.test(path) ||
    path.includes("\\") ||
    CONTROL_CHARACTER.test(path)
  ) {
    invalidArchive("The repository contains an unsafe archive path.");
  }

  const segments = path.split("/");

  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    invalidArchive("The repository contains an unsafe archive path.");
  }

  if (!entry.dir && segments.length < 2) {
    invalidArchive("The repository archive is missing its generated root folder.");
  }

  return { root: segments[0], segments };
}

function ignoredReason(segments: string[]): GitHubIgnoredEntryReason | null {
  if (segments.some((segment) => segment.toLocaleLowerCase("en-US") === ".obsidian")) {
    return "obsidian";
  }

  if (segments.some((segment) => segment.startsWith("."))) {
    return "hidden_configuration";
  }

  if (!MARKDOWN_EXTENSION.test(segments.at(-1) ?? "")) {
    return "unsupported_file";
  }

  return null;
}

function buildFolders(documents: GitHubDocumentDraft[]): GitHubFolderDraft[] {
  const paths = new Set<string>();

  for (const document of documents) {
    if (!document.folderPath) {
      continue;
    }

    const segments = document.folderPath.split("/");

    for (let index = 1; index <= segments.length; index += 1) {
      paths.add(segments.slice(0, index).join("/"));
    }
  }

  const siblingOrders = new Map<string, number>();

  return [...paths].sort(comparePaths).map((path) => {
    const segments = path.split("/");
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join("/") : null;
    const parentKey = parentPath ?? "";
    const order = siblingOrders.get(parentKey) ?? 0;
    siblingOrders.set(parentKey, order + 1);

    return {
      path,
      name: segments.at(-1) ?? path,
      parentPath,
      order
    };
  });
}

function validateBranch(branch: string) {
  if (branch.length === 0 || branch.length > 255 || CONTROL_CHARACTER.test(branch)) {
    invalidArchive("GitHub returned an invalid response.");
  }
}

export async function parseGitHubArchive(
  data: ArrayBuffer,
  repository: GitHubRepositoryRef,
  branch: string
): Promise<GitHubImportSession> {
  validateBranch(branch);

  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(data, { checkCRC32: true });
  } catch {
    invalidArchive("GitHub returned an invalid ZIP archive.");
  }

  const roots = new Set<string>();
  const entries: ValidatedEntry[] = [];

  for (const entry of Object.values(zip.files)) {
    const { root, segments } = validateEntryPath(entry);
    roots.add(root);

    entries.push({
      entry,
      segments: segments.slice(1),
      relativePath: segments.slice(1).join("/")
    });
  }

  if (roots.size !== 1) {
    invalidArchive("The repository archive must contain a single root folder.");
  }

  const ignoredEntries: GitHubIgnoredEntry[] = [];
  const markdownEntries: ValidatedEntry[] = [];

  for (const candidate of entries) {
    if (candidate.entry.dir || candidate.relativePath === "") {
      continue;
    }

    const reason = ignoredReason(candidate.segments);

    if (reason) {
      ignoredEntries.push({ path: candidate.relativePath, reason });
    } else {
      markdownEntries.push(candidate);
    }
  }

  if (markdownEntries.length > MAX_MARKDOWN_FILES) {
    throw new GitHubImportError(
      "This repository contains more than 1,000 Markdown files.",
      "archive_oversized"
    );
  }

  markdownEntries.sort((left, right) => comparePaths(left.relativePath, right.relativePath));
  const documents: GitHubDocumentDraft[] = [];
  const documentOrders = new Map<string, number>();
  let totalMarkdownBytes = 0;

  for (const candidate of markdownEntries) {
    const bytes = await candidate.entry.async("uint8array");

    if (bytes.byteLength > MAX_MARKDOWN_FILE_BYTES) {
      throw new GitHubImportError(
        candidate.relativePath + " is larger than the 5 MB Markdown limit.",
        "archive_oversized"
      );
    }

    totalMarkdownBytes += bytes.byteLength;

    if (totalMarkdownBytes > MAX_TOTAL_MARKDOWN_BYTES) {
      throw new GitHubImportError(
        "The repository contains more than 50 MB of extracted Markdown.",
        "archive_oversized"
      );
    }

    let body: string;

    try {
      body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new GitHubImportError(
        candidate.relativePath + " is not valid UTF-8 Markdown.",
        "invalid_archive"
      );
    }

    if (body.trim() === "") {
      ignoredEntries.push({ path: candidate.relativePath, reason: "empty_markdown" });
      totalMarkdownBytes -= bytes.byteLength;
      continue;
    }

    const fileName = candidate.segments.at(-1) ?? candidate.relativePath;
    const folderPath = candidate.segments.length > 1 ? candidate.segments.slice(0, -1).join("/") : null;
    const folderKey = folderPath ?? "";
    const order = documentOrders.get(folderKey) ?? 0;
    documentOrders.set(folderKey, order + 1);
    documents.push({
      path: candidate.relativePath,
      title: fileNameToTitle(fileName),
      body,
      folderPath,
      order,
      byteSize: bytes.byteLength
    });
  }

  ignoredEntries.sort((left, right) => comparePaths(left.path, right.path));

  return {
    repository,
    branch,
    markdownCount: documents.length,
    ignoredCount: ignoredEntries.length,
    totalMarkdownBytes,
    folders: buildFolders(documents),
    documents,
    ignoredEntries,
    fetchedAt: new Date().toISOString()
  };
}

function isArchiveErrorResponse(value: unknown): value is GitHubArchiveErrorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GitHubArchiveErrorResponse>;
  return (
    candidate.ok === false &&
    typeof candidate.error?.code === "string" &&
    typeof candidate.error.message === "string"
  );
}

export async function requestGitHubImportPreview(url: string): Promise<GitHubImportSession> {
  const requestedRepository = parseGitHubRepositoryUrl(url);
  const response = await fetch("/api/github/archive", {
    method: "POST",
    headers: {
      Accept: "application/zip, application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: requestedRepository.normalizedUrl }),
    cache: "no-store"
  });

  if (!response.ok) {
    let body: unknown;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (isArchiveErrorResponse(body)) {
      throw new GitHubImportError(body.error.message, body.error.code, response.status);
    }

    throw new GitHubImportError(
      "GitHub could not provide this repository right now.",
      "upstream_error",
      response.status
    );
  }

  const branch = response.headers.get("x-mdez-default-branch");
  const repositoryUrl = response.headers.get("x-mdez-repository-url");

  if (!branch || !repositoryUrl) {
    invalidArchive("GitHub returned an invalid response.");
  }

  let responseRepository: GitHubRepositoryRef;

  try {
    responseRepository = parseGitHubRepositoryUrl(repositoryUrl);
  } catch {
    invalidArchive("GitHub returned an invalid response.");
  }

  if (responseRepository.normalizedUrl.toLocaleLowerCase("en-US") !== requestedRepository.normalizedUrl.toLocaleLowerCase("en-US")) {
    invalidArchive("GitHub returned an invalid response.");
  }

  return parseGitHubArchive(await response.arrayBuffer(), responseRepository, branch);
}
