"use client";

import { useEffect, useMemo, useState } from "react";

import { folderHasContent } from "@/lib/tree";
import {
  createDocument,
  createDocuments,
  createFolder,
  deleteDocument,
  deleteFolder,
  listContent,
  moveDocument,
  renameDocument,
  renameFolder
} from "@/lib/repository";
import type { Document, Folder, MobileTab, SaveStatus, ViewMode } from "@/types/content";
import { ImportDialog } from "@/components/mdez/ImportDialog";
import { Sidebar } from "@/components/mdez/Sidebar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const viewOptions: { value: ViewMode; label: string }[] = [
  { value: "split", label: "Split" },
  { value: "editor", label: "Edit" },
  { value: "preview", label: "Read" }
];

const mobileOptions: { value: MobileTab; label: string }[] = [
  { value: "files", label: "Files" },
  { value: "edit", label: "Edit" },
  { value: "read", label: "Read" }
];

function byOrderThenTitle(a: Document, b: Document) {
  return a.order - b.order || a.title.localeCompare(b.title);
}

function getAncestorFolderIds(folders: Folder[], folderId: string | null) {
  const ancestors: string[] = [];
  let currentFolder = folders.find((folder) => folder.id === folderId) ?? null;
  const visited = new Set<string>();

  while (currentFolder?.parentId && !visited.has(currentFolder.parentId)) {
    ancestors.push(currentFolder.parentId);
    visited.add(currentFolder.parentId);
    currentFolder = folders.find((folder) => folder.id === currentFolder?.parentId) ?? null;
  }

  return ancestors;
}

function getExpandedFolderIdsForSelection(folders: Folder[], folderId: string | null) {
  return folderId ? [...getAncestorFolderIds(folders, folderId), folderId] : [];
}

