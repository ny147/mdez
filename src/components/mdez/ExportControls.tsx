"use client";

import { Download } from "lucide-react";

import type { Document } from "@/types/content";
import { getDocumentExportName } from "@/lib/export";

type ExportControlsProps = {
  selectedDocument: Document | null;
  onError: (message: string | null) => void;
  onSuccess: (message: string) => void;
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

export function ExportControls({ selectedDocument, onError, onSuccess }: ExportControlsProps) {
  function exportDocument() {
    if (!selectedDocument) {
      onError("Select a page before exporting markdown.");
      return;
    }

    const fileName = getDocumentExportName(selectedDocument);

    downloadBlob(new Blob([selectedDocument.body], { type: "text/markdown;charset=utf-8" }), fileName);
    onError(null);
    onSuccess(`Downloaded ${fileName}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={exportDocument}
        className="secondary-button inline-flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-sm font-black focus:outline-none focus:ring-2 focus:ring-accent active:scale-[0.98]"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        Export .md
      </button>
    </div>
  );
}
