"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/mdez/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor }
];

export function ThemeControl({ onOpen }: { onOpen?: () => void } = {}) {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const Icon = preference === "system" ? Monitor : preference === "dark" ? Moon : Sun;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div ref={root} className="theme-control" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={(event) => {
      if (open && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }}>
      <button ref={trigger} type="button" className="workspace-icon-button theme-trigger" aria-label="Theme"
        title="Theme" aria-expanded={open} aria-controls={id} onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}>
        <Icon aria-hidden="true" className="h-4 w-4" />
      </button>
      {open ? <fieldset id={id} className="theme-options">
        <legend className="sr-only">Appearance</legend>
        <span className="theme-options-title" aria-hidden="true">Appearance</span>
        {options.map(({ value, label, icon: OptionIcon }) => (
          <label key={value} className="theme-option">
            <OptionIcon aria-hidden="true" className="h-4 w-4" />
            <span>{label}</span>
            <input type="radio" name={`theme-${id}`} value={value} checked={preference === value}
              onChange={() => setPreference(value)} />
          </label>
        ))}
      </fieldset> : null}
    </div>
  );
}
