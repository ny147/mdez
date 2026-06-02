"use client";

import { FilePlus, Trash2 } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { IconButton } from "@/components/ui/IconButton";

type DocumentListProps = {
  folders: Folder[];
  documents: Document[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onCreateDocument: () => void;
  onRenameDocument: (documentId: string, title: string) => void;
  onMoveDocument: (documentId: string, folderId: string | null) => void;
  onDeleteDocument: (documentId: string) => void;
};

export function DocumentList({
  folders,
  documents,
  selectedFolderId,
  selectedDocumentId,
  onSelectDocument,
  onCreateDocument,
  onRenameDocument,
  onMoveDocument,
  onDeleteDocument
}: DocumentListProps) {
  const visibleDocuments = documents
    .filter((document) => document.folderId === selectedFolderId)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  function renameDocument(document: Document) {
    const nextTitle = window.prompt("Rename document", document.title);

    if (nextTitle !== null) {
      onRenameDocument(document.id, nextTitle);
    }
  }

  return (
    <section className="min-h-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-cream/75">Documents</h3>
        <IconButton label="Create document" onClick={onCreateDocument} className="h-9 w-9">
          <FilePlus aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>

      {visibleDocuments.length === 0 ? (
        <p className="rounded-2xl bg-white/10 p-3 text-sm leading-6 text-cream/70">No documents in this folder yet.</p>
      ) : (
        <div className="space-y-2">
          {visibleDocuments.map((document) => (
            <article key={document.id} className="rounded-2xl border-2 border-white/30 bg-white/5 p-2 transition hover:border-white/60">
              <button
                type="button"
                onClick={() => onSelectDocument(document.id)}
                onDoubleClick={() => renameDocument(document)}
                aria-pressed={selectedDocumentId === document.id}
                className={`w-full rounded-xl px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-ice ${
                  selectedDocumentId === document.id ? "bg-bubble text-abyss" : "text-cream/85 hover:bg-white/10 hover:text-cream"
                }`}
              >
                <span className="block truncate text-sm font-black">{document.title}</span>
                <span className="mt-1 block truncate text-xs font-semibold opacity-70">{document.updatedAt}</span>
              </button>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => renameDocument(document)}
                  className="rounded-full px-2 py-1 text-xs font-black text-cream/70 transition hover:bg-white/10 hover:text-cream focus:outline-none focus:ring-2 focus:ring-ice"
                  aria-label={`Rename ${document.title}`}
                  title={`Rename ${document.title}`}
                >
                  Rename
                </button>

                <select
                  value={document.folderId ?? ""}
                  onChange={(event) => onMoveDocument(document.id, event.target.value || null)}
                  aria-label={`Move ${document.title}`}
                  title={`Move ${document.title}`}
                  className="min-w-0 flex-1 rounded-full border-2 border-white/50 bg-abyss px-2 py-1 text-xs font-bold text-cream focus:outline-none focus:ring-2 focus:ring-ice"
                >
                  <option value="">Root</option>
                  {folders
                    .slice()
                    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                </select>

                <IconButton label={`Delete ${document.title}`} onClick={() => onDeleteDocument(document.id)} className="h-8 w-8 border-white/50">
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
