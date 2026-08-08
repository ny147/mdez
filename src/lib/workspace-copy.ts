export const WORKSPACE_COPY = {
  library: "Library",
  books: "Books",
  pagesWithoutBook: "Pages without a book",
  recentPages: "Recent pages",
  importMarkdown: "Import Markdown"
} as const;

export function formatRelativeTime(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return "Recently updated";
  }

  const minutes = Math.max(1, Math.round((now - timestamp) / 60_000));

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function getBookExportCopy(bookName: string | null) {
  return bookName
    ? {
        label: `Export ${bookName} (.zip)`,
        hint: `Downloads the Markdown pages and metadata in ${bookName}.`,
        disabled: false
      }
    : {
        label: "Export book (.zip)",
        hint: "Open a book to export its Markdown pages and metadata.",
        disabled: true
      };
}
