"use client";

import { Download } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { createFolderZipBlob, getDocumentExportName } from "@/lib/export";
import { makeMarkdownFileName } from "@/lib/markdown";

type ExportControlsProps = {
  folders: Folder[];
  documents: Document[];
  selectedDocument: Document | null;
  selectedFolderId: string | null;
  onError: (message: string | null) => void;
};

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ExportControls({ folders, documents, selectedDocument, selectedFolderId, onError }: ExportControlsProps) {
  function exportDocument() {
    if (!selectedDocument) {
      onError("Select a document before exporting markdown.");
      return;
    }

    downloadBlob(new Blob([selectedDocument.body], { type: "text/markdown;charset=utf-8" }), getDocumentExportName(selectedDocument));
    onError(null);
  }

  async function exportFolder() {
    if (!selectedFolderId) {
      onError("Select a folder before exporting a ZIP.");
      return;
    }

    const folder = folders.find((item) => item.id === selectedFolderId);

    if (!folder) {
      onError("Mdez could not find that folder for export.");
      return;
    }

    try {
      const blob = await createFolderZipBlob(folders, documents, selectedFolderId);
      downloadBlob(blob, makeMarkdownFileName(folder.name).replace(/\.md$/, ".zip"));
      onError(null);
    } catch {
      onError("Mdez could not generate the ZIP export.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={exportDocument}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-white/70 bg-white/10 px-3 py-2 text-sm font-black text-cream shadow-glow transition hover:border-white hover:bg-ice/20 focus:outline-none focus:ring-2 focus:ring-ice"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        Document
      </button>
      <button
        type="button"
        onClick={() => void exportFolder()}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-white/70 bg-white/10 px-3 py-2 text-sm font-black text-cream shadow-glow transition hover:border-white hover:bg-ice/20 focus:outline-none focus:ring-2 focus:ring-ice"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        Folder ZIP
      </button>
    </div>
  );
}
