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
  onOpenImport: () => void;
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
  onOpenImport,
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
        <h3 className="font-display text-sm font-black text-ink">Documents</h3>
        <button
          type="button"
          onClick={onCreateDocument}
          className="holo-button min-h-9 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-holo-blue"
        >
          <FilePlus aria-hidden="true" className="h-4 w-4" />
          New document
        </button>
      </div>

      {visibleDocuments.length === 0 ? (
        <div className="rounded border border-markdown-gray/15 bg-deep-void/35 p-3">
          <p className="text-sm font-semibold leading-6 text-ink-muted">
            Create a document in {selectedFolderId ? "this folder" : "Root"} or import markdown here.
          </p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={onCreateDocument}
              className="holo-button w-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-holo-blue"
            >
              <FilePlus aria-hidden="true" className="h-4 w-4" />
              Create document
            </button>
            <button
              type="button"
              onClick={onOpenImport}
              className="holo-ghost-button w-full px-3 py-2 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-holo-blue"
            >
              Import markdown
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleDocuments.map((document) => (
            <article
              key={document.id}
              className="holo-cut-card rounded border border-markdown-gray/20 bg-panel/30 p-2 transition hover:border-holo-blue/45"
            >
              <button
                type="button"
                onClick={() => onSelectDocument(document.id)}
                aria-pressed={selectedDocumentId === document.id}
                className={`w-full rounded border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-holo-blue ${
                  selectedDocumentId === document.id
                    ? "border-holo-blue bg-holo-blue text-deep-void shadow-glow-pink"
                    : "border-transparent text-ink hover:bg-holo-blue/10 hover:text-white"
                }`}
              >
                <span className="block truncate font-display text-sm font-black">{document.title}</span>
                <span className="mt-1 block truncate text-xs font-semibold opacity-70">{document.updatedAt}</span>
              </button>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => renameDocument(document)}
                  className="rounded px-2 py-1 text-xs font-black text-ink-muted transition hover:bg-holo-blue/10 hover:text-ink focus:outline-none focus:ring-2 focus:ring-holo-blue"
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
                  className="holo-input min-w-0 flex-1 px-2 py-1 font-mono text-xs font-bold focus:ring-0"
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

                <IconButton label={`Delete ${document.title}`} onClick={() => onDeleteDocument(document.id)} className="h-8 w-8 border-holo-blue/30">
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
