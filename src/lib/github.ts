import type { GitHubRepositoryRef } from "@/types/github";

const INVALID_REPOSITORY_URL_MESSAGE =
  "Enter a public GitHub repository URL in the form https://github.com/owner/repository.";
const OWNER_PATTERN = /^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/;
const REPOSITORY_PATTERN = /^(?!\.git$)[A-Za-z0-9._-]{1,100}$/;

function invalidRepositoryUrl(): never {
  throw new Error(INVALID_REPOSITORY_URL_MESSAGE);
}

export function parseGitHubRepositoryUrl(input: string): GitHubRepositoryRef {
  const trimmedInput = input.trim();

  if (trimmedInput.includes("\\") || /[\u0000-\u001F\u007F]/.test(trimmedInput)) {
    invalidRepositoryUrl();
  }

  let url: URL;

  try {
    url = new URL(trimmedInput);
  } catch {
    invalidRepositoryUrl();
  }

  const authority = trimmedInput.match(/^[A-Za-z][A-Za-z\d+.-]*:\/\/([^/?#]*)/)?.[1];

  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    authority?.toLowerCase() !== "github.com" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    trimmedInput.includes("?") ||
    trimmedInput.includes("#")
  ) {
    invalidRepositoryUrl();
  }

  const path = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  const encodedSegments = path.split("/").slice(1);

  if (encodedSegments.length !== 2 || encodedSegments.some((segment) => segment.length === 0)) {
    invalidRepositoryUrl();
  }

  let decodedSegments: string[];

  try {
    decodedSegments = encodedSegments.map((segment) => decodeURIComponent(segment));
  } catch {
    invalidRepositoryUrl();
  }

  const [owner, repositoryWithSuffix] = decodedSegments;
  const repository = repositoryWithSuffix.endsWith(".git") ? repositoryWithSuffix.slice(0, -4) : repositoryWithSuffix;

  if (!OWNER_PATTERN.test(owner) || !REPOSITORY_PATTERN.test(repository)) {
    invalidRepositoryUrl();
  }

  return {
    owner,
    repository,
    normalizedUrl: `https://github.com/${owner}/${repository}`
  };
}
