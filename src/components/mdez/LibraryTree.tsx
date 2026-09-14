"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ChevronDown, ChevronRight, FilePlus, FileText, Files, MoreHorizontal, Trash2 } from "lucide-react";
import type { Document, Folder } from "@/types/content";
import { groupPagesByCollection, sortBooks, UNSORTED_COLLECTION_ID } from "@/lib/library-tree";
import { mergeRetainedIndices } from "@/lib/library-virtual-window";
import { WORKSPACE_COPY } from "@/lib/workspace-copy";
import type { LibraryFilter } from "@/lib/library-view";
import { MovePageDialog } from "@/components/mdez/MovePageDialog";

export { UNSORTED_COLLECTION_ID } from "@/lib/library-tree";

export type LibraryTreeProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  expandedCollectionId: string | null;
  pageReveal: { documentId: string; sequence: number } | null;
  filter: LibraryFilter;
  onSelectFolder: (folderId: string | null) => void;
  onToggleCollection: (collectionId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void | Promise<void>;
  onDeleteFolder: (folderId: string) => void;
  onSelectDocument: (documentId: string) => void;
  onCreateDocument: (folderId: string | null) => void;
  onRenameDocument: (documentId: string, title: string) => void | Promise<void>;
  onMoveDocument: (documentId: string, folderId: string | null) => void | Promise<void>;
  onDeleteDocument: (documentId: string) => void;
};

type Editing = { kind: "book" | "page"; id: string; value: string } | null;

