"use client";

import { createContext, type KeyboardEvent, type ReactNode, type RefObject, useContext, useEffect, useRef } from "react";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/IconButton";

type ImportDialogShellProps = {
  labelledBy: string;
  initialFocusRef: RefObject<HTMLElement | null>;
  returnFocus: () => void;
  onClose: () => void;
  children: ReactNode;
};

const ImportDialogBusyContext = createContext(false);

export function ImportDialogBusyProvider({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <ImportDialogBusyContext.Provider value={busy}>{children}</ImportDialogBusyContext.Provider>;
}

export function ImportDialogShell({
  labelledBy,
  initialFocusRef,
  returnFocus,
  onClose,
  children
}: ImportDialogShellProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const busy = useContext(ImportDialogBusyContext);

  useEffect(() => {
    initialFocusRef.current?.focus();

    return returnFocus;
  }, [initialFocusRef, returnFocus]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter((element) => !element.hasAttribute("aria-hidden") && !element.closest("[hidden]"));

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={handleDialogKeyDown}
        className="floating-surface max-h-full w-full max-w-2xl overflow-y-auto p-4 text-ink sm:p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="field-label">Import Markdown</p>
            <h2 id={labelledBy} className="mt-1 font-display text-2xl font-black text-ink sm:text-3xl">
              Add Markdown to your library
            </h2>
          </div>
          <IconButton label="Close import dialog" onClick={onClose} disabled={busy}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </div>

        {children}
      </section>
    </div>
  );
}
