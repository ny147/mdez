"use client";

import { FileText, Star } from "lucide-react";
import React from "react";
import { getBookPath } from "@/lib/library-view";
import { formatRelativeTime } from "@/lib/workspace-copy";
import type { Document, Folder } from "@/types/content";

type LibraryPageListProps = {
  documents: Document[];
  folders: Folder[];
  bookmarkedIds: ReadonlySet<string>;
  selectedDocumentId?: string | null;
  onSelectDocument: (documentId: string) => void;
  onToggleBookmark: (documentId: string) => void;
};

export function LibraryPageList({ documents, folders, bookmarkedIds, selectedDocumentId, onSelectDocument, onToggleBookmark }: LibraryPageListProps) {
  return (
    <ul className="library-page-list" aria-label="Library pages">
      {documents.map((document) => {
        const bookmarked = bookmarkedIds.has(document.id);
        const bookPath = getBookPath(document.folderId, folders);
        return (
          <li key={document.id} className="library-page-row" data-selected={selectedDocumentId === document.id}>
            <button type="button" className="library-page-open" aria-label={`Open ${document.title}`} onClick={() => onSelectDocument(document.id)}>
              <span className="library-page-icon"><FileText aria-hidden="true" /></span>
              <span className="library-page-copy">
                <strong title={document.title}>{document.title}</strong>
                <small>{bookPath}</small>
              </span>
            </button>
            <span className="library-page-updated">{formatRelativeTime(document.updatedAt)}</span>
            <button
              type="button"
              className="library-bookmark-button"
              aria-label={`${bookmarked ? "Remove bookmark from" : "Bookmark"} ${document.title}`}
              aria-pressed={bookmarked}
              onClick={() => onToggleBookmark(document.id)}
            >
              <Star aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
