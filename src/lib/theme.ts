export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const themeStorageKey = "mdez-theme";

export function parseThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Keep this function self-contained: the same code runs in the document head
// before React hydrates, without access to module imports or closures.
export function initializeTheme(): { preference: ThemePreference; resolvedTheme: ResolvedTheme } {
  let preference: ThemePreference = "system";
  try {
    const saved = window.localStorage.getItem("mdez-theme");
    if (saved === "light" || saved === "dark") preference = saved;
  } catch { /* Restricted storage keeps the device default. */ }
  const resolvedTheme = preference === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
  document.documentElement.dataset.theme = resolvedTheme;
  return { preference, resolvedTheme };
}

export const themeScript = `(${initializeTheme.toString()})()`;
