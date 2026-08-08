import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/github/archive/route";
import type { GitHubArchiveErrorCode, GitHubArchiveErrorResponse } from "@/types/github";

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

function importRequest(url = "https://github.com/openai/codex") {
  return new Request("http://localhost/api/github/archive", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url })
  });
}

function metadataResponse(status = 200, overrides: Record<string, unknown> = {}) {
  return Response.json(
    {
      default_branch: "main",
      private: false,
      ...overrides
    },
    { status }
  );
}

function archiveResponse(bytes = ZIP_BYTES, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-length")) {
    headers.set("content-length", String(bytes.byteLength));
  }
  return new Response(bytes.slice().buffer, { ...init, headers });
}

async function expectArchiveError(response: Response, status: number, code: GitHubArchiveErrorCode) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  const body = (await response.json()) as GitHubArchiveErrorResponse;
  expect(body).toMatchObject({ ok: false, error: { code } });
  return body;
}

describe("POST /api/github/archive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("downloads the default branch from an internally constructed codeload URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(metadataResponse(200, { default_branch: "feature/docs" }))
      .mockResolvedValueOnce(archiveResponse());
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(importRequest("https://github.com/openai/codex.git/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-mdez-default-branch")).toBe("feature/docs");
    expect(response.headers.get("x-mdez-repository-url")).toBe("https://github.com/openai/codex");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(ZIP_BYTES);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/openai/codex",
      expect.objectContaining({ cache: "no-store", redirect: "follow", signal: expect.any(AbortSignal) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://codeload.github.com/openai/codex/zip/feature%2Fdocs",
      expect.objectContaining({ cache: "no-store", redirect: "follow", signal: expect.any(AbortSignal) })
    );
  });

  it("rejects invalid input without fetching an arbitrary URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(importRequest("https://example.com/archive.zip"));

    await expectArchiveError(response, 400, "invalid_repository");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/api/github/archive", { method: "POST", body: "{" });

    const response = await POST(request);

    await expectArchiveError(response, 400, "invalid_repository");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a missing or private repository honestly when metadata returns 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(metadataResponse(404)));

    const response = await POST(importRequest());
    const body = await expectArchiveError(response, 404, "repository_unavailable");

    expect(body.error.message).toMatch(/not found or private/i);
  });

  it("rejects metadata that identifies a private repository", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(metadataResponse(200, { private: true })));

    const response = await POST(importRequest());

    await expectArchiveError(response, 403, "private_repository");
  });

  it.each([403, 429])("maps metadata status %s to a rate-limit error", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(metadataResponse(status)));

    const response = await POST(importRequest());

    await expectArchiveError(response, 429, "rate_limited");
  });

  it("maps other metadata failures to an upstream error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(metadataResponse(502)));

    const response = await POST(importRequest());

    await expectArchiveError(response, 502, "upstream_error");
  });

  it.each([
    [404, 404, "repository_unavailable"],
    [403, 429, "rate_limited"],
    [429, 429, "rate_limited"],
    [502, 502, "upstream_error"]
  ] as const)("maps archive status %s to %s", async (upstreamStatus, expectedStatus, code) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce(archiveResponse(ZIP_BYTES, { status: upstreamStatus }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(importRequest());

    await expectArchiveError(response, expectedStatus, code);
  });

  it("times out stalled GitHub requests", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = POST(importRequest());
    await vi.advanceTimersByTimeAsync(15_000);
    const response = await responsePromise;

    await expectArchiveError(response, 504, "timeout");
  });

  it("rejects an announced archive larger than 25 MB before reading it", async () => {
    const oversized = archiveResponse(ZIP_BYTES, {
      headers: { "content-length": String(MAX_ARCHIVE_BYTES + 1) }
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(metadataResponse()).mockResolvedValueOnce(oversized);
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(importRequest());

    await expectArchiveError(response, 413, "archive_oversized");
  });

  it("rejects an actual archive larger than 25 MB", async () => {
    const bytes = new Uint8Array(MAX_ARCHIVE_BYTES + 1);
    bytes.set(ZIP_BYTES);
    const responseWithoutLength = new Response(bytes.slice().buffer);
    const fetchMock = vi.fn().mockResolvedValueOnce(metadataResponse()).mockResolvedValueOnce(responseWithoutLength);
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(importRequest());

    await expectArchiveError(response, 413, "archive_oversized");
  });

  it("rejects an empty archive response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce(archiveResponse(new Uint8Array()));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(importRequest());

    await expectArchiveError(response, 422, "empty_repository");
  });

  it("rejects a response without a ZIP signature", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce(archiveResponse(new Uint8Array([1, 2, 3, 4])));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(importRequest());

    await expectArchiveError(response, 502, "invalid_archive");
  });
});
