"use client";

import { getCoverVariant } from "@/lib/library-view";
import React from "react";
import type { Folder } from "@/types/content";

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
        <span className="library-book-kicker">MDEZ NOTES</span>
        <strong>{folder.name}</strong>
        <span className="library-book-geometry" />
        <span className="library-book-foot">{pageLabel}</span>
      </span>
      <span className="library-book-title" title={folder.name}>{folder.name}</span>
      <span className="library-book-meta">{pageLabel}</span>
    </button>
  );
}
