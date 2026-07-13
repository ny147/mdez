"use client";

import { BookOpen, Download, FilePlus, Upload } from "lucide-react";

import type { Document, Folder } from "@/types/content";

type ShelfPaneProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  isReady: boolean;
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

function formatRelativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  return `${Math.round(diffHours / 24)} days ago`;
}

export function ShelfPane({
  folders,
  documents,
  selectedFolderId,
  selectedDocumentId,
  isReady,
  onSelectFolder,
  onSelectDocument,
  onCreateDocument,
  onCreateFolder,
  onOpenImport,
  onExportFolder
}: ShelfPaneProps) {
  const sortedFolders = folders.filter((folder) => folder.parentId === null).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const openBook = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const visiblePages = documents
    .filter((document) => (openBook ? document.folderId === openBook.id : true))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);
  const createPageLabel = openBook ? `Create page in ${openBook.name}` : "Create page";
  const createBookLabel = openBook ? "New book on shelf" : "New book";

  return (
    <div className="grid min-h-0 flex-1 gap-5 overflow-hidden">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold leading-6 text-muted">
            {openBook ? `${openBook.name} is open. Bookmarked pages are filtered to this book.` : "Open a book to focus the shelf."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onCreateDocument} aria-label={createPageLabel} className="primary-button px-4 py-2">
            <FilePlus aria-hidden="true" className="h-4 w-4" />
            {createPageLabel}
          </button>
          <button type="button" onClick={() => onCreateFolder(null)} className="secondary-button px-4 py-2 text-sm font-extrabold">
            <BookOpen aria-hidden="true" className="h-4 w-4" />
            {createBookLabel}
          </button>
          <button type="button" onClick={onOpenImport} aria-label="Import markdown" className="secondary-button px-4 py-2 text-sm font-extrabold">
            <Upload aria-hidden="true" className="h-4 w-4" />
            Import markdown
          </button>
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
        </div>
      </div>

      <section className="min-w-0 rounded-md border border-border bg-surface p-4 shadow-soft" aria-labelledby="bookshelf-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="bookshelf-title" className="font-display text-xl font-black text-ink">
            Bookshelf
          </h2>
          <span className="rounded border border-border bg-panel px-3 py-1 text-xs font-bold text-muted">
            {sortedFolders.length} {sortedFolders.length === 1 ? "book" : "books"}
          </span>
        </div>

        {sortedFolders.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-panel p-6 text-center">
            <p className="font-semibold text-muted">{isReady ? "Create books when this shelf grows." : "Indexing local library..."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-3">
            <div className="flex min-w-max items-end gap-3 border-b-4 border-accent-files/25 px-2 pb-2">
              {sortedFolders.map((folder) => {
                const pageCount = getBookPageCount(documents, folder.id);
                const isOpen = selectedFolderId === folder.id;
                const height = Math.min(11.5, 7.5 + pageCount * 0.8);
                const width = Math.min(5.25, 3 + pageCount * 0.45);

                return (
                  <button
                    key={folder.id}
                    type="button"
                    aria-label={`${folder.name} book, ${pageCount} ${pageCount === 1 ? "page" : "pages"}, ${isOpen ? "open" : "closed"}`}
                    aria-pressed={isOpen}
                    aria-expanded={isOpen}
                    onClick={() => onSelectFolder(folder.id)}
                    className={`book-spine ${isOpen ? "book-spine-open" : ""}`}
                    style={{ height: `${height}rem`, width: `${width}rem` }}
                  >
                    <span className="writing-mode-vertical truncate">{folder.name}</span>
                    <span className="mt-auto text-[0.68rem] font-bold">{pageCount}p</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="min-h-0 overflow-hidden rounded-md border border-border bg-surface p-4 shadow-soft" aria-labelledby="bookmarked-pages-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="bookmarked-pages-title" className="font-display text-xl font-black text-ink">
            Bookmarked pages
          </h2>
          {openBook ? <span className="text-sm font-semibold text-muted">{openBook.name}</span> : null}
        </div>

        {visiblePages.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-panel p-6 text-center">
            <p className="font-semibold text-muted">
              {openBook ? "This book has no pages yet." : "Create a page or import markdown to start the local library."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Bookmarked pages">
            {visiblePages.map((document) => {
              const parentBook = folders.find((folder) => folder.id === document.folderId)?.name ?? "Shelf root";
              const updated = formatRelativeTime(document.updatedAt);

              return (
                <li key={document.id}>
                  <button
                    type="button"
                    aria-label={`${document.title} page in ${parentBook}, updated ${updated}`}
                    aria-pressed={selectedDocumentId === document.id}
                    onClick={() => onSelectDocument(document.id)}
                    className={`dogear-card w-full rounded-md border bg-surface p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-accent-files focus:outline-none focus:ring-2 focus:ring-accent-files ${
                      selectedDocumentId === document.id ? "border-accent bg-panel" : "border-border"
                    }`}
                  >
                    <span className="block truncate font-display text-base font-black text-ink">{document.title}</span>
                    <span className="mt-2 block truncate text-sm font-semibold text-muted">{parentBook}</span>
                    <span className="mt-3 block text-xs font-bold text-accent-files">Updated {updated}</span>
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
