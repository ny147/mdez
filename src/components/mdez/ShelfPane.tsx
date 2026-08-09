"use client";

import { BookOpen, Download, FilePlus, Upload } from "lucide-react";

import { formatRelativeTime } from "@/lib/relative-time";
import type { Document, Folder } from "@/types/content";

type ShelfPaneProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onSelectDocument: (documentId: string) => void;
  onCreateDocument: () => void;
  onCreateFolder: (parentId: string | null) => void;
  onOpenImport: () => void;
  onExportFolder: () => void;
};

function getBookPageCount(documents: Document[], folderId: string) {
  return documents.filter((document) => document.folderId === folderId).length;
}

export function ShelfPane({
  folders,
  documents,
  selectedFolderId,
  selectedDocumentId,
  onSelectFolder,
  onSelectDocument,
  onCreateDocument,
  onCreateFolder,
  onOpenImport,
  onExportFolder
}: ShelfPaneProps) {
  const sortedFolders = folders.filter((folder) => folder.parentId === null).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const openBook = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const rootPageCount = documents.filter((document) => document.folderId === null).length;
  const visiblePages = documents
    .filter((document) => (openBook ? document.folderId === openBook.id : true))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);
  const createPageLabel = openBook ? `Create page in ${openBook.name}` : "Create page";
  return (
    <div className="grid min-h-0 flex-1 gap-5 overflow-hidden">
      <section className="workspace-section min-w-0" aria-labelledby="bookshelf-title">
        <div className="shelf-section-header mb-4">
          <div>
            <h2 id="bookshelf-title" className="workspace-section-title">Books</h2>
            <span className="shelf-section-count text-xs font-bold text-muted">
              {sortedFolders.length} {sortedFolders.length === 1 ? "book" : "books"}
            </span>
          </div>
          <div className="shelf-section-actions">
            <button
              type="button"
              onClick={onExportFolder}
              disabled={!openBook}
              aria-label="Book ZIP for open book in Shelf"
              title={openBook ? `Download ${openBook.name} as a folder ZIP` : "Open a book before exporting its folder ZIP"}
              className="secondary-button px-4 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Book ZIP
            </button>
            <button type="button" onClick={() => onCreateFolder(null)} className="secondary-button px-4 py-2 text-sm font-extrabold">
              <BookOpen aria-hidden="true" className="h-4 w-4" />
              New book
            </button>
          </div>
        </div>

        <div className="shelf-book-grid">
          <button
            type="button"
            aria-label={`Shelf root, ${rootPageCount} ${rootPageCount === 1 ? "page" : "pages"}, ${selectedFolderId === null ? "open" : "closed"}`}
            aria-pressed={selectedFolderId === null}
            onClick={() => onSelectFolder(null)}
            className={`shelf-book-tile ${selectedFolderId === null ? "is-open" : ""}`}
          >
            <span className="shelf-book-title">Shelf root</span>
            <span className="shelf-book-meta">{rootPageCount} {rootPageCount === 1 ? "page" : "pages"}</span>
            <span className="shelf-book-state">{selectedFolderId === null ? "Currently open" : "Open shelf"}</span>
          </button>
          {sortedFolders.map((folder) => {
            const pageCount = getBookPageCount(documents, folder.id);
            const isOpen = selectedFolderId === folder.id;

            return (
              <button
                key={folder.id}
                type="button"
                aria-label={`${folder.name} book, ${pageCount} ${pageCount === 1 ? "page" : "pages"}, ${isOpen ? "open" : "closed"}`}
                aria-pressed={isOpen}
                aria-expanded={isOpen}
                onClick={() => onSelectFolder(folder.id)}
                className={`shelf-book-tile ${isOpen ? "is-open" : ""}`}
              >
                <span className="shelf-book-title">{folder.name}</span>
                <span className="shelf-book-meta">{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
                <span className="shelf-book-state">{isOpen ? "Currently open" : "Open book"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="workspace-section min-h-0 overflow-hidden" aria-labelledby="recent-pages-title">
        <div className="shelf-section-header mb-4">
          <div>
            <h2 id="recent-pages-title" className="workspace-section-title">Recent pages</h2>
            {openBook ? <span className="text-sm font-semibold text-muted">{openBook.name}</span> : null}
          </div>
          <div className="shelf-section-actions">
            <button type="button" onClick={onOpenImport} aria-label="Import markdown" className="secondary-button px-4 py-2 text-sm font-extrabold">
              <Upload aria-hidden="true" className="h-4 w-4" />
              Import markdown
            </button>
            <button type="button" onClick={onCreateDocument} aria-label={createPageLabel} className="primary-button px-4 py-2">
              <FilePlus aria-hidden="true" className="h-4 w-4" />
              Create page
            </button>
          </div>
        </div>

        {visiblePages.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-panel p-6 text-center">
            <p className="font-semibold text-muted">
              {openBook ? "This book has no pages yet." : "Create a page or import markdown to start the local library."}
            </p>
          </div>
        ) : (
          <ul className="recent-page-grid" aria-label="Recent pages">
            {visiblePages.map((document) => {
              const parentBook = folders.find((folder) => folder.id === document.folderId)?.name ?? "Shelf root";
              const updated = formatRelativeTime(document.updatedAt);

              return (
                <li key={document.id} className="recent-page-item">
                  <button
                    type="button"
                    aria-label={`${document.title} page in ${parentBook}, updated ${updated}`}
                    aria-pressed={selectedDocumentId === document.id}
                    onClick={() => onSelectDocument(document.id)}
                    className={`recent-page-card dogear-card ${selectedDocumentId === document.id ? "is-selected" : ""}`}
                  >
                    <span className="recent-page-title">{document.title}</span>
                    <span className="recent-page-location">{parentBook}</span>
                    <span className="recent-page-updated-label">Updated {updated}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
