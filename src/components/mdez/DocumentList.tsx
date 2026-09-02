"use client";

import React from "react";
import { FilePlus, FileText } from "lucide-react";

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
  onRequestRenameDocument: (documentId: string) => void;
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
  onRequestRenameDocument,
  onMoveDocument,
  onDeleteDocument
}: DocumentListProps) {
  const visibleDocuments = documents
    .filter((document) => document.folderId === selectedFolderId)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const selectedBook = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const contextName = selectedBook?.name ?? WORKSPACE_COPY.pagesWithoutBook;
  const createPageLabel = selectedBook ? `Create page in ${selectedBook.name}` : "Create page";

  return (
    <section className="sidebar-section" aria-labelledby="sidebar-pages-heading">
      <div className="sidebar-section-header">
        <div className="sidebar-section-heading">
          <h3 id="sidebar-pages-heading">Pages</h3>
          <span className="sidebar-section-count">{visibleDocuments.length} {visibleDocuments.length === 1 ? "page" : "pages"}</span>
        </div>
        <button type="button" onClick={onCreateDocument} aria-label={createPageLabel} className="sidebar-header-action">
          <FilePlus aria-hidden="true" className="h-4 w-4" />
          <span>{visibleDocuments.length === 0 && selectedBook ? "Add first page" : "Create page"}</span>
        </button>
      </div>

      {visibleDocuments.length === 0 ? (
        <div className="sidebar-empty-state">
          <strong>{selectedBook ? `No pages in ${selectedBook.name} yet` : "No pages here yet"}</strong>
          <span>{selectedBook ? "Add the first page to start writing." : "Create a page or import Markdown from the Shelf."}</span>
        </div>
      ) : (
        <ul className="sidebar-page-list" aria-label={`Pages in ${contextName}`}>
          {visibleDocuments.map((document) => {
            const isSelected = selectedDocumentId === document.id;
            const absoluteDate = Number.isNaN(Date.parse(document.updatedAt))
              ? "Recently updated"
              : new Date(document.updatedAt).toLocaleString();
            return (
              <li key={document.id} className="sidebar-page-row" data-selected={isSelected}>
                <FileText aria-hidden="true" className="sidebar-page-icon" />
                <button
                  type="button"
                  onClick={() => onSelectDocument(document.id)}
                  aria-label={`Open ${document.title}`}
                  aria-current={isSelected ? "page" : undefined}
                  className="sidebar-page-select"
                >
                  <span className="sidebar-item-title" title={document.title}>{document.title}</span>
                  <time dateTime={document.updatedAt} title={absoluteDate}>Updated {formatRelativeTime(document.updatedAt)}</time>
                </button>
                <DocumentActions
                  document={document}
                  folders={folders}
                  onRename={() => onRequestRenameDocument(document.id)}
                  onMove={(folderId) => onMoveDocument(document.id, folderId)}
                  onDelete={() => onDeleteDocument(document.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
