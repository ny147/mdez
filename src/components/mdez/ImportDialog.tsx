"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import type { Folder } from "@/types/content";
import { fileNameToTitle, isMarkdownFile, MAX_MARKDOWN_FILE_BYTES, titleFromBody } from "@/lib/markdown";
import { IconButton } from "@/components/ui/IconButton";

type ImportItem = { title: string; body: string };

type ImportDialogProps = {
  folders: Folder[];
  selectedFolderId: string | null;
  onClose: () => void;
  onImport: (items: ImportItem[], folderId: string | null) => Promise<void>;
};

export function ImportDialog({ folders, selectedFolderId, onClose, onImport }: ImportDialogProps) {
  const [pasteBody, setPasteBody] = useState("");
  const [targetFolderId, setTargetFolderId] = useState<string | null>(selectedFolderId);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const previousElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    pasteRef.current?.focus();

    return () => {
      previousElement?.focus();
    };
  }, []);

  function closeDialog() {
    if (!busy) {
      onClose();
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      if (!busy) {
        onClose();
      }

      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter((element) => !element.hasAttribute("aria-hidden"));

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

  async function submitPaste() {
    if (busy) {
      return;
    }

    if (pasteBody.trim() === "") {
      setMessage("Paste markdown content before importing.");
      return;
    }

    setBusy(true);

    try {
      await onImport([{ title: titleFromBody(pasteBody), body: pasteBody }], targetFolderId);
      setBusy(false);
      onClose();
    } catch {
      setMessage("Mdez could not import markdown.");
      setBusy(false);
    }
  }

  async function importFiles(files: FileList | File[]) {
    if (busy) {
      return;
    }

    setBusy(true);
    const items: ImportItem[] = [];

    for (const file of Array.from(files)) {
      if (!isMarkdownFile(file)) {
        setMessage("Choose a .md file.");
        setBusy(false);
        return;
      }

      if (file.size > MAX_MARKDOWN_FILE_BYTES) {
        const warning = `${file.name} is larger than 5 MB. Import it only if your browser has enough memory.`;

        setMessage(warning);

        if (!window.confirm(warning)) {
          setBusy(false);
          return;
        }
      }

      try {
        const body = await file.text();
        items.push({ title: fileNameToTitle(file.name), body });
      } catch {
        setMessage(`Mdez could not read ${file.name}.`);
        setBusy(false);
        return;
      }
    }

    if (items.length === 0) {
      setBusy(false);
      return;
    }

    try {
      await onImport(items, targetFolderId);
      setBusy(false);
      onClose();
    } catch {
      setMessage("Mdez could not import markdown.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-6 backdrop-blur-sm">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onKeyDown={handleDialogKeyDown}
        className="library-panel max-h-full w-full max-w-2xl overflow-y-auto rounded-md p-5 text-ink sm:p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="field-label">Import markdown</p>
            <h2 id="import-title" className="mt-1 font-display text-3xl font-black text-ink">
              Bring notes into Mdez
            </h2>
          </div>
          <IconButton label="Close import dialog" onClick={closeDialog} disabled={busy}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </div>

        <div className="mt-5 grid gap-5">
          <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="import-target-folder">
            Target book
            <select
              id="import-target-folder"
              value={targetFolderId ?? ""}
              onChange={(event) => setTargetFolderId(event.currentTarget.value === "" ? null : event.currentTarget.value)}
              disabled={busy}
              className="workspace-input px-4 py-3 text-sm font-bold focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Shelf root</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="import-paste">
            Paste markdown
            <textarea
              ref={pasteRef}
              id="import-paste"
              value={pasteBody}
              onChange={(event) => setPasteBody(event.currentTarget.value)}
              disabled={busy}
              className="workspace-input min-h-48 resize-y p-4 font-mono text-sm leading-6 placeholder:text-ink-muted/70 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="# Meeting notes"
            />
          </label>

          <label
            data-drop-state={isDragging ? "active" : "idle"}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded border border-dashed border-border bg-panel px-4 py-8 text-center transition hover:border-accent hover:bg-surface-2 ${isDragging ? "border-accent bg-surface-2" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void importFiles(event.dataTransfer.files);
            }}
          >
            <span className="text-sm font-black text-accent-read">Drop markdown files here</span>
            <span className="primary-button px-4 py-2">
              Choose .md files
            </span>
            <input
              className="sr-only"
              type="file"
              aria-label="Choose markdown files"
              accept=".md,.markdown,text/markdown"
              multiple
              disabled={busy}
              onChange={(event) => {
                if (event.currentTarget.files) {
                  void importFiles(event.currentTarget.files);
                }

                event.currentTarget.value = "";
              }}
            />
          </label>

          {message ? (
            <p role="alert" className="rounded border border-accent-files/40 bg-panel px-4 py-3 text-sm font-bold text-ink">
              {message}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closeDialog}
            disabled={busy}
            className="secondary-button px-5 py-3 text-sm font-black focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submitPaste()}
            disabled={busy}
            className="primary-button px-5 py-3 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Importing..." : "Import Paste"}
          </button>
        </div>
      </section>
    </div>
  );
}
