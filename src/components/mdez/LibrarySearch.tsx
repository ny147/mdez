"use client";

import { Search, X } from "lucide-react";
import React, { type RefObject } from "react";

type LibrarySearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  hasResults: boolean;
  onClear: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export function LibrarySearch({ query, onQueryChange, onSubmit, hasResults, onClear, inputRef }: LibrarySearchProps) {
  return (
    <div className="library-search-wrap">
      <form role="search" className="library-search" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search pages and books"
          placeholder="Find something good…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <kbd>Ctrl K</kbd>
      </form>
      {query && !hasResults ? (
        <div className="library-search-empty">
          <span>No pages or books match “{query}”.</span>
          <button type="button" onClick={onClear}><X aria-hidden="true" />Clear search</button>
        </div>
      ) : null}
    </div>
  );
}
