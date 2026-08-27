export type MarkdownFormatAction =
  | "bold" | "italic" | "link" | "image"
  | "inlineCode" | "codeBlock" | "math"
  | "h1" | "h2" | "divider";

type MarkdownFormatRequest = {
  action: MarkdownFormatAction;
  from: number;
  to: number;
  selected: string;
  line?: { from: number; to: number; text: string };
  codeBlockLanguage?: string;
};

export type MarkdownFormatEdit = {
  from: number;
  to: number;
  insert: string;
  anchor: number;
};

export function createMarkdownFormatEdit(request: MarkdownFormatRequest): MarkdownFormatEdit {
  const { action, from, to, selected } = request;

  if (action === "h1" || action === "h2") {
    const line = request.line ?? { from, to, text: selected };
    const text = line.text.replace(/^#{1,6}\s+/, "");
    const insert = `${action === "h1" ? "#" : "##"} ${text}`;
    return { from: line.from, to: line.to, insert, anchor: line.from + insert.length };
  }

  if (action === "divider") {
    const insert = "\n---\n";
    return { from, to, insert, anchor: from + insert.length };
  }

  let before: string;
  let after: string;
  let fallback: string;

  if (action === "codeBlock") {
    before = `\n\`\`\`${request.codeBlockLanguage ?? "text"}\n`;
    after = "\n```\n";
    fallback = "code";
  } else if (action === "math" && selected.includes("\n")) {
    before = "\n$$\n";
    after = "\n$$\n";
    fallback = "formula";
  } else {
    const wrappers = {
      bold: { before: "**", after: "**", fallback: "bold text" },
      italic: { before: "_", after: "_", fallback: "italic text" },
      link: { before: "[", after: "](url)", fallback: "link text" },
      image: { before: "![", after: "](url)", fallback: "image description" },
      inlineCode: { before: "`", after: "`", fallback: "code" },
      math: { before: "$", after: "$", fallback: "formula" }
    }[action];
    before = wrappers.before;
    after = wrappers.after;
    fallback = wrappers.fallback;
  }

  const insert = before + (selected || fallback) + after;
  return {
    from,
    to,
    insert,
    anchor: selected ? from + insert.length : from + before.length
  };
}
