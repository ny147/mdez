"use client";

import type { RefObject } from "react";
import { Download, Upload, X } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";
import { DocumentList } from "@/components/mdez/DocumentList";
import { FolderTree } from "@/components/mdez/FolderTree";
import { GitHubSourcePanel } from "@/components/mdez/GitHubSourcePanel";

type SidebarProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  expandedFolderIds: Set<string>;
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
  onCreateDocument: () => void;
  onRenameDocument: (documentId: string, title: string) => void;
  onMoveDocument: (documentId: string, folderId: string | null) => void;
  onDeleteDocument: (documentId: string) => void;
  onOpenImport: () => void;
  onExportFolder: () => void;
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
  onOpenImport,
  onExportFolder,
  onRefreshGitHub
}: SidebarProps) {
  const canExportSelectedFolder = selectedFolderId !== null;

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

        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenImport} className="primary-button flex-1 px-3 py-2">
            <Upload aria-hidden="true" className="h-4 w-4" />
            Import markdown
          </button>
          <button
            type="button"
            onClick={onExportFolder}
            disabled={!canExportSelectedFolder}
            aria-label="Book ZIP for open book in Shelf"
            title={canExportSelectedFolder ? "Download the open book as a folder ZIP" : "Open a book before exporting its folder ZIP"}
            className="secondary-button inline-flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Book ZIP
          </button>
        </div>

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

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface/80 p-3">
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
                onOpenImport={onOpenImport}
                onRenameDocument={onRenameDocument}
                onMoveDocument={onMoveDocument}
                onDeleteDocument={onDeleteDocument}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
