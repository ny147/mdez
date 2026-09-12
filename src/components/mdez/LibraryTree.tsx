"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BookOpen, BookPlus, ChevronDown, ChevronRight, FilePlus, FileText, Files, MoreHorizontal, Trash2 } from "lucide-react";
import type { Document, Folder } from "@/types/content";
import { groupPagesByCollection, sortBooks, UNSORTED_COLLECTION_ID } from "@/lib/library-tree";
import { WORKSPACE_COPY } from "@/lib/workspace-copy";

export { UNSORTED_COLLECTION_ID } from "@/lib/library-tree";

export type LibraryTreeProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  expandedCollectionId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onToggleCollection: (collectionId: string) => void;
  onCreateFolder: (parentId: null) => void;
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
  const [focusedPageId, setFocusedPageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [virtualRange, setVirtualRange] = useState({ start: 0, end: 60 });
  const pageListRef = useRef<HTMLUListElement>(null);
  const expandedPages = props.expandedCollectionId === UNSORTED_COLLECTION_ID
    ? pagesByCollection.get(null) ?? []
    : pagesByCollection.get(props.expandedCollectionId) ?? [];

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
    if (!props.selectedDocumentId) return;
    const frame = window.requestAnimationFrame(() => {
      const selected = pageListRef.current?.querySelector<HTMLElement>("[aria-current='page']");
      selected?.scrollIntoView?.({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedPages.length, props.expandedCollectionId, props.selectedDocumentId, virtualRange]);

  useEffect(() => {
    if (!openMenu) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`[data-menu-key="${CSS.escape(openMenu)}"]`)) return;
      setOpenMenu(null);
    };
    const closeForViewportChange = () => setOpenMenu(null);
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", closeForViewportChange);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", closeForViewportChange);
    };
  }, [openMenu]);

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
      setOpenMenu(null);
      document.querySelector<HTMLButtonElement>(`[data-menu-key="${CSS.escape(key)}"] .library-row-menu-trigger`)?.focus();
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
    if (event.key === "Escape") { event.preventDefault(); setEditing(null); }
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
    let start = virtual ? virtualRange.start : 0;
    let end = virtual ? virtualRange.end : pages.length;
    const openMenuPageId = openMenu?.startsWith("page:") ? openMenu.slice(5) : null;
    const retainedPageId = editing?.kind === "page" ? editing.id : openMenuPageId ?? focusedPageId ?? props.selectedDocumentId;
    const selectedIndex = pages.findIndex((page) => page.id === retainedPageId);
    if (selectedIndex >= 0 && (selectedIndex < start || selectedIndex >= end)) {
      start = Math.max(0, selectedIndex - 10);
      end = Math.min(pages.length, start + 60);
    }
    const visiblePages = pages.slice(start, end);
    return (
      <ul ref={pageListRef} className="library-tree-pages" aria-label={`Pages in ${name}`}>
        {virtual && start > 0 ? <li aria-hidden="true" className="library-virtual-spacer" style={{ height: `${start * 44}px` }} /> : null}
        {pages.length === 0 ? <li className="library-tree-empty">No pages yet</li> : visiblePages.map((page, visibleIndex) => (
          <li key={page.id} className="library-tree-page" data-selected={props.selectedDocumentId === page.id} draggable
            aria-posinset={start + visibleIndex + 1} aria-setsize={pages.length}
            onFocusCapture={() => setFocusedPageId(page.id)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedPageId((current) => current === page.id ? null : current); }}
            onDragStart={(event) => { event.dataTransfer.setData("text/mdez-document-id", page.id); event.dataTransfer.effectAllowed = "move"; }}>
            <FileText aria-hidden="true" />
            {editing?.kind === "page" && editing.id === page.id ? (
              <span className="library-inline-edit">
                <input autoFocus onFocus={(event) => event.currentTarget.select()} aria-label={`Rename ${page.title}`} aria-invalid={Boolean(editError)} value={editing.value} onChange={(event) => { setEditError(null); setEditing({ ...editing, value: event.target.value }); }} onKeyDown={editingKeys} />
                <button type="button" disabled={isSavingEdit} onClick={() => void saveEditing()} aria-label={`Save ${page.title}`}>Save</button>
                <button type="button" onClick={() => setEditing(null)} aria-label={`Cancel renaming ${page.title}`}>Cancel</button>
                {editError ? <small role="alert">{editError}</small> : null}
              </span>
            ) : <button type="button" className="library-tree-page-open" aria-current={props.selectedDocumentId === page.id ? "page" : undefined} aria-label={`Open ${page.title}`} title={page.title} onClick={() => props.onSelectDocument(page.id)}>{page.title}</button>}
            <div className="library-row-menu" data-menu-key={`page:${page.id}`} onKeyDown={(event) => menuKeys(event, `page:${page.id}`)}>
              <button type="button" className="library-row-menu-trigger" aria-label={`Manage ${page.title}`} title="Page actions" aria-haspopup="menu" aria-expanded={openMenu === `page:${page.id}`} onClick={(event) => toggleMenu(`page:${page.id}`, event.currentTarget)}><MoreHorizontal aria-hidden="true" /></button>
              {menuPanel(`page:${page.id}`, <>
                <button type="button" role="menuitem" onClick={() => beginEditing({ kind: "page", id: page.id, value: page.title })}>Rename page</button>
                <label>Move to
                  <select value={page.folderId ?? ""} aria-label={`Move ${page.title}`} onChange={(event) => { setOpenMenu(null); requestMove(page.id, event.currentTarget.value || null); }}>
                    <option value="">{WORKSPACE_COPY.pagesWithoutBook}</option>
                    {books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
                  </select>
                </label>
                <button type="button" role="menuitem" className="danger" onClick={() => { setOpenMenu(null); props.onDeleteDocument(page.id); }}><Trash2 aria-hidden="true" />Delete page</button>
              </>)}
            </div>
          </li>
        ))}
        {virtual && end < pages.length ? <li aria-hidden="true" className="library-virtual-spacer" style={{ height: `${(pages.length - end) * 44}px` }} /> : null}
        <li><button type="button" className="library-add-page" onClick={() => props.onCreateDocument(collectionId === UNSORTED_COLLECTION_ID ? null : collectionId)}><FilePlus aria-hidden="true" />Add page</button></li>
      </ul>
    );
  }

  return (
    <section className="library-tree-section">
      <div className="sidebar-section-heading">
        <strong>{WORKSPACE_COPY.library}</strong>
        <button type="button" className="workspace-icon-button" onClick={() => props.onCreateFolder(null)} aria-label="Create book" title="Create book"><BookPlus aria-hidden="true" /></button>
      </div>
      <ul className="library-tree" aria-label="Books and pages">
        {books.map((book) => {
          const pages = pagesByCollection.get(book.id) ?? [];
          const expanded = props.expandedCollectionId === book.id;
          return <li key={book.id} data-drop-target={dropTarget === book.id} onDragOver={(event) => { event.preventDefault(); setDropTarget(book.id); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => drop(event, book.id)} data-testid={`collection-${book.id}`}>
            <div className="library-tree-book" data-selected={props.selectedFolderId === book.id}>
              <button type="button" className="library-tree-disclosure" aria-label={`${expanded ? "Collapse" : "Expand"} ${book.name}`} aria-expanded={expanded} onClick={() => props.onToggleCollection(book.id)}>{expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</button>
              <BookOpen aria-hidden="true" className="library-tree-book-icon" />
              {editing?.kind === "book" && editing.id === book.id ? <span className="library-inline-edit"><input autoFocus onFocus={(event) => event.currentTarget.select()} aria-label={`Rename ${book.name}`} aria-invalid={Boolean(editError)} value={editing.value} onChange={(event) => { setEditError(null); setEditing({ ...editing, value: event.target.value }); }} onKeyDown={editingKeys} /><button type="button" disabled={isSavingEdit} onClick={() => void saveEditing()}>Save</button><button type="button" onClick={() => setEditing(null)}>Cancel</button>{editError ? <small role="alert">{editError}</small> : null}</span> : <button type="button" className="library-tree-book-open" aria-pressed={props.selectedFolderId === book.id} aria-label={`Open ${book.name} book`} title={book.name} onClick={() => props.onSelectFolder(book.id)}>{book.name}</button>}
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
          <div className="library-tree-book library-tree-unsorted" data-selected={props.selectedFolderId === null}>
            <button type="button" className="library-tree-disclosure" aria-label={`${props.expandedCollectionId === UNSORTED_COLLECTION_ID ? "Collapse" : "Expand"} ${WORKSPACE_COPY.pagesWithoutBook}`} aria-expanded={props.expandedCollectionId === UNSORTED_COLLECTION_ID} onClick={() => props.onToggleCollection(UNSORTED_COLLECTION_ID)}>{props.expandedCollectionId === UNSORTED_COLLECTION_ID ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</button>
            <Files aria-hidden="true" className="library-tree-book-icon" />
            <button type="button" className="library-tree-book-open" aria-pressed={props.selectedFolderId === null} onClick={() => props.onSelectFolder(null)}>{WORKSPACE_COPY.pagesWithoutBook}</button>
            <span className="library-tree-count">{(pagesByCollection.get(null) ?? []).length}</span>
            <button type="button" className="library-row-add" aria-label="Add page to Unsorted" onClick={() => props.onCreateDocument(null)}><FilePlus aria-hidden="true" /></button>
          </div>
          {pageRows(UNSORTED_COLLECTION_ID, WORKSPACE_COPY.pagesWithoutBook, pagesByCollection.get(null) ?? [])}
        </li>
      </ul>
    </section>
  );
}
