"use client";

import { useEffect, useState, type RefObject } from "react";
import { X } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";
import { DocumentList } from "@/components/mdez/DocumentList";
import { FolderTree } from "@/components/mdez/FolderTree";
import { GitHubSourcePanel } from "@/components/mdez/GitHubSourcePanel";
import { SidebarSearch } from "@/components/mdez/SidebarSearch";
import { normalizeSidebarQuery } from "@/lib/sidebar-search";

type SidebarProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  expandedFolderIds: Set<string>;
  error: string | null;
  githubSource: GitHubSource | null;
  refreshingSourceId: string | null;
  isReady: boolean;
  workspaceKey: string;
  isHidden: boolean;
  isOverlay: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSelectFolder: (folderId: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
  onSelectDocument: (documentId: string) => void;
  onCreateDocument: () => void;
  onRequestRenameDocument: (documentId: string) => void;
  onMoveDocument: (documentId: string, folderId: string | null) => void;
  onDeleteDocument: (documentId: string) => void;
  onRefreshGitHub: (source: GitHubSource) => void;
};

export function Sidebar({
  folders,
  documents,
  selectedFolderId,
  selectedDocumentId,
  expandedFolderIds,
  error,
  githubSource,
  refreshingSourceId,
  isReady,
  workspaceKey,
  isHidden,
  isOverlay,
  sidebarRef,
  searchInputRef,
  onClose,
  onSelectFolder,
  onToggleFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSelectDocument,
  onCreateDocument,
  onRequestRenameDocument,
  onMoveDocument,
  onDeleteDocument,
  onRefreshGitHub
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const isSearching = Boolean(normalizeSidebarQuery(query));

  useEffect(() => {
    setQuery("");
  }, [workspaceKey]);

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

        <SidebarSearch
          folders={folders}
          documents={documents}
          query={query}
          disabled={!isReady}
          inputRef={searchInputRef}
          onQueryChange={setQuery}
          onSelectFolder={onSelectFolder}
          onSelectDocument={onSelectDocument}
        />

        {!isSearching && githubSource ? (
          <GitHubSourcePanel
            source={githubSource}
            isRefreshing={refreshingSourceId === githubSource.id}
            onRefresh={onRefreshGitHub}
          />
        ) : null}

        {!isSearching && error ? (
          <p className="rounded border border-accent-files/40 bg-panel p-3 text-sm font-semibold leading-6 text-ink">
            {error}
          </p>
        ) : null}

        {!isSearching ? <div className="sidebar-library-scroll min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface/80 p-3">
          {!isReady ? <p role="status" className="sidebar-loading-state">Loading library…</p> : (
          <div className="space-y-5">
            <FolderTree
              folders={folders}
              documents={documents}
              selectedFolderId={selectedFolderId}
              expandedFolderIds={expandedFolderIds}
              onSelectFolder={onSelectFolder}
              onToggleFolder={onToggleFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
            <div className="border-t border-border pt-4">
              <DocumentList
                folders={folders}
                documents={documents}
                selectedFolderId={selectedFolderId}
                selectedDocumentId={selectedDocumentId}
                onSelectDocument={onSelectDocument}
                onCreateDocument={onCreateDocument}
                onRequestRenameDocument={onRequestRenameDocument}
                onMoveDocument={onMoveDocument}
                onDeleteDocument={onDeleteDocument}
              />
            </div>
          </div>
          )}
        </div> : null}
      </div>
    </aside>
  );
}
