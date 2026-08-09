"use client";

import { X } from "lucide-react";
import React, {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef
} from "react";

import { IconButton } from "@/components/ui/IconButton";

type ModalDialogProps = {
  title: string;
  titleId: string;
  label?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
};

const focusableSelector = [
  "button:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

export function ModalDialog({
  title,
  titleId,
  label,
  closeLabel,
  onClose,
  children
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const initial = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")
      ?? dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
    initial?.focus();
    return () => returnFocusRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
    ).filter((element) => !element.closest("[hidden]"));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="floating-surface max-h-full w-full max-w-2xl overflow-y-auto p-4 text-ink sm:p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="min-w-0">
            {label ? <p className="field-label">{label}</p> : null}
            <h2 id={titleId} className="mt-1 text-wrap-balance font-display text-2xl font-black text-ink sm:text-3xl">
              {title}
            </h2>
          </div>
          <IconButton label={closeLabel} onClick={onClose}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}
