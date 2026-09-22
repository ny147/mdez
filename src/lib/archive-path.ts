const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;

export function splitSafeArchivePath(path: string): string[] {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    /^[A-Za-z]:\//.test(path) ||
    path.includes("\\") ||
    CONTROL_CHARACTER.test(path)
  ) {
    throw new Error("Unsafe archive path.");
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error("Unsafe archive path.");
  }

  return segments;
}
