"use client";

import React, { type CSSProperties } from "react";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";

import { BookActionsMenu } from "@/components/mdez/BookActionsMenu";
import type { Document, Folder } from "@/types/content";
import { buildFolderTree, type FolderNode } from "@/lib/tree";
import { WORKSPACE_COPY } from "@/lib/workspace-copy";

type FolderTreeProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  expandedFolderIds: Set<string>;
  onSelectFolder: (folderId: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
};

function countLabel(count: number) {
  return `${count} ${count === 1 ? "page" : "pages"}`;
}

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
  const rootPageCount = documents.filter((document) => document.folderId === null).length;

  return (
    <section className="sidebar-section" aria-labelledby="sidebar-books-heading">
      <div className="sidebar-section-header">
        <div className="sidebar-section-heading">
          <h3 id="sidebar-books-heading">{WORKSPACE_COPY.books}</h3>
          <span className="sidebar-section-count">{folders.length} {folders.length === 1 ? "book" : "books"}</span>
        </div>
        <button type="button" onClick={() => onCreateFolder(null)} aria-label="Create book" className="sidebar-header-action">
          <BookOpen aria-hidden="true" className="h-4 w-4" />
          <span>Create book</span>
        </button>
      </div>

      <ul className="sidebar-book-list" aria-label="Books and pages">
        <li className="sidebar-book-item">
          <div className="sidebar-book-row sidebar-book-row-root" data-selected={selectedFolderId === null}>
            <span aria-hidden="true" className="sidebar-disclosure-spacer" />
            <button
              type="button"
              onClick={() => onSelectFolder(null)}
              aria-label={`${WORKSPACE_COPY.pagesWithoutBook}, ${countLabel(rootPageCount)}, ${selectedFolderId === null ? "open" : "closed"}`}
              aria-pressed={selectedFolderId === null}
              className="sidebar-item-select"
            >
              <span className="sidebar-item-title" title={WORKSPACE_COPY.pagesWithoutBook}>{WORKSPACE_COPY.pagesWithoutBook}</span>
              <span className="sidebar-item-count" aria-hidden="true">{rootPageCount}</span>
            </button>
            <span aria-hidden="true" className="sidebar-actions-spacer" />
          </div>
        </li>

        {tree.length === 0 ? (
          <li className="sidebar-empty-state">
            <strong>No books yet</strong>
            <span>Create one to group related pages.</span>
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

type FolderTreeRowProps = Omit<FolderTreeProps, "folders"> & { node: FolderNode; depth: number };

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
  const rowStyle = { "--tree-depth": Math.min(depth, 4) } as CSSProperties;

  return (
    <li className="sidebar-book-item">
      <div className="sidebar-book-row" data-selected={isSelected} style={rowStyle}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleFolder(folder.id)}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
            aria-expanded={isExpanded}
            aria-controls={`book-children-${folder.id}`}
            title={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
            className="sidebar-disclosure"
          >
            {isExpanded ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
          </button>
        ) : <span aria-hidden="true" className="sidebar-disclosure-spacer" />}

        <button
          type="button"
          onClick={() => onSelectFolder(folder.id)}
          aria-label={`${folder.name} book, ${countLabel(pageCount)}, ${isSelected ? "open" : "closed"}`}
          aria-pressed={isSelected}
          title={`Open ${folder.name} book`}
          className="sidebar-item-select"
        >
          <span className="sidebar-item-title" title={folder.name}>{folder.name}</span>
          <span className="sidebar-item-count" aria-hidden="true">{pageCount}</span>
        </button>

        <BookActionsMenu
          folder={folder}
          onCreateInside={() => onCreateFolder(folder.id)}
          onRename={() => onRenameFolder(folder)}
          onDelete={() => onDeleteFolder(folder.id)}
        />
      </div>

      {hasChildren && isExpanded ? (
        <ul id={`book-children-${folder.id}`} className="sidebar-book-children" aria-label={`Books inside ${folder.name}`}>
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
