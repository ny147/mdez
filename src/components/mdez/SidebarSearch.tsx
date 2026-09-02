"use client";

import React, { useEffect, useMemo, useState, type RefObject } from "react";
import { BookOpen, FileText, Search, X } from "lucide-react";

import { normalizeSidebarQuery, searchSidebar } from "@/lib/sidebar-search";
import type { Document, Folder } from "@/types/content";

type SidebarSearchProps = {
  folders: Folder[];
  documents: Document[];
  query: string;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onSelectFolder: (folderId: string) => void;
  onSelectDocument: (documentId: string) => void;
};

export function SidebarSearch({
  folders,
  documents,
  query,
  disabled,
  inputRef,
  onQueryChange,
  onSelectFolder,
  onSelectDocument
}: SidebarSearchProps) {
  const [shortcut, setShortcut] = useState("Ctrl K");
  const normalizedQuery = normalizeSidebarQuery(query);
  const results = useMemo(() => searchSidebar(folders, documents, query), [documents, folders, query]);

  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K");
  }, []);

  function clear() {
    onQueryChange("");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function chooseFolder(folderId: string) {
    onQueryChange("");
    onSelectFolder(folderId);
  }

  function chooseDocument(documentId: string) {
    onQueryChange("");
    onSelectDocument(documentId);
  }

  const noResults = normalizedQuery && results.totalBookMatches === 0 && results.totalPageMatches === 0;

  return (
    <div className={normalizedQuery ? "sidebar-search is-active" : "sidebar-search"}>
      <div className="sidebar-search-field">
        <Search aria-hidden="true" className="sidebar-search-icon" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          maxLength={200}
          disabled={disabled}
          aria-label="Search books and pages"
          aria-keyshortcuts="Control+K Meta+K"
          placeholder={disabled ? "Loading library…" : "Search books and pages"}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              clear();
            }
          }}
          className="workspace-input"
        />
        {query ? (
          <button type="button" onClick={clear} aria-label="Clear search field" title="Clear search" className="sidebar-search-clear">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : <kbd className="sidebar-search-shortcut">{shortcut}</kbd>}
      </div>

      {normalizedQuery ? (
        <div className="sidebar-search-results" aria-label="Library search results">
          {results.books.length > 0 ? (
            <section aria-labelledby="sidebar-search-books-heading">
              <div className="sidebar-search-results-heading">
                <h3 id="sidebar-search-books-heading">Books</h3>
                <span>{results.totalBookMatches}</span>
              </div>
              <ul>
                {results.books.map(({ folder, path, directPageCount }) => (
                  <li key={folder.id}>
                    <button type="button" onClick={() => chooseFolder(folder.id)} aria-label={`Open ${path} book`}>
                      <BookOpen aria-hidden="true" className="h-4 w-4" />
                      <span><strong>{folder.name}</strong><small>{path} · {directPageCount} {directPageCount === 1 ? "page" : "pages"}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {results.pages.length > 0 ? (
            <section aria-labelledby="sidebar-search-pages-heading">
              <div className="sidebar-search-results-heading">
                <h3 id="sidebar-search-pages-heading">Pages</h3>
                <span>{results.totalPageMatches}</span>
              </div>
              <ul>
                {results.pages.map(({ document, bookPath }) => (
                  <li key={document.id}>
                    <button type="button" onClick={() => chooseDocument(document.id)} aria-label={`Open ${document.title} in ${bookPath}`}>
                      <FileText aria-hidden="true" className="h-4 w-4" />
                      <span><strong>{document.title}</strong><small>{bookPath}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {noResults ? (
            <div className="sidebar-search-empty">
              <p>No books or pages match “{query.trim()}”.</p>
              <button type="button" onClick={clear} className="sidebar-header-action">Clear search</button>
            </div>
          ) : null}

          {results.truncated ? <p className="sidebar-search-truncated">Showing the first results. Refine your search to narrow the list.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
