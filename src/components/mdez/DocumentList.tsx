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
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-black text-ink">Pages</h3>
        <button
          type="button"
          onClick={onCreateDocument}
          aria-label={`${createPageLabel} from page list`}
          className="primary-button min-h-9 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <FilePlus aria-hidden="true" className="h-4 w-4" />
          {createPageLabel}
        </button>
      </div>

      {visibleDocuments.length === 0 ? (
        <div className="rounded border border-border bg-panel p-3">
          <p className="text-sm font-semibold leading-6 text-muted">
            Create a page in {selectedBook ? selectedBook.name : WORKSPACE_COPY.pagesWithoutBook} or import Markdown here.
          </p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={onCreateDocument}
              aria-label={createPageLabel}
              className="primary-button w-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <FilePlus aria-hidden="true" className="h-4 w-4" />
              {createPageLabel}
            </button>
          </div>
        </div>
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
                <span className="mt-1 block truncate text-xs font-semibold opacity-70">
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
