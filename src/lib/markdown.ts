export const MAX_MARKDOWN_FILE_BYTES = 5 * 1024 * 1024;

export function fileNameToTitle(fileName: string) {
  return fileName.replace(/\.(md|markdown)$/i, "").trim() || "Untitled Document";
}

export function titleFromBody(body: string) {
  const heading = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line));

  return heading?.replace(/^#\s+/, "").trim() || "Untitled Document";
}

export function slugifyTitle(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled-document";
}

export function makeMarkdownFileName(title: string) {
  return `${slugifyTitle(title)}.md`;
}

export function isMarkdownFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown") || file.type === "text/markdown";
}
