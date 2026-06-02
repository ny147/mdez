"use client";

import { Download, Upload } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { DocumentList } from "@/components/mdez/DocumentList";
import { FolderTree } from "@/components/mdez/FolderTree";
import { Mascot } from "@/components/mdez/Mascot";
import { IconButton } from "@/components/ui/IconButton";

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
  return (
    <aside className="min-h-0 rounded-[2rem] border-2 border-white/70 bg-white/10 p-4 shadow-sticker">
      <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col gap-5 lg:min-h-0">
        <div className="text-center">
          <Mascot />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-ice">Markdown Easy Reader</p>
          <h2 className="mt-1 text-4xl font-black text-bubble drop-shadow-[0_3px_0_rgba(255,255,255,0.95)]">Mdez</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenImport}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border-2 border-white/80 bg-white/10 px-3 py-2 text-sm font-black text-cream shadow-glow transition hover:border-white hover:bg-ice/20 focus:outline-none focus:ring-2 focus:ring-ice"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            Import
          </button>
          <IconButton label="Export selected folder" onClick={onExportFolder}>
            <Download aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>

        {error ? (
          <p className="rounded-3xl border-2 border-bubble/70 bg-bubble/15 p-3 text-sm font-semibold leading-6 text-cream" role="alert">
            {error}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto rounded-3xl border-2 border-white/60 bg-abyss/45 p-3">
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
            <div className="border-t-2 border-white/30 pt-4">
              <DocumentList
                folders={folders}
                documents={documents}
                selectedFolderId={selectedFolderId}
                selectedDocumentId={selectedDocumentId}
                onSelectDocument={onSelectDocument}
                onCreateDocument={onCreateDocument}
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
