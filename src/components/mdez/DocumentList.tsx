"use client";

import { FileText } from "lucide-react";

import { formatRelativeTime } from "@/lib/relative-time";
import type { Document, Folder } from "@/types/content";
import { RowActionsPopover } from "@/components/ui/RowActionsPopover";

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
    <section className="sidebar-group min-h-0">
      <div className="sidebar-group-heading">
        <h3 className="font-display text-sm font-black text-ink">Pages</h3>
        <span>{visibleDocuments.length}</span>
      </div>

      {visibleDocuments.length === 0 ? (
        <p className="sidebar-empty-copy text-sm font-semibold leading-6 text-muted">
          {selectedBook ? `No pages in ${selectedBook.name}.` : "No loose pages on Shelf root."}
        </p>
      ) : (
        <div className="sidebar-group-list">
          {visibleDocuments.map((document) => (
            <article
              key={document.id}
              className={`sidebar-row sidebar-page-row ${selectedDocumentId === document.id ? "is-selected" : ""}`}
            >
              <button
                type="button"
                onClick={() => onSelectDocument(document.id)}
                aria-pressed={selectedDocumentId === document.id}
                className="sidebar-row-main"
              >
                <FileText aria-hidden="true" className="sidebar-row-icon" />
                <span className="sidebar-row-copy">
                  <span className="sidebar-row-title">{document.title}</span>
                  <span className="sidebar-row-meta document-updated-label">Updated {formatRelativeTime(document.updatedAt)}</span>
                </span>
              </button>

              <RowActionsPopover label={`More actions for ${document.title}`} selected={selectedDocumentId === document.id}>
                <button
                  data-row-action
                  type="button"
                  onClick={() => renameDocument(document)}
                  className="row-actions-item"
                  aria-label={`Rename ${document.title}`}
                >
                  Rename page
                </button>

                <label className="row-actions-field">
                  <span>Move page</span>
                  <select
                    value={document.folderId ?? ""}
                    onChange={(event) => onMoveDocument(document.id, event.target.value || null)}
                    aria-label={`Move ${document.title} page`}
                    className="workspace-input"
                  >
                    <option value="">Shelf root</option>
                    {folders
                      .slice()
                      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
                      .map((folder) => (
                        <option key={folder.id} value={folder.id}>{folder.name}</option>
                      ))}
                  </select>
                </label>

                <button data-row-action type="button" onClick={() => onDeleteDocument(document.id)} aria-label={`Delete ${document.title}`} className="row-actions-item row-actions-item-destructive">Delete page</button>
              </RowActionsPopover>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
