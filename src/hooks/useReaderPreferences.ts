"use client";

import { useEffect, useState } from "react";

export type ReaderPreferences = {
  fontSize: number;
  readWidth: number;
  splitPosition: number;
};

export const defaultReaderPreferences: ReaderPreferences = { fontSize: 16, readWidth: 720, splitPosition: 50 };
const storageKey = "mdez-reader-preferences";

function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
}

function normalize(value: Partial<ReaderPreferences>): ReaderPreferences {
  return {
    fontSize: bounded(value.fontSize, 16, 12, 28),
    readWidth: bounded(value.readWidth, 720, 320, 1440),
    splitPosition: bounded(value.splitPosition, 50, 30, 70)
  };
}

export function useReaderPreferences() {
  const [preferences, setPreferences] = useState(defaultReaderPreferences);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        setPreferences(normalize(saved));
      }
    } catch { /* Reading controls still work when storage is unavailable. */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(preferences)); }
    catch { /* Keep the current settings in memory. */ }
  }, [preferences, loaded]);

  function updatePreferences(patch: Partial<ReaderPreferences>) {
    setPreferences((previous) => normalize({ ...previous, ...patch }));
  }

  return { preferences, updatePreferences, resetPreferences: () => setPreferences(defaultReaderPreferences) };
}
