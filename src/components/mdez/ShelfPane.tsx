"use client";

import { BookOpen, Download, FilePlus, Upload } from "lucide-react";
import React from "react";
import { BookCover } from "@/components/mdez/BookCover";
import { LibraryPageList } from "@/components/mdez/LibraryPageList";
import { estimateReadingMinutes, getBookPath, type LibraryFilter } from "@/lib/library-view";
import { WORKSPACE_COPY, getBookExportCopy } from "@/lib/workspace-copy";
import type { Document, Folder } from "@/types/content";

type ShelfPaneProps = {
  folders: Folder[]; documents: Document[]; books: Folder[]; pages: Document[];
  selectedFolderId: string | null; selectedDocumentId: string | null;
  filter: LibraryFilter; query: string; bookmarkedIds: ReadonlySet<string>;
  resumePage: Document | null; metadataError: string | null; isReady: boolean;
  onSelectFolder: (folderId: string | null) => void; onSelectDocument: (documentId: string) => void;
  onToggleBookmark: (documentId: string) => void; onCreateDocument: () => void;
  onCreateFolder: (parentId: string | null) => void; onOpenImport: () => void;
  onExportFolder: () => void; onClearSearch: () => void;
};

function viewTitle(filter: LibraryFilter, openBook: Folder | null, query: string) {
  if (query.trim()) return `Results for “${query.trim()}”`;
  if (openBook) return openBook.name;
  if (filter === "recent") return "Fresh from your notebook.";
  if (filter === "bookmarks") return "Your favorite ideas.";
  if (filter === "unsorted") return WORKSPACE_COPY.pagesWithoutBook;
  return "A little space for big ideas.";
}

export function ShelfPane({ folders, documents, books, pages, selectedFolderId, selectedDocumentId, filter, query, bookmarkedIds, resumePage, metadataError, isReady, onSelectFolder, onSelectDocument, onToggleBookmark, onCreateDocument, onCreateFolder, onOpenImport, onExportFolder, onClearSearch }: ShelfPaneProps) {
  const openBook = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const exportCopy = getBookExportCopy(openBook?.name ?? null);
  const showBooks = books.length > 0 || (!query && filter === "all");
  const showResume = !query.trim() && filter === "all" && selectedFolderId === null && resumePage;
  const hasResults = books.length > 0 || pages.length > 0;

  return (
    <div className="library-view">
      <header className="library-intro">
        <div>
          <h1>{viewTitle(filter, openBook, query)}</h1>
          <p>{query ? "Search covers every book and page in this workspace." : openBook ? `A collection of thoughts inside ${openBook.name}.` : "Your notes, stories, and sparks of inspiration. All together."}</p>
        </div>
        <div className="library-actions">
          <button type="button" onClick={onOpenImport} aria-label={WORKSPACE_COPY.importMarkdown} className="secondary-button"><Upload aria-hidden="true" />Import</button>
          <button type="button" data-visual-priority="primary" onClick={onCreateDocument} aria-label={openBook ? `Create page in ${openBook.name}` : "Create page"} className="primary-button"><FilePlus aria-hidden="true" />New page</button>
          <button type="button" onClick={() => onCreateFolder(selectedFolderId)} className="secondary-button"><BookOpen aria-hidden="true" />New book</button>
        </div>
      </header>

      {metadataError ? <p className="library-metadata-error">{metadataError}</p> : null}
      {showResume ? (
        <section className="library-resume" aria-labelledby="continue-writing-title">
          <div><h2 id="continue-writing-title">Continue writing</h2><strong title={resumePage.title}>{resumePage.title}</strong><p>{getBookPath(resumePage.folderId, folders)} · {estimateReadingMinutes(resumePage.body)} min read</p><button type="button" onClick={() => onSelectDocument(resumePage.id)}>Open page</button></div>
          <div className="library-resume-art" aria-hidden="true"><span /><span /></div>
        </section>
      ) : null}

      {!isReady ? <p className="library-loading">Indexing this workspace…</p> : null}
      {isReady && query && !hasResults ? <section className="library-empty"><h2>Nothing found yet.</h2><p>Try another title, phrase, or book name.</p><button type="button" onClick={onClearSearch}>Clear search</button></section> : null}
      {isReady && !query && filter === "bookmarks" && pages.length === 0 ? <section className="library-empty"><h2>No bookmarks yet.</h2><p>Use the star beside any page to keep it close.</p></section> : null}

      {showBooks && isReady ? (
        <section className="library-section" aria-labelledby="bookshelf-title">
          <div className="library-section-heading"><h2 id="bookshelf-title">{openBook ? "Books inside" : WORKSPACE_COPY.books}</h2><span>{books.length} {books.length === 1 ? "book" : "books"}</span></div>
          {books.length ? <div className="library-books">{books.map((folder) => <BookCover key={folder.id} folder={folder} directPageCount={documents.filter((document) => document.folderId === folder.id).length} selected={folder.id === selectedFolderId} onSelect={onSelectFolder} />)}</div> : <div className="library-empty compact"><p>No books yet. Create a book to group related pages.</p></div>}
        </section>
      ) : null}

      {isReady && (hasResults || (!query && filter !== "bookmarks")) ? (
        <section className="library-section" aria-labelledby="library-pages-title">
          <div className="library-section-heading">
            <h2 id="library-pages-title">{query ? "Matching pages" : filter === "recent" ? "Recent pages" : filter === "bookmarks" ? "Bookmarked pages" : openBook ? "Pages in this book" : filter === "unsorted" ? "Unsorted pages" : "Recent pages"}</h2>
            {openBook ? <button type="button" onClick={onExportFolder} disabled={exportCopy.disabled} aria-label={exportCopy.label} title={exportCopy.hint} className="library-export"><Download aria-hidden="true" />Export book</button> : null}
          </div>
          {pages.length ? <LibraryPageList documents={pages} folders={folders} bookmarkedIds={bookmarkedIds} selectedDocumentId={selectedDocumentId} onSelectDocument={onSelectDocument} onToggleBookmark={onToggleBookmark} /> : <div className="library-empty compact"><p>{openBook ? "No pages in this book yet. Create a page or import Markdown here." : "No pages yet. Create a page or import Markdown to begin."}</p></div>}
        </section>
      ) : null}
    </div>
  );
}
