import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GitHubImportError,
  parseGitHubArchive,
  requestGitHubImportPreview
} from "@/lib/github-import";
import type { GitHubRepositoryRef } from "@/types/github";

const repository: GitHubRepositoryRef = {
  owner: "openai",
  repository: "codex",
  normalizedUrl: "https://github.com/openai/codex"
};
const FIVE_MB = 5 * 1024 * 1024;

async function makeZip(
  entries: Record<string, string | Uint8Array>,
  compression: "STORE" | "DEFLATE" = "STORE"
) {
  const zip = new JSZip();

  for (const [path, body] of Object.entries(entries)) {
    zip.file(path, body);
  }

  return zip.generateAsync({ type: "arraybuffer", compression });
}

function bytesOf(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

describe("parseGitHubArchive", () => {
  it("removes the generated root and creates a deterministic Markdown hierarchy", async () => {
    const archive = await makeZip({
      "codex-main/z-last.md": "# Last",
      "codex-main/docs/zebra.md": "zebra",
      "codex-main/docs/alpha.markdown": "alpha",
      "codex-main/docs/nested/readme.md": "# Nested",
      "codex-main/appendix/page.md": "appendix",
      "codex-main/.obsidian/workspace.json": "{}",
      "codex-main/.github/contributing.md": "hidden",
      "codex-main/assets/logo.png": new Uint8Array([1, 2, 3]),
      "codex-main/empty.md": " \n\t"
    });

    const session = await parseGitHubArchive(archive, repository, "main");

    expect(session.repository).toEqual(repository);
    expect(session.branch).toBe("main");
    expect(session.markdownCount).toBe(5);
    expect(session.ignoredCount).toBe(4);
    expect(session.totalMarkdownBytes).toBe(
      bytesOf("# Last") + bytesOf("zebra") + bytesOf("alpha") + bytesOf("# Nested") + bytesOf("appendix")
    );
    expect(session.folders).toEqual([
      { path: "appendix", name: "appendix", parentPath: null, order: 0 },
      { path: "docs", name: "docs", parentPath: null, order: 1 },
      { path: "docs/nested", name: "nested", parentPath: "docs", order: 0 }
    ]);
    expect(session.documents).toEqual([
      expect.objectContaining({ path: "appendix/page.md", title: "page", folderPath: "appendix", order: 0 }),
      expect.objectContaining({ path: "docs/alpha.markdown", title: "alpha", folderPath: "docs", order: 0 }),
      expect.objectContaining({ path: "docs/nested/readme.md", title: "readme", folderPath: "docs/nested", order: 0 }),
      expect.objectContaining({ path: "docs/zebra.md", title: "zebra", folderPath: "docs", order: 1 }),
      expect.objectContaining({ path: "z-last.md", title: "z-last", folderPath: null, order: 0 })
    ]);
    expect(session.ignoredEntries).toEqual([
      { path: ".github/contributing.md", reason: "hidden_configuration" },
      { path: ".obsidian/workspace.json", reason: "obsidian" },
      { path: "assets/logo.png", reason: "unsupported_file" },
      { path: "empty.md", reason: "empty_markdown" }
    ]);
    expect(Date.parse(session.fetchedAt)).not.toBeNaN();
  });

  it.each([
    ["traversal", "codex-main/../evil.md"],
    ["absolute", "/codex-main/evil.md"],
    ["drive", "C:/codex-main/evil.md"],
    ["backslash", "codex-main\\evil.md"],
    ["control", "codex-main/bad\nname.md"],
    ["empty segment", "codex-main//evil.md"]
  ])("rejects %s entry paths before root removal", async (_label, path) => {
    const archive = await makeZip({ [path]: "unsafe" });

    await expect(parseGitHubArchive(archive, repository, "main")).rejects.toThrow(/unsafe archive path/i);
  });

  it("rejects archives containing mixed generated roots", async () => {
    const archive = await makeZip({
      "codex-main/readme.md": "readme",
      "another-root/page.md": "page"
    });

    await expect(parseGitHubArchive(archive, repository, "main")).rejects.toThrow(/single root/i);
  });

  it("rejects invalid UTF-8 Markdown", async () => {
    const archive = await makeZip({
      "codex-main/readme.md": new Uint8Array([0xc3, 0x28])
    });

    await expect(parseGitHubArchive(archive, repository, "main")).rejects.toThrow(/utf-8/i);
  });

  it("checks ZIP entry CRC values", async () => {
    const markerText = "unique-crc-marker";
    const marker = Uint8Array.from(markerText, (character) => character.charCodeAt(0));
    const archive = new Uint8Array(await makeZip({ "codex-main/readme.md": markerText }));
    const markerOffset = archive.findIndex((value, index) =>
      marker.every((markerValue, markerIndex) => archive[index + markerIndex] === markerValue)
    );
    expect(markerOffset).toBeGreaterThan(-1);
    archive[markerOffset] ^= 0xff;

    await expect(parseGitHubArchive(archive.buffer, repository, "main")).rejects.toThrow();
  });

  it("rejects more than 1,000 Markdown files", async () => {
    const entries = Object.fromEntries(
      Array.from({ length: 1_001 }, (_, index) => [`codex-main/page-${index}.md`, "x"])
    );
    const archive = await makeZip(entries);

    await expect(parseGitHubArchive(archive, repository, "main")).rejects.toThrow(/1,000/i);
  });

  it("rejects an extracted Markdown file larger than 5 MB", async () => {
    const archive = await makeZip({
      "codex-main/large.md": new Uint8Array(FIVE_MB + 1)
    }, "DEFLATE");

    await expect(parseGitHubArchive(archive, repository, "main")).rejects.toThrow(/5 mb/i);
  }, 20_000);

  it("rejects more than 50 MB of extracted Markdown", async () => {
    const fiveMb = new Uint8Array(FIVE_MB);
    const entries = Object.fromEntries([
      ...Array.from({ length: 10 }, (_, index) => [`codex-main/page-${index}.md`, fiveMb] as const),
      ["codex-main/overflow.md", "x"] as const
    ]);
    const archive = await makeZip(entries, "DEFLATE");

    await expect(parseGitHubArchive(archive, repository, "main")).rejects.toThrow(/50 mb/i);
  }, 30_000);
});

describe("requestGitHubImportPreview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests the controlled route and parses its required source headers", async () => {
    const archive = await makeZip({ "codex-main/readme.md": "# Read me" });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(archive, {
        status: 200,
        headers: {
          "content-type": "application/zip",
          "x-mdez-default-branch": "main",
          "x-mdez-repository-url": repository.normalizedUrl
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await requestGitHubImportPreview(repository.normalizedUrl);

    expect(session.markdownCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/github/archive",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({ url: repository.normalizedUrl })
      })
    );
  });

  it("requires both trusted source headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(new ArrayBuffer(0), { status: 200 })));

    await expect(requestGitHubImportPreview(repository.normalizedUrl)).rejects.toThrow(/invalid response/i);
  });

  it("surfaces typed route errors without exposing payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        Response.json(
          {
            ok: false,
            error: { code: "rate_limited", message: "Try again later." }
          },
          { status: 429 }
        )
      )
    );

    const error = await requestGitHubImportPreview(repository.normalizedUrl).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(GitHubImportError);
    expect(error).toMatchObject({ code: "rate_limited", status: 429, message: "Try again later." });
  });
});