export function LibraryTree(props: LibraryTreeProps) {
  const { folders, documents } = props;
  const books = useMemo(() => sortBooks(folders), [folders]);
  const pagesByCollection = useMemo(() => groupPagesByCollection(folders, documents), [folders, documents]);
  const [editing, setEditing] = useState<Editing>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [movingPage, setMovingPage] = useState<Document | null>(null);
  const [focusedPageId, setFocusedPageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [virtualRange, setVirtualRange] = useState({ start: 0, end: 60 });
  const pageListRef = useRef<HTMLUListElement>(null);
  const rowHeightsRef = useRef(new Map<string, number>());
  const expandedPages = useMemo(() => props.expandedCollectionId === UNSORTED_COLLECTION_ID
    ? pagesByCollection.get(null) ?? []
    : pagesByCollection.get(props.expandedCollectionId) ?? [], [pagesByCollection, props.expandedCollectionId]);

  useEffect(() => {
    const list = pageListRef.current;
    const scroller = list?.closest<HTMLElement>(".sidebar-library-scroll");
    if (!list || !scroller || expandedPages.length <= 100) return;
    const update = () => {
      const listTop = list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const start = Math.max(0, Math.floor((scroller.scrollTop - listTop) / 44) - 10);
      const visible = Math.ceil(scroller.clientHeight / 44) + 20;
      setVirtualRange({ start, end: Math.min(expandedPages.length, start + visible) });
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { scroller.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [expandedPages.length, props.expandedCollectionId]);

  useEffect(() => {
    const list = pageListRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.pageId;
        if (id) rowHeightsRef.current.set(id, entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
      }
    });
    list.querySelectorAll<HTMLElement>("[data-page-id]").forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  });

  useEffect(() => {
    const request = props.pageReveal;
    const list = pageListRef.current;
    const scroller = list?.closest<HTMLElement>(".sidebar-library-scroll");
    if (!request || !list || !scroller) return;
    const index = expandedPages.findIndex((page) => page.id === request.documentId);
    if (index < 0) return;
    const listTop = list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const offset = expandedPages.slice(0, index).reduce((total, page) => total + (rowHeightsRef.current.get(page.id) ?? 44), 0);
    scroller.scrollTo?.({ top: Math.max(0, listTop + offset - 44), behavior: "auto" });
  }, [expandedPages, props.pageReveal]);

  useEffect(() => {
    if (!openMenu) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`[data-menu-key="${CSS.escape(openMenu)}"]`)) return;
      setOpenMenu(null);
      const [kind, id] = openMenu.split(":", 2) as ["book" | "page", string];
      if (kind === "page") setFocusedPageId(id);
      window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-menu-key="${CSS.escape(openMenu)}"] .library-row-menu-trigger`)?.focus());
    };
    const closeForViewportChange = () => setOpenMenu(null);
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", closeForViewportChange);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", closeForViewportChange);
    };
  }, [openMenu]);

  function focusEntity(kind: "book" | "page", id: string) {
    if (kind === "page") setFocusedPageId(id);
    window.requestAnimationFrame(() => {
      const key = `${kind}:${id}`;
      document.querySelector<HTMLButtonElement>(`[data-menu-key="${CSS.escape(key)}"] .library-row-menu-trigger`)?.focus();
    });
  }

  function restoreMenuFocus(key: string) {
    setOpenMenu(null);
    const [kind, id] = key.split(":", 2) as ["book" | "page", string];
    focusEntity(kind, id);
  }

  function toggleMenu(key: string, trigger: HTMLButtonElement) {
    const opening = openMenu !== key;
    if (opening) {
      const bounds = trigger.getBoundingClientRect();
      const width = 192;
      const estimatedHeight = key.startsWith("page:") ? 210 : 150;
      const left = Math.max(8, Math.min(bounds.right - width, window.innerWidth - width - 8));
      const top = bounds.bottom + estimatedHeight + 4 <= window.innerHeight
        ? bounds.bottom + 4
        : Math.max(8, bounds.top - estimatedHeight - 4);
      setMenuPosition({ left, top });
    }
    setOpenMenu(opening ? key : null);
    if (opening) {
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-menu-portal-key="${CSS.escape(key)}"] button, [data-menu-portal-key="${CSS.escape(key)}"] select`)?.focus());
    }
  }

  function menuPanel(key: string, children: ReactNode) {
    if (openMenu !== key || !menuPosition || typeof document === "undefined") return null;
    return createPortal(
      <div data-menu-key={key} data-menu-portal-key={key} className="library-row-menu-panel" role="menu" style={menuPosition}>{children}</div>,
      document.body
    );
  }

  function menuKeys(event: KeyboardEvent<HTMLElement>, key: string) {
    if (event.key === "Escape" && openMenu === key) {
      event.preventDefault();
      event.stopPropagation();
      restoreMenuFocus(key);
      return;
    }
    if (event.target instanceof HTMLSelectElement) return;
    if (openMenu === key && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      const items = Array.from(document.querySelectorAll<HTMLElement>(`[data-menu-portal-key="${CSS.escape(key)}"] button, [data-menu-portal-key="${CSS.escape(key)}"] select`));
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      items[(current + direction + items.length) % items.length]?.focus();
    }
  }

  async function saveEditing() {
    if (!editing || isSavingEdit) return;
    if (!editing.value.trim()) {
      setEditError("Name is required.");
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    try {
      if (editing.kind === "book") await props.onRenameFolder(editing.id, editing.value.trim());
      else await props.onRenameDocument(editing.id, editing.value.trim());
      focusEntity(editing.kind, editing.id);
      setEditing(null);
    } catch {
      setEditError("Could not save. Try again.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  function beginEditing(next: Exclude<Editing, null>) {
    setOpenMenu(null);
    setEditError(null);
    setEditing(next);
  }

  function editingKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); void saveEditing(); }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (editing) focusEntity(editing.kind, editing.id); setEditing(null); }
  }

  function drop(event: DragEvent, folderId: string | null) {
    event.preventDefault();
    setDropTarget(null);
    const documentId = event.dataTransfer.getData("text/mdez-document-id");
    const document = documents.find((item) => item.id === documentId);
    if (document && document.folderId !== folderId) requestMove(documentId, folderId);
  }

  function requestMove(documentId: string, folderId: string | null) {
    void Promise.resolve(props.onMoveDocument(documentId, folderId)).catch(() => { /* Controller exposes the failure in the sidebar. */ });
  }

  function pageRows(collectionId: string, name: string, pages: Document[]) {
    if (props.expandedCollectionId !== collectionId) return null;
    const virtual = pages.length > 100;
    const start = virtual ? virtualRange.start : 0;
    const end = virtual ? virtualRange.end : pages.length;
    const openMenuPageId = openMenu?.startsWith("page:") ? openMenu.slice(5) : null;
    const retainedIds = [editing?.kind === "page" ? editing.id : null, openMenuPageId, focusedPageId, props.pageReveal?.documentId ?? null].filter((id): id is string => Boolean(id));
    const retained = retainedIds.map((id) => pages.findIndex((page) => page.id === id));
    const indices = virtual ? mergeRetainedIndices(start, end, pages.length, retained) : pages.map((_, index) => index);
    let previousIndex = -1;
    const rowHeight = (index: number) => rowHeightsRef.current.get(pages[index].id) ?? 44;
    const gapHeight = (from: number, to: number) => {
      let height = 0;
      for (let index = from; index < to; index += 1) height += rowHeight(index);
      return height;
    };
    return (
      <ul ref={pageListRef} className="library-tree-pages" aria-label={`Pages in ${name}`}>
        {pages.length === 0 ? <li className="library-tree-empty">No pages yet</li> : indices.map((pageIndex) => {
          const page = pages[pageIndex];
          const gap = pageIndex - previousIndex - 1;
          const gapStart = previousIndex + 1;
          previousIndex = pageIndex;
          return <Fragment key={page.id}>
          {gap > 0 ? <li aria-hidden="true" className="library-virtual-spacer" style={{ height: `${gapHeight(gapStart, pageIndex)}px` }} /> : null}
          <li className="library-tree-page" data-page-id={page.id} data-selected={props.selectedDocumentId === page.id} draggable
            aria-posinset={pageIndex + 1} aria-setsize={pages.length}
            onFocusCapture={() => window.requestAnimationFrame(() => setFocusedPageId(page.id))} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedPageId((current) => current === page.id ? null : current); }}
            onDragStart={(event) => { event.dataTransfer.setData("text/mdez-document-id", page.id); event.dataTransfer.effectAllowed = "move"; }}>
            <FileText aria-hidden="true" />
            {editing?.kind === "page" && editing.id === page.id ? (
              <span className="library-inline-edit">
                <input autoFocus disabled={isSavingEdit} onFocus={(event) => event.currentTarget.select()} aria-label={`Rename ${page.title}`} aria-invalid={Boolean(editError)} value={editing.value} onChange={(event) => { setEditError(null); setEditing({ ...editing, value: event.target.value }); }} onKeyDown={editingKeys} />
                <button type="button" disabled={isSavingEdit} onClick={() => void saveEditing()} aria-label={`Save ${page.title}`}>Save</button>
                <button type="button" disabled={isSavingEdit} onClick={() => { focusEntity("page", page.id); setEditing(null); }} aria-label={`Cancel renaming ${page.title}`}>Cancel</button>
                {editError ? <small role="alert">{editError}</small> : null}
              </span>
            ) : <button type="button" className="library-tree-page-open" aria-current={props.selectedDocumentId === page.id ? "page" : undefined} aria-label={`Open ${page.title}`} title={page.title} onClick={() => props.onSelectDocument(page.id)}>{page.title}</button>}
            <div className="library-row-menu" data-menu-key={`page:${page.id}`} onKeyDown={(event) => menuKeys(event, `page:${page.id}`)}>
              <button type="button" className="library-row-menu-trigger" aria-label={`Manage ${page.title}`} title="Page actions" aria-haspopup="menu" aria-expanded={openMenu === `page:${page.id}`} onClick={(event) => toggleMenu(`page:${page.id}`, event.currentTarget)}><MoreHorizontal aria-hidden="true" /></button>
              {menuPanel(`page:${page.id}`, <>
                <button type="button" role="menuitem" onClick={() => beginEditing({ kind: "page", id: page.id, value: page.title })}>Rename page</button>
                <button type="button" role="menuitem" onClick={() => { setMovingPage(page); setOpenMenu(null); }}>Move to…</button>
                <button type="button" role="menuitem" className="danger" onClick={() => { setOpenMenu(null); props.onDeleteDocument(page.id); }}><Trash2 aria-hidden="true" />Delete page</button>
              </>)}
            </div>
          </li></Fragment>;
        })}
        {virtual && previousIndex + 1 < pages.length ? <li aria-hidden="true" className="library-virtual-spacer" style={{ height: `${gapHeight(previousIndex + 1, pages.length)}px` }} /> : null}
        <li><button type="button" className="library-add-page" onClick={() => props.onCreateDocument(collectionId === UNSORTED_COLLECTION_ID ? null : collectionId)}><FilePlus aria-hidden="true" />Add page</button></li>
      </ul>
    );
  }

  return (
    <section className="library-tree-section">
      <ul className="library-tree" aria-label="Books and pages">
        {books.map((book) => {
          const pages = pagesByCollection.get(book.id) ?? [];
          const expanded = props.expandedCollectionId === book.id;
          return <li key={book.id} data-drop-target={dropTarget === book.id} onDragOver={(event) => { event.preventDefault(); setDropTarget(book.id); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => drop(event, book.id)} data-testid={`collection-${book.id}`}>
            <div className="library-tree-book" data-selected={props.filter === "all" && props.selectedFolderId === book.id}>
              <button type="button" className="library-tree-disclosure" aria-label={`${expanded ? "Collapse" : "Expand"} ${book.name}`} aria-expanded={expanded} onClick={() => props.onToggleCollection(book.id)}>{expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</button>
              {editing?.kind === "book" && editing.id === book.id ? <span className="library-inline-edit"><input autoFocus disabled={isSavingEdit} onFocus={(event) => event.currentTarget.select()} aria-label={`Rename ${book.name}`} aria-invalid={Boolean(editError)} value={editing.value} onChange={(event) => { setEditError(null); setEditing({ ...editing, value: event.target.value }); }} onKeyDown={editingKeys} /><button type="button" disabled={isSavingEdit} onClick={() => void saveEditing()}>Save</button><button type="button" disabled={isSavingEdit} onClick={() => { focusEntity("book", book.id); setEditing(null); }}>Cancel</button>{editError ? <small role="alert">{editError}</small> : null}</span> : <button type="button" className="library-tree-book-open" aria-pressed={props.filter === "all" && props.selectedFolderId === book.id} aria-label={`Open ${book.name} book`} title={book.name} onClick={() => props.onSelectFolder(book.id)}><BookOpen aria-hidden="true" className="library-tree-book-icon" /><span>{book.name}</span></button>}
              <span className="library-tree-count" title={`${pages.length} pages`}>{pages.length}</span>
              <div className="library-row-menu" data-menu-key={`book:${book.id}`} onKeyDown={(event) => menuKeys(event, `book:${book.id}`)}>
                <button type="button" className="library-row-menu-trigger" aria-label={`Manage ${book.name}`} title="Book actions" aria-haspopup="menu" aria-expanded={openMenu === `book:${book.id}`} onClick={(event) => toggleMenu(`book:${book.id}`, event.currentTarget)}><MoreHorizontal aria-hidden="true" /></button>
                {menuPanel(`book:${book.id}`, <>
                  <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); props.onCreateDocument(book.id); }}><FilePlus aria-hidden="true" />Add page</button>
                  <button type="button" role="menuitem" onClick={() => beginEditing({ kind: "book", id: book.id, value: book.name })}>Rename {book.name}</button>
                  <button type="button" role="menuitem" className="danger" onClick={() => { setOpenMenu(null); props.onDeleteFolder(book.id); }}><Trash2 aria-hidden="true" />Delete book</button>
                </>)}
              </div>
            </div>
            {pageRows(book.id, book.name, pages)}
          </li>;
        })}
        <li data-drop-target={dropTarget === UNSORTED_COLLECTION_ID} onDragOver={(event) => { event.preventDefault(); setDropTarget(UNSORTED_COLLECTION_ID); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => drop(event, null)} data-testid="collection-unsorted">
          <div className="library-tree-book library-tree-unsorted" data-selected={props.filter === "unsorted" && props.selectedFolderId === null}>
            <button type="button" className="library-tree-disclosure" aria-label={`${props.expandedCollectionId === UNSORTED_COLLECTION_ID ? "Collapse" : "Expand"} ${WORKSPACE_COPY.pagesWithoutBook}`} aria-expanded={props.expandedCollectionId === UNSORTED_COLLECTION_ID} onClick={() => props.onToggleCollection(UNSORTED_COLLECTION_ID)}>{props.expandedCollectionId === UNSORTED_COLLECTION_ID ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</button>
            <button type="button" className="library-tree-book-open" aria-pressed={props.filter === "unsorted" && props.selectedFolderId === null} aria-label={`Open ${WORKSPACE_COPY.pagesWithoutBook}`} title={WORKSPACE_COPY.pagesWithoutBook} onClick={() => props.onSelectFolder(null)}><Files aria-hidden="true" className="library-tree-book-icon" /><span>{WORKSPACE_COPY.pagesWithoutBook}</span></button>
            <span className="library-tree-count">{(pagesByCollection.get(null) ?? []).length}</span>
            <button type="button" className="library-row-add" aria-label="Add page to Unsorted" onClick={() => props.onCreateDocument(null)}><FilePlus aria-hidden="true" /></button>
          </div>
          {pageRows(UNSORTED_COLLECTION_ID, WORKSPACE_COPY.pagesWithoutBook, pagesByCollection.get(null) ?? [])}
        </li>
      </ul>
      {movingPage ? <MovePageDialog page={movingPage} books={books} onMove={async (documentId, folderId) => { await props.onMoveDocument(documentId, folderId); }} onClose={() => { focusEntity("page", movingPage.id); setMovingPage(null); }} /> : null}
    </section>
  );
}
