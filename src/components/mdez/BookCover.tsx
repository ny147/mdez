"use client";

import { getCoverVariant } from "@/lib/library-view";
import React from "react";
import type { Folder } from "@/types/content";
import mark from "./brand-mark.json";

type BookCoverProps = {
  folder: Folder;
  directPageCount: number;
  selected: boolean;
  onSelect: (folderId: string) => void;
};

export function BookCover({ folder, directPageCount, selected, onSelect }: BookCoverProps) {
  const pageLabel = `${directPageCount} ${directPageCount === 1 ? "page" : "pages"}`;
  return (
    <button
      type="button"
      className="library-book"
      data-cover-variant={getCoverVariant(folder.id)}
      data-selected={selected}
      aria-pressed={selected}
      aria-label={`${folder.name} book, ${pageLabel}, ${selected ? "open" : "closed"}`}
      onClick={() => onSelect(folder.id)}
    >
      <span className="library-book-cover" aria-hidden="true">
        <strong>{folder.name}</strong>
        <svg className="library-book-geometry" viewBox="0 40 112 72" focusable="false">
          {mark.book.map((shape, index) => <path key={index} d={shape.d} fill="currentColor" />)}
        </svg>
        <span className="library-book-foot">{pageLabel}</span>
      </span>
      <span className="library-book-title" title={folder.name}>{folder.name}</span>
      <span className="library-book-meta">{pageLabel}</span>
    </button>
  );
}
