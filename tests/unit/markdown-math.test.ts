import { describe, expect, it } from "vitest";

import { normalizeMathDelimiters } from "@/lib/markdown-math";

describe("normalizeMathDelimiters", () => {
  it("converts inline compatibility delimiters", () => {
    expect(normalizeMathDelimiters("Value: \\(n! = n(n-1)\\cdots1\\)"))
      .toBe("Value: $n! = n(n-1)\\cdots1$");
  });

  it("converts display compatibility delimiters", () => {
    expect(normalizeMathDelimiters("\\[\n\\frac{8!}{6!}=56\n\\]"))
      .toBe("$$\n\\frac{8!}{6!}=56\n$$");
  });

  it("leaves plain square brackets and escaped delimiters unchanged", () => {
    expect(normalizeMathDelimiters("[ordinary text] and \\\\(literal\\\\)"))
      .toBe("[ordinary text] and \\\\(literal\\\\)");
  });

  it("does not normalize delimiters inside inline or fenced code", () => {
    const markdown = "`\\(inline\\)`\n\n```text\n\\[backticks\\]\n```\n\n~~~text\n\\(tildes\\)\n~~~";
    expect(normalizeMathDelimiters(markdown)).toBe(markdown);
  });
});
