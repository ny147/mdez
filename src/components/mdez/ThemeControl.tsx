"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/mdez/ThemeProvider";

export function ThemeControl({ onToggle }: { onToggle?: () => void } = {}) {
  const { resolvedTheme, setPreference } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const label = `Switch to ${nextTheme} mode`;
  const Icon = nextTheme === "light" ? Sun : Moon;

  return (
    <button type="button" className="workspace-icon-button theme-trigger" aria-label={label} title={label}
      onClick={() => {
        onToggle?.();
        setPreference(nextTheme);
      }}>
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
