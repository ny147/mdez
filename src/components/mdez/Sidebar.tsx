"use client";

import type { ReactNode, RefObject } from "react";
import { Clock3, Library, Star, X } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";
import { LibraryTree } from "@/components/mdez/LibraryTree";
import { GitHubSourcePanel } from "@/components/mdez/GitHubSourcePanel";
import type { LibraryFilter } from "@/lib/library-view";

type SidebarProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  expandedCollectionId: string | null;
  error: string | null;
  githubSource: GitHubSource | null;
  refreshingSourceId: string | null;
  isHidden: boolean;
  isOverlay: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSelectFolder: (folderId: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onSelectDocument: (documentId: string) => void;
  onCreateDocument: (folderId: string | null) => void;
  onRenameDocument: (documentId: string, title: string) => void;
  onMoveDocument: (documentId: string, folderId: string | null) => void;
  onDeleteDocument: (documentId: string) => void;
  onRefreshGitHub: (source: GitHubSource) => void;
  filter: LibraryFilter;
  bookmarkCount: number;
  onSelectFilter: (filter: LibraryFilter) => void;
  workspaceControls: ReactNode;
};

export function Sidebar({
  folders,
  documents,
  selectedFolderId,
  selectedDocumentId,
  expandedCollectionId,
  error,
  githubSource,
  refreshingSourceId,
  isHidden,
  isOverlay,
  sidebarRef,
  onClose,
  onSelectFolder,
  onToggleFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSelectDocument,
  onCreateDocument,
  onRenameDocument,
  onMoveDocument,
  onDeleteDocument,
  onRefreshGitHub,
  filter,
  bookmarkCount,
  onSelectFilter,
  workspaceControls
}: SidebarProps) {
  return (
    <aside
      id="library-shelf"
      ref={sidebarRef}
      className={isOverlay ? "workspace-sidebar floating-surface" : "workspace-sidebar"}
      aria-label="Library shelf"
      aria-hidden={isHidden}
      inert={isHidden}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <strong className="font-display text-base text-ink">Library shelf</strong>
          <button type="button" onClick={onClose} aria-label="Close library shelf" className="workspace-icon-button">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="sidebar-workspace-controls">{workspaceControls}</div>

        <nav className="sidebar-primary-nav" aria-label="Library views">
          <button type="button" data-selected={filter === "all" && selectedFolderId === null} aria-pressed={filter === "all" && selectedFolderId === null} onClick={() => onSelectFilter("all")}><Library aria-hidden="true" />My library<span>{documents.length}</span></button>
          <button type="button" data-selected={filter === "recent"} aria-pressed={filter === "recent"} onClick={() => onSelectFilter("recent")}><Clock3 aria-hidden="true" />Recent pages</button>
          <button type="button" data-selected={filter === "bookmarks"} aria-pressed={filter === "bookmarks"} onClick={() => onSelectFilter("bookmarks")}><Star aria-hidden="true" />Bookmarks<span>{bookmarkCount}</span></button>
        </nav>

        {githubSource ? (
          <GitHubSourcePanel
            source={githubSource}
            isRefreshing={refreshingSourceId === githubSource.id}
            onRefresh={onRefreshGitHub}
          />
        ) : null}

        {error ? (
          <p className="rounded border border-accent-files/40 bg-panel p-3 text-sm font-semibold leading-6 text-ink">
            {error}
          </p>
        ) : null}

        <div className="sidebar-library-scroll">
          <div className="sidebar-library-sections">
            <LibraryTree
              folders={folders}
              documents={documents}
              selectedFolderId={selectedFolderId}
              selectedDocumentId={selectedDocumentId}
              expandedCollectionId={expandedCollectionId}
              onSelectFolder={onSelectFolder}
              onToggleCollection={onToggleFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onSelectDocument={onSelectDocument}
              onCreateDocument={onCreateDocument}
              onRenameDocument={onRenameDocument}
              onMoveDocument={onMoveDocument}
              onDeleteDocument={onDeleteDocument}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
