"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { WORKSPACE_COPY } from "@/lib/workspace-copy";

type DocumentActionsProps = {
  document: Document;
  folders: Folder[];
  onRename: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
};

export function DocumentActions({ document, folders, onRename, onMove, onDelete }: DocumentActionsProps) {
  const sortedFolders = folders
    .slice()
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return (
    <details className="page-actions mt-2 rounded border bg-panel">
      <summary
        role="button"
        aria-label={`Manage ${document.title}`}
        className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-ink"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        Manage page
      </summary>
      <div className="grid gap-2 border-t border-border p-2">
        <button
          type="button"
          onClick={onRename}
          aria-label={`Rename ${document.title}`}
          className="secondary-button px-3 py-2 text-xs"
        >
          Rename page
        </button>
        <label className="grid gap-1 text-xs font-bold text-muted">
          Move page to
          <select
            value={document.folderId ?? ""}
            onChange={(event) => onMove(event.currentTarget.value || null)}
            aria-label={`Move ${document.title} page`}
            className="workspace-input min-w-0 px-2 py-2 text-xs"
          >
            <option value="">{WORKSPACE_COPY.pagesWithoutBook}</option>
            {sortedFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${document.title}`}
          className="secondary-button px-3 py-2 text-xs text-accent-files"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Delete page
        </button>
      </div>
    </details>
  );
}
