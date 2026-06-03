"use client";

import { useState } from "react";
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

    const items: ImportItem[] = [];

    for (const file of Array.from(files)) {
      if (!isMarkdownFile(file)) {
        setMessage(`${file.name} is not a supported markdown file.`);
        return;
      }

      if (file.size > MAX_MARKDOWN_FILE_BYTES) {
        setMessage(`${file.name} is larger than 5 MB. Import it only if your browser has enough memory.`);
      }

      try {
        const body = await file.text();
        items.push({ title: fileNameToTitle(file.name), body });
      } catch {
        setMessage(`Mdez could not read ${file.name}.`);
        return;
      }
    }

    if (items.length === 0) {
      return;
    }

    setBusy(true);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 px-4 py-6 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-[2rem] border-2 border-white/80 bg-abyss p-5 text-cream shadow-sticker sm:p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-white/30 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ice">Import markdown</p>
            <h2 id="import-title" className="mt-1 text-3xl font-black text-bubble">
              Bring notes into Mdez
            </h2>
          </div>
          <IconButton label="Close import dialog" onClick={onClose} disabled={busy}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </div>

        <div className="mt-5 grid gap-5">
          <label className="grid gap-2 text-sm font-bold text-cream" htmlFor="import-target-folder">
            Target folder
            <select
              id="import-target-folder"
              value={targetFolderId ?? ""}
              onChange={(event) => setTargetFolderId(event.currentTarget.value === "" ? null : event.currentTarget.value)}
              disabled={busy}
              className="rounded-2xl border-2 border-white/60 bg-white px-4 py-3 text-sm font-bold text-abyss outline-none transition focus:border-ice focus:ring-4 focus:ring-ice/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Root</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-cream" htmlFor="import-paste">
            Paste markdown
            <textarea
              id="import-paste"
              value={pasteBody}
              onChange={(event) => setPasteBody(event.currentTarget.value)}
              disabled={busy}
              className="min-h-48 resize-y rounded-[1.5rem] border-2 border-white/60 bg-white p-4 font-mono text-sm leading-6 text-abyss outline-none transition placeholder:text-abyss/45 focus:border-ice focus:ring-4 focus:ring-ice/25 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="# Meeting notes"
            />
          </label>

          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed border-white/50 bg-white/10 px-4 py-8 text-center transition hover:border-ice hover:bg-ice/10"
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              void importFiles(event.dataTransfer.files);
            }}
          >
            <span className="text-sm font-black uppercase tracking-[0.14em] text-mint">Drop markdown files here</span>
            <span className="rounded-full border-2 border-white/70 bg-white px-4 py-2 text-sm font-black text-abyss shadow-glow">
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
            <p role="alert" className="rounded-2xl border-2 border-bubble/60 bg-bubble/15 px-4 py-3 text-sm font-bold text-cream">
              {message}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t-2 border-white/30 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border-2 border-white/60 px-5 py-3 text-sm font-black text-cream transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submitPaste()}
            disabled={busy}
            className="rounded-full border-2 border-mint bg-mint px-5 py-3 text-sm font-black text-abyss shadow-glow transition hover:bg-ice disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Importing..." : "Import Paste"}
          </button>
        </div>
      </section>
    </div>
  );
}
