"use client";

import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { naturalCompare } from "@/lib/library-tree";

type MovePageDialogProps = {
  page: Document;
  books: Folder[];
  onMove: (documentId: string, folderId: string | null) => Promise<void>;
  onClose: () => void;
};

export function MovePageDialog({ page, books, onMove, onClose }: MovePageDialogProps) {
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState<string | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => books
    .filter((book) => book.id !== page.folderId && book.name.toLocaleLowerCase("en-US").includes(query.trim().toLocaleLowerCase("en-US")))
    .sort((left, right) => naturalCompare(left.name, right.name) || left.id.localeCompare(right.id)), [books, page.folderId, query]);

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => {
    if (destination !== null && destination !== undefined && !matches.some((book) => book.id === destination)) {
      setDestination(undefined);
    }
  }, [destination, matches]);

  function keys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault(); event.stopPropagation(); onClose(); return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? []);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function submit() {
    if (pending || destination === undefined) return;
    setPending(true); setError(null);
    try { await onMove(page.id, destination); onClose(); }
    catch { setError("We could not move this page. Try again; the page is still in its original book."); setPending(false); }
  }

  const option = (id: string | null, name: string) => (
    <label className="move-page-option" key={id ?? "unsorted"}>
      <input type="radio" name="move-destination" checked={destination === id} onChange={() => setDestination(id)} disabled={pending} />
      <span>{name}</span>
    </label>
  );

  return <div className="move-page-backdrop">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="move-page-title" className="move-page-dialog floating-surface" onKeyDown={keys}>
      <header><div><p className="field-label">Move page</p><h2 id="move-page-title">Choose a destination</h2><p title={page.title}>{page.title}</p></div><button type="button" className="workspace-icon-button" aria-label="Close move dialog" onClick={onClose} disabled={pending}><X aria-hidden="true" /></button></header>
      <label className="move-page-search">Search books<input ref={searchRef} type="search" aria-label="Search books" value={query} onChange={(event) => setQuery(event.currentTarget.value)} disabled={pending} /></label>
      <div className="move-page-options">{page.folderId !== null ? option(null, "Unsorted pages") : null}{matches.map((book) => option(book.id, book.name))}{matches.length === 0 && page.folderId === null ? <p>No matching books</p> : null}</div>
      {query ? <button type="button" className="move-page-clear" onClick={() => setQuery("")} disabled={pending}>Clear search</button> : null}
      {error ? <p role="alert" className="move-page-error">{error}</p> : null}
      <footer><button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancel</button><button type="button" className="primary-button" aria-label="Move page" onClick={() => void submit()} disabled={pending || destination === undefined}>{pending ? "Moving…" : "Move"}</button></footer>
    </section>
  </div>;
}
