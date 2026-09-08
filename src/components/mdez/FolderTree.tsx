"use client";

import { BookOpen, BookPlus, ChevronDown, ChevronRight, Files, Trash2 } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { buildFolderTree, type FolderNode } from "@/lib/tree";
import { IconButton } from "@/components/ui/IconButton";
import { WORKSPACE_COPY } from "@/lib/workspace-copy";

type FolderTreeProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  expandedFolderIds: Set<string>;
  onSelectFolder: (folderId: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  showUnsorted?: boolean;
};

export function FolderTree({
  folders,
  documents,
  selectedFolderId,
  expandedFolderIds,
  onSelectFolder,
  onToggleFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  showUnsorted = true
}: FolderTreeProps) {
  const tree = buildFolderTree(folders);
  const unsortedPageCount = documents.filter((document) => document.folderId === null).length;
  const unsortedIsSelected = selectedFolderId === null;

  return (
    <section className="min-h-0">
      <div className="sidebar-section-heading">
        <strong className="min-w-0 truncate font-display text-sm font-black text-ink">{WORKSPACE_COPY.library}</strong>
        <button
          type="button"
          onClick={() => onCreateFolder(null)}
          aria-label="Create book"
          title="Create book"
          className="workspace-icon-button shrink-0"
        >
          <BookPlus aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <ul className="m-0 list-none space-y-1 p-0" aria-label="Books and pages">
        {showUnsorted ? <li>
          <button
            type="button"
            onClick={() => onSelectFolder(null)}
            aria-label={`${WORKSPACE_COPY.pagesWithoutBook}, ${unsortedPageCount} ${unsortedPageCount === 1 ? "page" : "pages"}, ${unsortedIsSelected ? "open" : "closed"}`}
            aria-pressed={unsortedIsSelected}
            data-selected={unsortedIsSelected}
            className="sidebar-collection-button"
          >
            <Files aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{WORKSPACE_COPY.pagesWithoutBook}</strong>
              <small className="mt-0.5 block truncate text-xs font-semibold opacity-70">
                {WORKSPACE_COPY.pagesWithoutBookHint}
              </small>
            </span>
            <span aria-hidden="true" className="sidebar-collection-count">
              {unsortedPageCount}
            </span>
          </button>
        </li> : null}

        {tree.length === 0 ? (
          <li>
            <p className="rounded border border-border bg-panel px-3 py-2 text-xs font-semibold leading-5 text-muted">
              No books yet. Create a book to group related pages.
            </p>
          </li>
        ) : null}

        {tree.map((node) => (
          <FolderTreeRow
            key={node.folder.id}
            node={node}
            depth={0}
            selectedFolderId={selectedFolderId}
            documents={documents}
            expandedFolderIds={expandedFolderIds}
            onSelectFolder={onSelectFolder}
            onToggleFolder={onToggleFolder}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
          />
        ))}
      </ul>
    </section>
  );
}

type FolderTreeRowProps = Omit<FolderTreeProps, "folders"> & {
  node: FolderNode;
  depth: number;
};

function FolderTreeRow({
  node,
  depth,
  selectedFolderId,
  documents,
  expandedFolderIds,
  onSelectFolder,
  onToggleFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder
}: FolderTreeRowProps) {
  const { folder, children } = node;
  const isExpanded = expandedFolderIds.has(folder.id);
  const hasChildren = children.length > 0;
  const isSelected = selectedFolderId === folder.id;
  const pageCount = documents.filter((document) => document.folderId === folder.id).length;

  function handleRename() {
    const nextName = window.prompt("Rename book", folder.name);

    if (nextName !== null) {
      onRenameFolder(folder.id, nextName);
    }
  }

  return (
    <li>
      <div className="group flex items-center gap-1 rounded transition hover:bg-panel" style={{ paddingLeft: `${depth * 0.75}rem` }}>
        <button
          type="button"
          onClick={() => hasChildren && onToggleFolder(folder.id)}
          disabled={!hasChildren}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-controls={hasChildren ? `book-children-${folder.id}` : undefined}
          title={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded text-muted transition hover:bg-surface-2 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-files disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            )
          ) : (
            <span aria-hidden="true" className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectFolder(folder.id)}
          aria-label={`${folder.name} book, ${pageCount} ${pageCount === 1 ? "page" : "pages"}, ${isSelected ? "open" : "closed"}`}
          aria-pressed={isSelected}
          title={`Open ${folder.name} book`}
          className={`min-w-0 flex-1 rounded border px-2 py-2 text-left text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-accent ${
            isSelected ? "border-accent-files bg-accent-files text-accent-on shadow-soft" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <span className="block truncate">{folder.name}</span>
        </button>

        <button
          type="button"
          onClick={handleRename}
          className="rounded px-2 py-1 text-xs font-black text-muted opacity-100 transition hover:bg-panel hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-files sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          aria-label={`Rename ${folder.name}`}
          title={`Rename ${folder.name}`}
        >
          Rename
        </button>

        <IconButton label={`Create book inside ${folder.name}`} onClick={() => onCreateFolder(folder.id)} className="h-8 w-8">
          <BookOpen aria-hidden="true" className="h-4 w-4" />
        </IconButton>
        <IconButton label={`Delete ${folder.name}`} onClick={() => onDeleteFolder(folder.id)} className="h-8 w-8">
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>

      {hasChildren && isExpanded ? (
        <ul
          id={`book-children-${folder.id}`}
          className="m-0 mt-1 list-none space-y-1 p-0"
          aria-label={`Books inside ${folder.name}`}
        >
          {children.map((child) => (
            <FolderTreeRow
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              documents={documents}
              expandedFolderIds={expandedFolderIds}
              onSelectFolder={onSelectFolder}
              onToggleFolder={onToggleFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
