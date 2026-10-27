"use client";

import { useState, useSyncExternalStore } from "react";

export const DEFAULT_SIDEBAR_WIDTH = 272;
export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 480;
const storageKey = "mdez-sidebar-width";

export function normalizeSidebarWidth(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.round(value)))
    : DEFAULT_SIDEBAR_WIDTH;
}

function readStoredWidth() {
  try { return normalizeSidebarWidth(JSON.parse(window.localStorage.getItem(storageKey) ?? "null")); }
  catch { return DEFAULT_SIDEBAR_WIDTH; }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const serverWidth = () => DEFAULT_SIDEBAR_WIDTH;

export function useSidebarWidth() {
  const storedWidth = useSyncExternalStore(subscribe, readStoredWidth, serverWidth);
  const [sessionWidth, setSessionWidth] = useState<number | null>(null);

  function updateWidth(value: number) {
    const nextWidth = normalizeSidebarWidth(value);
    setSessionWidth(nextWidth);
    try { window.localStorage.setItem(storageKey, JSON.stringify(nextWidth)); }
    catch { /* Keep the width in memory when storage is unavailable. */ }
  }

  return { width: sessionWidth ?? storedWidth, updateWidth };
}
