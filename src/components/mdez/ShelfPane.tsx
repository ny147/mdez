"use client";

import { BookOpen, Download, FilePlus, Upload } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { WORKSPACE_COPY, formatRelativeTime, getBookExportCopy } from "@/lib/workspace-copy";

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
  const exportCopy = getBookExportCopy(openBook?.name ?? null);

  return (
    <div className="grid min-h-0 flex-1 gap-5 overflow-hidden">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="max-w-2xl text-sm font-semibold leading-6 text-muted">
            {openBook
              ? `Showing recent pages in ${openBook.name}. Return to Library to view recent pages from every book.`
              : "Open a book to see its recent pages. Library shows recent pages from every book."}
          </p>
        </div>
        <div className="grid gap-2 md:justify-items-end">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              data-visual-priority="primary"
              onClick={onCreateDocument}
              aria-label={createPageLabel}
              className="primary-button px-4 py-2"
            >
              <FilePlus aria-hidden="true" className="h-4 w-4" />
              {createPageLabel}
            </button>
            <button type="button" onClick={() => onCreateFolder(null)} className="secondary-button px-4 py-2 text-sm font-extrabold">
              <BookOpen aria-hidden="true" className="h-4 w-4" />
              Create book
            </button>
            <button type="button" onClick={onOpenImport} aria-label={WORKSPACE_COPY.importMarkdown} className="secondary-button px-4 py-2 text-sm font-extrabold">
              <Upload aria-hidden="true" className="h-4 w-4" />
              {WORKSPACE_COPY.importMarkdown}
            </button>
            <button
              type="button"
              onClick={onExportFolder}
              disabled={exportCopy.disabled}
              aria-label={exportCopy.label}
              className="secondary-button px-4 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              {exportCopy.label}
            </button>
          </div>
          <p className="max-w-md text-xs font-semibold leading-5 text-muted">{exportCopy.hint}</p>
        </div>
      </div>

      <section className="workspace-section min-w-0" aria-labelledby="bookshelf-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="bookshelf-title" className="font-display text-xl font-black text-ink">
            {WORKSPACE_COPY.books}
          </h2>
          <span className="rounded border border-border bg-panel px-3 py-1 text-xs font-bold text-muted">
            {sortedFolders.length} {sortedFolders.length === 1 ? "book" : "books"}
          </span>
        </div>

        {sortedFolders.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-panel p-6 text-center">
            <p className="font-semibold text-muted">{isReady ? "No books yet. Create a book to group related pages." : "Indexing local library..."}</p>
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

      <section className="workspace-section min-h-0 overflow-hidden" aria-labelledby="recent-pages-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="recent-pages-title" className="font-display text-xl font-black text-ink">
            {WORKSPACE_COPY.recentPages}
          </h2>
          {openBook ? <span className="text-sm font-semibold text-muted">{openBook.name}</span> : null}
        </div>

        {visiblePages.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-panel p-6 text-center">
            <p className="font-semibold text-muted">
              {openBook
                ? "No pages in this book yet. Create a page or import Markdown here."
                : "No pages yet. Create a page or import Markdown to begin."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={WORKSPACE_COPY.recentPages}>
            {visiblePages.map((document) => {
              const parentBook = folders.find((folder) => folder.id === document.folderId)?.name ?? WORKSPACE_COPY.pagesWithoutBook;
              const updated = formatRelativeTime(document.updatedAt);

              return (
                <li key={document.id}>
                  <button
                    type="button"
                    aria-label={`${document.title} page in ${parentBook}, updated ${updated}`}
                    aria-pressed={selectedDocumentId === document.id}
                    onClick={() => onSelectDocument(document.id)}
                    className={`dogear-card w-full rounded-md border bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-accent-files focus:outline-none focus:ring-2 focus:ring-accent-files ${
                      selectedDocumentId === document.id ? "border-accent bg-panel" : "border-border"
                    }`}
                  >
                    <span className="page-title-clamp font-display text-base font-black text-ink" title={document.title}>
                      {document.title}
                    </span>
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
