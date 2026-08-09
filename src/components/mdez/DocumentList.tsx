"use client";

import { Trash2 } from "lucide-react";

import { formatRelativeTime } from "@/lib/relative-time";
import type { Document, Folder } from "@/types/content";
import { IconButton } from "@/components/ui/IconButton";

type DocumentListProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onRenameDocument: (documentId: string, title: string) => void;
  onMoveDocument: (documentId: string, folderId: string | null) => void;
  onDeleteDocument: (documentId: string) => void;
};

export function DocumentList({
  folders,
  documents,
  selectedFolderId,
  selectedDocumentId,
  onSelectDocument,
  onRenameDocument,
  onMoveDocument,
  onDeleteDocument
}: DocumentListProps) {
  const visibleDocuments = documents
    .filter((document) => document.folderId === selectedFolderId)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const selectedBook = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  function renameDocument(document: Document) {
    const nextTitle = window.prompt("Rename page", document.title);

    if (nextTitle !== null) {
      onRenameDocument(document.id, nextTitle);
    }
  }

  return (
    <section className="min-h-0">
      <div className="sidebar-group-heading mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-black text-ink">Pages</h3>
      </div>

      {visibleDocuments.length === 0 ? (
        <p className="sidebar-empty-copy text-sm font-semibold leading-6 text-muted">
          {selectedBook ? `No pages in ${selectedBook.name}.` : "No loose pages on Shelf root."}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleDocuments.map((document) => (
            <article
              key={document.id}
              className="dogear-card rounded border border-border bg-surface p-2 shadow-soft transition hover:border-accent-files"
            >
              <button
                type="button"
                onClick={() => onSelectDocument(document.id)}
                aria-pressed={selectedDocumentId === document.id}
                className={`w-full rounded border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-accent ${
                  selectedDocumentId === document.id
                    ? "border-accent bg-panel text-ink shadow-soft"
                    : "border-transparent text-ink hover:bg-panel"
                }`}
              >
                <span className="block truncate font-display text-sm font-black">{document.title}</span>
                <span className="document-updated-label mt-1 block truncate font-semibold opacity-70">
                  Updated {formatRelativeTime(document.updatedAt)}
                </span>
              </button>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => renameDocument(document)}
                  className="rounded px-2 py-1 text-xs font-black text-muted transition hover:bg-panel hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-files"
                  aria-label={`Rename ${document.title}`}
                  title={`Rename ${document.title}`}
                >
                  Rename
                </button>

                <select
                  value={document.folderId ?? ""}
                  onChange={(event) => onMoveDocument(document.id, event.target.value || null)}
                  aria-label={`Move ${document.title} page`}
                  title={`Move ${document.title} page`}
                  className="workspace-input min-w-0 flex-1 px-2 py-1 font-mono text-xs font-bold focus:ring-0"
                >
                  <option value="">Shelf root</option>
                  {folders
                    .slice()
                    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                </select>

                <IconButton label={`Delete ${document.title}`} onClick={() => onDeleteDocument(document.id)} className="h-8 w-8 border-accent/30">
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
