import { describe, expect, it } from "vitest";
import { parseGitHubRepositoryUrl } from "@/lib/github";

describe("parseGitHubRepositoryUrl", () => {
  it("parses a public GitHub repository URL", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/openai/codex")).toEqual({
      owner: "openai",
      repository: "codex",
      normalizedUrl: "https://github.com/openai/codex"
    });
  });

  it.each([
    "https://github.com/openai/codex/",
    "https://github.com/openai/codex.git",
    "https://github.com/openai/codex.git/"
  ])("normalizes trailing slash and .git suffix in %s", (url) => {
    expect(parseGitHubRepositoryUrl(url)).toEqual({
      owner: "openai",
      repository: "codex",
      normalizedUrl: "https://github.com/openai/codex"
    });
  });
  it.each([
    ["an HTTP URL", "http://github.com/openai/codex"],
    ["another host", "https://gitlab.com/openai/codex"],
    ["a GitHub subdomain", "https://api.github.com/openai/codex"],
    ["a username", "https://user@github.com/openai/codex"],
    ["a password", "https://user:password@github.com/openai/codex"],
    ["an explicit port", "https://github.com:443/openai/codex"],
    ["a query", "https://github.com/openai/codex?download=1"],
    ["a hash", "https://github.com/openai/codex#readme"],
    ["a missing owner and repository", "https://github.com/"],
    ["a missing repository", "https://github.com/openai"],
    ["extra path segments", "https://github.com/openai/codex/tree/main"],
    ["an encoded owner slash", "https://github.com/openai%2Fother/codex"],
    ["an encoded repository slash", "https://github.com/openai/codex%2Fother"],
    ["an owner with a leading hyphen", "https://github.com/-openai/codex"],
    ["an owner with a trailing hyphen", "https://github.com/openai-/codex"],
    ["an owner with an underscore", "https://github.com/open_ai/codex"],
    ["an owner longer than 39 characters", "https://github.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/codex"],
    ["the reserved .git repository name", "https://github.com/openai/.git"],
    ["an encoded space", "https://github.com/openai/code%20x"],
    ["a raw backslash", "https://github.com/openai\\codex"],
    ["an encoded backslash", "https://github.com/openai/code%5Cother"],
    ["an encoded control character", "https://github.com/openai/code%0Aother"],
    ["a raw control character", "https://github.com/openai/code" + String.fromCharCode(10) + "other"],
    ["an unsafe repository character", "https://github.com/openai/code~x"],
    ["a repository longer than 100 characters", "https://github.com/openai/" + "a".repeat(101)],
    ["a malformed URL", "not a url"],
    ["an empty value", ""]
  ])("rejects %s", (_label, url) => {
    expect(() => parseGitHubRepositoryUrl(url)).toThrowError(
      "Enter a public GitHub repository URL in the form https://github.com/owner/repository."
    );
  });

});
