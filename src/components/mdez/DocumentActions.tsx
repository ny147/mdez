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
    <details className="page-actions">
      <summary
        role="button"
        aria-label={`Manage ${document.title}`}
        title="Page actions"
        className="page-actions-trigger"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </summary>
      <div className="page-actions-panel">
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
