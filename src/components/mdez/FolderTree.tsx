"use client";

import { BookOpen, ChevronDown, ChevronRight, Library } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { buildFolderTree, type FolderNode } from "@/lib/tree";
import { RowActionsPopover } from "@/components/ui/RowActionsPopover";

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
  onDeleteFolder
}: FolderTreeProps) {
  const tree = buildFolderTree(folders);

  return (
    <section className="sidebar-group min-h-0">
      <div className="sidebar-group-heading">
        <h3 className="font-display text-sm font-black text-ink">Books</h3>
        <span>{tree.length}</span>
      </div>

      <div className="sidebar-group-list" role="tree" aria-label="Books and pages">
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          role="treeitem"
          aria-selected={selectedFolderId === null}
          className={`sidebar-row sidebar-root-row ${selectedFolderId === null ? "is-selected" : ""}`}
        >
          <Library aria-hidden="true" className="sidebar-row-icon" />
          <span className="sidebar-row-copy">
            <span className="sidebar-row-title">Shelf root</span>
            <span className="sidebar-row-meta">{documents.filter((document) => document.folderId === null).length} loose pages</span>
          </span>
        </button>

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
      </div>
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
    <div>
      <div className={`sidebar-row sidebar-book-row group ${isSelected ? "is-selected" : ""}`} style={{ marginLeft: `${depth * 0.75}rem` }}>
        <button
          type="button"
          onClick={() => hasChildren && onToggleFolder(folder.id)}
          disabled={!hasChildren}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
          title={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
          className="sidebar-row-expand"
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
          role="treeitem"
          aria-level={depth + 1}
          aria-label={`${folder.name} book, ${pageCount} ${pageCount === 1 ? "page" : "pages"}, ${isSelected ? "open" : "closed"}`}
          aria-selected={isSelected}
          aria-expanded={isSelected}
          title={`Open ${folder.name} book`}
          className="sidebar-row-main"
        >
          <BookOpen aria-hidden="true" className="sidebar-row-icon" />
          <span className="sidebar-row-copy">
            <span className="sidebar-row-title">{folder.name}</span>
            <span className="sidebar-row-meta">{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
          </span>
        </button>

        <RowActionsPopover label={`More actions for ${folder.name}`} selected={isSelected}>
          <button data-row-action type="button" onClick={() => onCreateFolder(folder.id)} aria-label={`Create book inside ${folder.name}`} className="row-actions-item">Create nested book</button>
          <button data-row-action type="button" onClick={handleRename} aria-label={`Rename ${folder.name}`} className="row-actions-item">Rename book</button>
          <button data-row-action type="button" onClick={() => onDeleteFolder(folder.id)} aria-label={`Delete ${folder.name}`} className="row-actions-item row-actions-item-destructive">Delete book</button>
        </RowActionsPopover>
      </div>

      {hasChildren && isExpanded ? (
        <div className="mt-1 space-y-1" role="group">
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
        </div>
      ) : null}
    </div>
  );
}
