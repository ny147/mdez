import { parseGitHubRepositoryUrl } from "@/lib/github";
import type {
  GitHubArchiveErrorCode,
  GitHubArchiveErrorResponse,
  GitHubArchiveRequest
} from "@/types/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
} as const;

class ArchiveTooLargeError extends Error {}

function archiveError(
  status: number,
  code: GitHubArchiveErrorCode,
  message: string
): Response {
  const body: GitHubArchiveErrorResponse = {
    ok: false,
    error: { code, message }
  };

  return Response.json(body, {
    status,
    headers: RESPONSE_HEADERS
  });
}

function unavailableRepository(): Response {
  return archiveError(
    404,
    "repository_unavailable",
    "The repository was not found or private."
  );
}

function rateLimited(): Response {
  return archiveError(
    429,
    "rate_limited",
    "GitHub is rate limiting requests. Wait a moment, then try again."
  );
}

function upstreamFailure(): Response {
  return archiveError(
    502,
    "upstream_error",
    "GitHub could not provide this repository right now."
  );
}

function mapUpstreamFailure(status: number): Response {
  if (status === 404) {
    return unavailableRepository();
  }

  if (status === 403 || status === 429) {
    return rateLimited();
  }

  return upstreamFailure();
}

function isValidBranch(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
}

function isZipArchive(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

function isEmptyZipArchive(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x05 &&
    bytes[3] === 0x06
  );
}

async function readBoundedArchive(response: Response): Promise<Uint8Array> {
  const announcedLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(announcedLength) && announcedLength > MAX_ARCHIVE_BYTES) {
    throw new ArchiveTooLargeError();
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());

    if (bytes.byteLength > MAX_ARCHIVE_BYTES) {
      throw new ArchiveTooLargeError();
    }

    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    byteLength += value.byteLength;

    if (byteLength > MAX_ARCHIVE_BYTES) {
      void reader.cancel();
      throw new ArchiveTooLargeError();
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export async function POST(request: Request): Promise<Response> {
  let repositoryUrl: string;

  try {
    const payload = (await request.json()) as Partial<GitHubArchiveRequest> | null;

    if (!payload || typeof payload !== "object" || typeof payload.url !== "string") {
      throw new Error("Invalid request.");
    }

    repositoryUrl = payload.url;
  } catch {
    return archiveError(
      400,
      "invalid_repository",
      "Enter a public GitHub repository URL."
    );
  }

  let repository;

  try {
    repository = parseGitHubRepositoryUrl(repositoryUrl);
  } catch {
    return archiveError(
      400,
      "invalid_repository",
      "Enter a public GitHub repository URL."
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const requestOptions: RequestInit = {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    signal: controller.signal
  };

  try {
    const metadataResponse = await fetch(
      "https://api.github.com/repos/" +
        encodeURIComponent(repository.owner) +
        "/" +
        encodeURIComponent(repository.repository),
      {
        ...requestOptions,
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Mdez"
        }
      }
    );

    if (!metadataResponse.ok) {
      return mapUpstreamFailure(metadataResponse.status);
    }

    const metadata = (await metadataResponse.json()) as {
      default_branch?: unknown;
      private?: unknown;
    };

    if (metadata.private === true) {
      return archiveError(
        403,
        "private_repository",
        "Private repositories are not supported."
      );
    }

    if (!isValidBranch(metadata.default_branch)) {
      return upstreamFailure();
    }

    const branch = metadata.default_branch;
    const archiveResponse = await fetch(
      "https://codeload.github.com/" +
        encodeURIComponent(repository.owner) +
        "/" +
        encodeURIComponent(repository.repository) +
        "/zip/" +
        encodeURIComponent(branch),
      {
        ...requestOptions,
        headers: {
          Accept: "application/zip",
          "User-Agent": "Mdez"
        }
      }
    );

    if (!archiveResponse.ok) {
      return mapUpstreamFailure(archiveResponse.status);
    }

    const bytes = await readBoundedArchive(archiveResponse);

    if (bytes.byteLength === 0 || isEmptyZipArchive(bytes)) {
      return archiveError(
        422,
        "empty_repository",
        "This repository does not contain an importable archive."
      );
    }

    if (!isZipArchive(bytes)) {
      return archiveError(
        502,
        "invalid_archive",
        "GitHub returned an invalid repository archive."
      );
    }

    return new Response(bytes.slice().buffer, {
      status: 200,
      headers: {
        ...RESPONSE_HEADERS,
        "Content-Type": "application/zip",
        "X-Mdez-Default-Branch": branch,
        "X-Mdez-Repository-Url": repository.normalizedUrl
      }
    });
  } catch (error) {
    if (isAbortError(error)) {
      return archiveError(
        504,
        "timeout",
        "GitHub took too long to respond. Try again."
      );
    }

    if (error instanceof ArchiveTooLargeError) {
      return archiveError(
        413,
        "archive_oversized",
        "This repository archive is larger than 25 MB."
      );
    }

    return upstreamFailure();
  } finally {
    clearTimeout(timeout);
  }
}
