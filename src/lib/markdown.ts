export const MAX_MARKDOWN_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_MARKDOWN_FILE_SLUG_LENGTH = 80;

export function fileNameToTitle(fileName: string) {
  return fileName.replace(/\.(md|markdown)$/i, "").trim() || "untitled.md";
}

export function titleFromBody(body: string) {
  const heading = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#{1,6}\s+/.test(line));

  return heading?.replace(/^#{1,6}\s+/, "").trim() || "untitled.md";
}

export function slugifyTitle(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_MARKDOWN_FILE_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || "untitled";
}

export function makeMarkdownFileName(title: string) {
  return `${slugifyTitle(title)}.md`;
}

export function isMarkdownFile(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return (
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    type === "text/markdown" ||
    type === "text/x-markdown"
  );
}
