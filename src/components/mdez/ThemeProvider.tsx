"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { initializeTheme, parseThemePreference, themeStorageKey, type ResolvedTheme, type ThemePreference } from "@/lib/theme";

type ThemeState = { preference: ThemePreference; resolvedTheme: ResolvedTheme };
type ThemeContextValue = ThemeState & { setPreference: (preference: ThemePreference) => void };

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system", resolvedTheme: "light", setPreference: () => {}
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ThemeState>({ preference: "system", resolvedTheme: "light" });

  const applyPreference = useCallback((preference: ThemePreference) => {
    const resolvedTheme = preference === "system"
      ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    document.documentElement.dataset.theme = resolvedTheme;
    setState({ preference, resolvedTheme });
  }, []);

  useEffect(() => {
    setState(initializeTheme());
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onDeviceChange = () => {
      setState((current) => {
        if (current.preference !== "system") return current;
        const resolvedTheme = media?.matches ? "dark" : "light";
        document.documentElement.dataset.theme = resolvedTheme;
        return { preference: "system", resolvedTheme };
      });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== themeStorageKey && event.key !== null) return;
      // Ignore same-named values in sessionStorage.
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { return; }
      applyPreference(parseThemePreference(event.newValue));
    };
    media?.addEventListener("change", onDeviceChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener("change", onDeviceChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [applyPreference]);

  const setPreference = useCallback((preference: ThemePreference) => {
    applyPreference(preference);
    try { window.localStorage.setItem(themeStorageKey, preference); } catch { /* Keep the session choice usable. */ }
  }, [applyPreference]);

  return <ThemeContext.Provider value={{ ...state, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
