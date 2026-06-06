"use client";

import { Download, Upload } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { DocumentList } from "@/components/mdez/DocumentList";
import { FolderTree } from "@/components/mdez/FolderTree";
import { Mascot } from "@/components/mdez/Mascot";

type SidebarProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  expandedFolderIds: Set<string>;
  error: string | null;
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
};

export function Sidebar({
  folders,
  documents,
  selectedFolderId,
  selectedDocumentId,
  expandedFolderIds,
  error,
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
  onExportFolder
}: SidebarProps) {
  const canExportSelectedFolder = selectedFolderId !== null;

  return (
    <aside className="cyber-panel min-h-0 rounded-md p-4">
      <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col gap-5 lg:min-h-0">
        <div className="text-center">
          <Mascot />
          <p className="holo-label mt-4">Markdown Easy Reader</p>
          <h2 className="sticker-logo mt-1 font-display text-5xl font-black">Mdez</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenImport}
            className="holo-button flex-1 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-holo-blue"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            Import
          </button>
          <button
            type="button"
            onClick={onExportFolder}
            disabled={!canExportSelectedFolder}
            aria-label="Folder ZIP for selected folder in Files"
            className="holo-ghost-button inline-flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:border-markdown-gray/15 disabled:bg-deep-void/25 disabled:text-ink-muted/60 disabled:hover:bg-deep-void/25 disabled:hover:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-holo-blue"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Folder ZIP
          </button>
        </div>

        {error ? (
          <p className="rounded border border-oshi-pink/60 bg-oshi-pink/10 p-3 text-sm font-semibold leading-6 text-ink" role="alert">
            {error}
          </p>
        ) : null}

        <div className="cyber-subpanel min-h-0 flex-1 overflow-auto rounded-md p-3">
          <div className="space-y-5">
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              expandedFolderIds={expandedFolderIds}
              onSelectFolder={onSelectFolder}
              onToggleFolder={onToggleFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
            <div className="border-t border-markdown-gray/15 pt-4">
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
