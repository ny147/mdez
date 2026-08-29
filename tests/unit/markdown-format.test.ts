import { describe, expect, it } from "vitest";

import { createMarkdownFormatEdit } from "@/lib/markdown-format";

describe("createMarkdownFormatEdit", () => {
  it("wraps selected text as inline code", () => {
    expect(createMarkdownFormatEdit({ action: "inlineCode", from: 4, to: 9, selected: "value" }))
      .toEqual({ from: 4, to: 9, insert: "`value`", anchor: 11 });
  });

  it("wraps selected text in a fenced code block", () => {
    expect(createMarkdownFormatEdit({ action: "codeBlock", from: 0, to: 16, selected: "const value = 1;" }))
      .toEqual({ from: 0, to: 16, insert: "\n```text\nconst value = 1;\n```\n", anchor: 30 });
  });

  it("uses inline math for a single-line selection", () => {
    expect(createMarkdownFormatEdit({ action: "math", from: 8, to: 13, selected: "x + y" }))
      .toEqual({ from: 8, to: 13, insert: "$x + y$", anchor: 15 });
  });

  it("uses display math for a multiline selection", () => {
    expect(createMarkdownFormatEdit({ action: "math", from: 0, to: 9, selected: "x + y\n= z" }))
      .toEqual({ from: 0, to: 9, insert: "\n$$\nx + y\n= z\n$$\n", anchor: 17 });
  });

  it("places the cursor inside an empty math template", () => {
    expect(createMarkdownFormatEdit({ action: "math", from: 3, to: 3, selected: "" }))
      .toEqual({ from: 3, to: 3, insert: "$formula$", anchor: 4 });
  });

  it("replaces an existing heading prefix on the whole line", () => {
    expect(createMarkdownFormatEdit({
      action: "h2",
      from: 5,
      to: 5,
      selected: "",
      line: { from: 0, to: 9, text: "### Title" }
    })).toEqual({ from: 0, to: 9, insert: "## Title", anchor: 8 });
  });
});