export function MdezWorkspace() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [mobileTab, setMobileTab] = useState<MobileTab>("files");
  const [saveStatus] = useState<SaveStatus>("Saved");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let alive = true;

    listContent()
      .then((content) => {
        if (!alive) {
          return;
        }

        const firstDocument = content.documents[0] ?? null;

        setFolders(content.folders);
        setDocuments(content.documents);
        setSelectedDocumentId(firstDocument?.id ?? null);
        setSelectedFolderId(firstDocument?.folderId ?? null);
        setExpandedFolderIds(new Set(getExpandedFolderIdsForSelection(content.folders, firstDocument?.folderId ?? null)));
        setIsReady(true);
      })
      .catch(() => {
        if (!alive) {
          return;
        }

        setError("IndexedDB is unavailable. Mdez can show the workspace, but it cannot save local documents in this browser session.");
        setIsReady(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;

  const showEditor = viewMode === "split" || viewMode === "editor";
  const showReader = viewMode === "split" || viewMode === "preview";
  const contentGridColumns = viewMode === "split" ? "lg:grid-cols-2" : "lg:grid-cols-1";

  function expandFolderAncestors(folderId: string | null, sourceFolders = folders, includeFolder = false) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);

      for (const ancestorId of getAncestorFolderIds(sourceFolders, folderId)) {
        next.add(ancestorId);
      }

      if (includeFolder && folderId !== null) {
        next.add(folderId);
      }

      return next;
    });
  }

  function handleSelectFolder(folderId: string | null) {
    const firstDocument = documents
      .filter((document) => document.folderId === folderId)
      .sort(byOrderThenTitle)[0];

    setSelectedFolderId(folderId);
    setSelectedDocumentId(firstDocument?.id ?? null);
    expandFolderAncestors(folderId, folders, true);
  }

  function handleSelectDocument(documentId: string) {
    const document = documents.find((item) => item.id === documentId);

    if (!document) {
      return;
    }

    setSelectedFolderId(document.folderId);
    setSelectedDocumentId(document.id);
    expandFolderAncestors(document.folderId, folders, true);
    setMobileTab("edit");
  }

  async function refreshContent(nextSelectedDocumentId?: string | null) {
    const content = await listContent();

    setFolders(content.folders);
    setDocuments(content.documents);

    if (nextSelectedDocumentId !== undefined) {
      setSelectedDocumentId(nextSelectedDocumentId);
    }
  }

  function handleToggleFolder(folderId: string) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);

      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }

      return next;
    });
  }

  async function handleCreateFolder(parentId: string | null) {
    const name = window.prompt("New folder name", "New Folder");

    if (name === null) {
      return;
    }

    try {
      const folder = await createFolder(name, parentId);

      setError(null);
      setExpandedFolderIds((current) => {
        const next = new Set(current);

        for (const ancestorId of getAncestorFolderIds(folders, parentId)) {
          next.add(ancestorId);
        }

        if (parentId !== null) {
          next.add(parentId);
        }

        next.add(folder.id);
        return next;
      });
      setSelectedFolderId(folder.id);
      await refreshContent(null);
    } catch {
      setError("Could not create folder.");
    }
  }

  async function handleRenameFolder(folderId: string, name: string) {
    try {
      await renameFolder(folderId, name);
      setError(null);
      await refreshContent();
    } catch {
      setError("Could not rename folder.");
    }
  }

  async function handleDeleteFolder(folderId: string) {
    if (folderHasContent(folders, documents, folderId)) {
      setError("Move or delete nested folders and documents before deleting this folder.");
      return;
    }

    if (!window.confirm("Delete this empty folder?")) {
      return;
    }

    try {
      await deleteFolder(folderId);
      setError(null);
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        next.delete(folderId);
        return next;
      });

      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
        await refreshContent(null);
      } else {
        await refreshContent();
      }
    } catch {
      setError("Could not delete folder.");
    }
  }

  async function handleCreateDocument() {
    try {
      const document = await createDocument({
        title: "Untitled Document",
        body: "# Untitled Document\n",
        folderId: selectedFolderId
      });

      setError(null);
      setSelectedDocumentId(document.id);
      await refreshContent(document.id);
      setMobileTab("edit");
    } catch {
      setError("Could not create document.");
    }
  }

  async function handleImport(items: { title: string; body: string }[], folderId: string | null) {
    try {
      const importedDocuments = await createDocuments(items, folderId);
      const newestDocumentId = importedDocuments[importedDocuments.length - 1]?.id ?? null;

      setError(null);
      setSelectedFolderId(folderId);
      expandFolderAncestors(folderId, folders, true);
      await refreshContent(newestDocumentId);
      setMobileTab("edit");
    } catch {
      setError("Could not import markdown.");
      throw new Error("Could not import markdown.");
    }
  }

  async function handleRenameDocument(documentId: string, title: string) {
    try {
      await renameDocument(documentId, title);
      setError(null);
      await refreshContent(selectedDocumentId === documentId ? documentId : undefined);
    } catch {
      setError("Could not rename document.");
    }
  }

  async function handleMoveDocument(documentId: string, folderId: string | null) {
    try {
      await moveDocument(documentId, folderId);
      setError(null);
      setSelectedFolderId(folderId);
      setSelectedDocumentId(documentId);
      expandFolderAncestors(folderId, folders, true);
      await refreshContent(documentId);
    } catch {
      setError("Could not move document.");
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!window.confirm("Delete this document?")) {
      return;
    }

    const document = documents.find((item) => item.id === documentId);

    if (!document) {
      setError("Document not found.");
      return;
    }

    const nextDocument =
      selectedDocumentId === documentId
        ? documents
            .filter((item) => item.id !== documentId && item.folderId === document.folderId)
            .sort(byOrderThenTitle)[0] ?? null
        : documents.find((item) => item.id === selectedDocumentId) ?? null;

    try {
      await deleteDocument(documentId);
      setError(null);
      await refreshContent(nextDocument?.id ?? null);
    } catch {
      setError("Could not delete document.");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-abyss text-cream">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(159,234,255,0.24),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(200,168,255,0.18),transparent_24%),radial-gradient(circle_at_50%_95%,rgba(255,128,204,0.16),transparent_30%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-4 py-4 sm:px-5 lg:px-6">
        <header className="mb-4 flex items-center justify-between gap-3 rounded-[2rem] border-2 border-white/70 bg-white/10 p-3 shadow-sticker lg:hidden">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ice">Mdez</p>
            <h1 className="truncate text-2xl font-black text-bubble">Workspace</h1>
          </div>
          <SegmentedControl label="Mobile workspace view" value={mobileTab} options={mobileOptions} onChange={setMobileTab} />
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className={`min-h-0 lg:block ${mobileTab === "files" ? "block" : "hidden"}`}>
            <Sidebar
              folders={folders}
              documents={documents}
              selectedFolderId={selectedFolderId}
              selectedDocumentId={selectedDocumentId}
              expandedFolderIds={expandedFolderIds}
              error={error}
              onSelectFolder={handleSelectFolder}
              onToggleFolder={handleToggleFolder}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onSelectDocument={handleSelectDocument}
              onCreateDocument={handleCreateDocument}
              onRenameDocument={handleRenameDocument}
              onMoveDocument={handleMoveDocument}
              onDeleteDocument={handleDeleteDocument}
              onOpenImport={() => {
                setIsImportOpen(true);
              }}
              onExportFolder={() => setError("Folder export connects in Task 11.")}
            />
          </div>

          <section
            className={`min-h-0 rounded-[2rem] border-2 border-white/70 bg-white/10 p-4 shadow-sticker ${
              mobileTab === "files" ? "hidden lg:block" : "block"
            }`}
          >
            <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:min-h-0 lg:h-full">
              <div className="flex flex-col gap-3 border-b-2 border-white/40 pb-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-ice">
                    {selectedFolder ? selectedFolder.name : "Root"}
                  </p>
                  <h2 className="mt-1 truncate text-3xl font-black text-cream">
                    {selectedDocument?.title ?? (isReady ? "No document selected" : "Loading workspace...")}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="rounded-full border-2 border-white/60 bg-abyss/45 px-3 py-1.5 text-sm font-bold text-cream/80">{saveStatus}</p>
                  <div className="hidden lg:block">
                    <SegmentedControl label="Workspace view" value={viewMode} options={viewOptions} onChange={setViewMode} />
                  </div>
                </div>
              </div>

              <div className={`grid min-h-0 flex-1 gap-4 ${contentGridColumns}`}>
                <article
                  className={`min-h-[24rem] rounded-3xl border-2 border-white/60 bg-abyss/55 p-4 ${
                    mobileTab === "edit" ? "block" : "hidden"
                  } ${showEditor ? "lg:block" : "lg:hidden"}`}
                >
                  <div className="flex h-full flex-col">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-mint">Editor</p>
                    <div className="mt-4 flex flex-1 items-center justify-center rounded-[1.5rem] border-2 border-dashed border-white/40 bg-white/5 p-6 text-center">
                      <p className="max-w-sm text-sm font-semibold leading-6 text-cream/70">
                        {selectedDocument
                          ? "Editor placeholder. Markdown editing arrives in the next task."
                          : "Choose a document to start editing."}
                      </p>
                    </div>
                  </div>
                </article>

                <article
                  className={`min-h-[24rem] rounded-3xl border-2 border-white/60 bg-cream p-4 text-abyss ${
                    mobileTab === "read" ? "block" : "hidden"
                  } ${showReader ? "lg:block" : "lg:hidden"}`}
                >
                  <div className="flex h-full flex-col">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-bubble">Reader</p>
                    <div className="mt-4 flex flex-1 items-center justify-center rounded-[1.5rem] border-2 border-dashed border-abyss/30 bg-white p-6 text-center">
                      <p className="max-w-sm text-sm font-semibold leading-6 text-abyss/65">
                        {selectedDocument
                          ? "Reader placeholder. Rendered markdown preview arrives in the next task."
                          : "Select a document to preview it here."}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </div>
      </div>
      {isImportOpen ? (
        <ImportDialog
          folders={folders}
          selectedFolderId={selectedFolderId}
          onClose={() => setIsImportOpen(false)}
          onImport={handleImport}
        />
      ) : null}
    </main>
  );
}
