"use client";

import { ChevronDown, ChevronRight, FolderPlus, Trash2 } from "lucide-react";

import type { Folder } from "@/types/content";
import { buildFolderTree, type FolderNode } from "@/lib/tree";
import { IconButton } from "@/components/ui/IconButton";

type FolderTreeProps = {
  folders: Folder[];
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
    <section className="min-h-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-black text-ink">Folders</h3>
        <button
          type="button"
          onClick={() => onCreateFolder(null)}
          aria-label="New folder - create root folder"
          className="holo-ghost-button inline-flex min-h-9 items-center justify-center gap-2 px-3 py-1.5 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-holo-blue"
        >
          <FolderPlus aria-hidden="true" className="h-4 w-4" />
          New folder
        </button>
      </div>

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          aria-pressed={selectedFolderId === null}
          className={`w-full rounded border px-3 py-2 text-left text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-holo-blue ${
            selectedFolderId === null
              ? "border-holo-blue bg-holo-blue text-deep-void shadow-glow-pink"
              : "border-transparent text-ink-muted hover:border-holo-blue/30 hover:bg-holo-blue/10 hover:text-ink"
          }`}
        >
          Root
        </button>

        {tree.length === 0 ? (
          <p className="rounded border border-markdown-gray/15 bg-deep-void/25 px-3 py-2 text-xs font-semibold leading-5 text-ink-muted">
            Create folders when this library grows.
          </p>
        ) : null}

        {tree.map((node) => (
          <FolderTreeRow
            key={node.folder.id}
            node={node}
            depth={0}
            selectedFolderId={selectedFolderId}
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

  function handleRename() {
    const nextName = window.prompt("Rename folder", folder.name);

    if (nextName !== null) {
      onRenameFolder(folder.id, nextName);
    }
  }

  return (
    <div>
      <div className="group flex items-center gap-1 rounded transition hover:bg-holo-blue/10" style={{ paddingLeft: `${depth * 0.75}rem` }}>
        <button
          type="button"
          onClick={() => hasChildren && onToggleFolder(folder.id)}
          disabled={!hasChildren}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
          title={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded text-ink-muted transition hover:bg-holo-blue/10 hover:text-ink focus:outline-none focus:ring-2 focus:ring-holo-blue disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
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
          aria-pressed={isSelected}
          title={`Open ${folder.name}`}
          className={`min-w-0 flex-1 rounded border px-2 py-2 text-left text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-holo-blue ${
            isSelected ? "border-holo-blue bg-holo-blue text-deep-void shadow-glow-pink" : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <span className="block truncate">{folder.name}</span>
        </button>

        <button
          type="button"
          onClick={handleRename}
          className="rounded px-2 py-1 text-xs font-black text-ink-muted opacity-100 transition hover:bg-holo-blue/10 hover:text-ink focus:outline-none focus:ring-2 focus:ring-holo-blue sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          aria-label={`Rename ${folder.name}`}
          title={`Rename ${folder.name}`}
        >
          Rename
        </button>

        <IconButton label={`Create folder inside ${folder.name}`} onClick={() => onCreateFolder(folder.id)} className="h-8 w-8 border-holo-blue/30">
          <FolderPlus aria-hidden="true" className="h-4 w-4" />
        </IconButton>
        <IconButton label={`Delete ${folder.name}`} onClick={() => onDeleteFolder(folder.id)} className="h-8 w-8 border-holo-blue/30">
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>

      {hasChildren && isExpanded ? (
        <div className="mt-1 space-y-1">
          {children.map((child) => (
            <FolderTreeRow
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
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
