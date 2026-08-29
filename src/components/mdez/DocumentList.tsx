"use client";

import { FilePlus } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { DocumentActions } from "@/components/mdez/DocumentActions";
import { formatRelativeTime, WORKSPACE_COPY } from "@/lib/workspace-copy";

type DocumentListProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onCreateDocument: () => void;
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
  onCreateDocument,
  onRenameDocument,
  onMoveDocument,
  onDeleteDocument
}: DocumentListProps) {
  const visibleDocuments = documents
    .filter((document) => document.folderId === selectedFolderId)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const selectedBook = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const createPageLabel = selectedBook ? `Create page in ${selectedBook.name}` : "Create page";

  function renameDocument(document: Document) {
    const nextTitle = window.prompt("Rename page", document.title);

    if (nextTitle !== null) {
      onRenameDocument(document.id, nextTitle);
    }
  }

  return (
    <section className="min-h-0">
      <div className="sidebar-section-heading">
        <h3 className="min-w-0 truncate font-display text-sm font-black text-ink">
          {selectedBook?.name ?? WORKSPACE_COPY.pagesWithoutBook}
        </h3>
        <button
          type="button"
          data-visual-priority="secondary"
          onClick={onCreateDocument}
          aria-label={createPageLabel}
          title={createPageLabel}
          className="workspace-icon-button shrink-0"
        >
          <FilePlus aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {visibleDocuments.length === 0 ? (
        <div className="rounded border border-border bg-panel p-3">
          <p className="text-sm font-semibold leading-6 text-muted">
            {selectedBook
              ? `Create a page in ${selectedBook.name} or import Markdown here.`
              : "Create a page here or import Markdown. You can move it into a book later."}
          </p>
        </div>
      ) : (
        <div className="sidebar-page-list">
          {visibleDocuments.map((document) => (
            <article
              key={document.id}
              aria-label={document.title}
              data-selected={selectedDocumentId === document.id}
              className="sidebar-page-row"
            >
              <button
                type="button"
                onClick={() => onSelectDocument(document.id)}
                aria-pressed={selectedDocumentId === document.id}
                className="sidebar-page-open"
              >
                <span className="page-title-clamp font-display text-sm font-black" title={document.title}>
                  {document.title}
                </span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-muted">
                  Updated {formatRelativeTime(document.updatedAt)}
                </span>
              </button>

              <DocumentActions
                document={document}
                folders={folders}
                onRename={() => renameDocument(document)}
                onMove={(folderId) => onMoveDocument(document.id, folderId)}
                onDelete={() => onDeleteDocument(document.id)}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
