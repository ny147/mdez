"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

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
  renameFolder,
  updateDocumentBody
} from "@/lib/repository";
import type { Document, Folder, MobileTab, SaveStatus, ViewMode } from "@/types/content";
import { EditorPane } from "@/components/mdez/EditorPane";
import { ImportDialog } from "@/components/mdez/ImportDialog";
import { PreviewPane } from "@/components/mdez/PreviewPane";
import { Sidebar } from "@/components/mdez/Sidebar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const SAVE_ERROR_MESSAGE = "Mdez could not save this document. Your current text remains visible in the editor.";

const readerViewOptions: { value: ViewMode; label: string }[] = [
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

function syncDraftMap(
  currentDrafts: Record<string, string>,
  documents: Document[],
  persistedValues: Record<string, string>,
  getValue: (document: Document) => string
) {
  const nextDrafts: Record<string, string> = {};
  let changed = false;

  for (const document of documents) {
    const persistedValue = getValue(document);
    const currentDraft = currentDrafts[document.id];
    const previousPersistedValue = persistedValues[document.id];
    const hasLocalDraft = currentDraft !== undefined && previousPersistedValue !== undefined && currentDraft !== previousPersistedValue;

    nextDrafts[document.id] = hasLocalDraft ? currentDraft : persistedValue;

    if (currentDraft !== nextDrafts[document.id]) {
      changed = true;
    }
  }

  return changed || Object.keys(currentDrafts).length !== documents.length ? nextDrafts : currentDrafts;
}

function persistDocumentValue(
  documentId: string,
  value: string,
  persist: (id: string, value: string) => Promise<Document>,
  saveVersions: MutableRefObject<Record<string, number>>,
  drafts: MutableRefObject<Record<string, string>>,
  setSavingDrafts: Dispatch<SetStateAction<Record<string, string>>>,
  setDocuments: Dispatch<SetStateAction<Document[]>>,
  setError: Dispatch<SetStateAction<string | null>>,
  canonicalizeDraft?: {
    getValue: (document: Document) => string;
    setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  }
) {
  const saveVersion = (saveVersions.current[documentId] ?? 0) + 1;
  saveVersions.current[documentId] = saveVersion;

  return window.setTimeout(() => {
    if (saveVersions.current[documentId] !== saveVersion || drafts.current[documentId] !== value) {
      return;
    }

    setSavingDrafts((current) => ({ ...current, [documentId]: value }));
    persist(documentId, value)
      .then((updated) => {
        if (saveVersions.current[documentId] !== saveVersion || drafts.current[documentId] !== value) {
          setSavingDrafts((current) => {
            if (current[documentId] !== value) {
              return current;
            }

            const next = { ...current };
            delete next[documentId];
            return next;
          });
          return;
        }

        if (canonicalizeDraft) {
          const canonicalValue = canonicalizeDraft.getValue(updated);

          if (canonicalValue !== value) {
            canonicalizeDraft.setDrafts((current) => {
              if (current[updated.id] !== value) {
                return current;
              }

              const next = { ...current, [updated.id]: canonicalValue };
              drafts.current = next;
              return next;
            });
          }
        }

        setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));
        setSavingDrafts((current) => {
          const next = { ...current };
          delete next[updated.id];
          return next;
        });
        setError((current) => (current === SAVE_ERROR_MESSAGE ? null : current));
      })
      .catch(() => {
        if (saveVersions.current[documentId] !== saveVersion || drafts.current[documentId] !== value) {
          setSavingDrafts((current) => {
            if (current[documentId] !== value) {
              return current;
            }

            const next = { ...current };
            delete next[documentId];
            return next;
          });
          return;
        }

        setSavingDrafts((current) => {
          const next = { ...current };
          delete next[documentId];
          return next;
        });
        setError(SAVE_ERROR_MESSAGE);
      });
  }, 650);
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
  const [draftBodiesById, setDraftBodiesById] = useState<Record<string, string>>({});
  const [draftTitlesById, setDraftTitlesById] = useState<Record<string, string>>({});
  const [savingBodiesById, setSavingBodiesById] = useState<Record<string, string>>({});
  const [savingTitlesById, setSavingTitlesById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const bodySaveVersionsRef = useRef<Record<string, number>>({});
  const titleSaveVersionsRef = useRef<Record<string, number>>({});
  const draftBodiesRef = useRef<Record<string, string>>({});
  const draftTitlesRef = useRef<Record<string, string>>({});
  const persistedBodiesRef = useRef<Record<string, string>>({});
  const persistedTitlesRef = useRef<Record<string, string>>({});

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
  const selectedDocumentKey = selectedDocument?.id ?? "";
  const draftBody = selectedDocument ? draftBodiesById[selectedDocument.id] ?? selectedDocument.body : "";
  const draftTitle = selectedDocument ? draftTitlesById[selectedDocument.id] ?? selectedDocument.title : "";
  const selectedBodyIsDirty = selectedDocument ? draftBody !== selectedDocument.body : false;
  const selectedTitleIsDirty = selectedDocument ? draftTitle !== selectedDocument.title : false;
  const selectedBodyIsSaving = selectedDocument ? savingBodiesById[selectedDocument.id] === draftBody : false;
  const selectedTitleIsSaving = selectedDocument ? savingTitlesById[selectedDocument.id] === draftTitle : false;
  const saveStatus: SaveStatus =
    selectedBodyIsSaving || selectedTitleIsSaving ? "Saving..." : selectedBodyIsDirty || selectedTitleIsDirty ? "Unsaved" : "Saved";

  useEffect(() => {
    const previousPersistedBodies = persistedBodiesRef.current;
    const previousPersistedTitles = persistedTitlesRef.current;

    setDraftBodiesById((current) => {
      const next = syncDraftMap(current, documents, previousPersistedBodies, (document) => document.body);
      draftBodiesRef.current = next;
      return next;
    });
    setDraftTitlesById((current) => {
      const next = syncDraftMap(current, documents, previousPersistedTitles, (document) => document.title);
      draftTitlesRef.current = next;
      return next;
    });

    persistedBodiesRef.current = Object.fromEntries(documents.map((document) => [document.id, document.body]));
    persistedTitlesRef.current = Object.fromEntries(documents.map((document) => [document.id, document.title]));
  }, [documents]);

  useEffect(() => {
    const timeouts: number[] = [];

    for (const document of documents) {
      const draft = draftBodiesById[document.id];

      if (draft !== undefined && draft !== document.body) {
        timeouts.push(
          persistDocumentValue(
            document.id,
            draft,
            updateDocumentBody,
            bodySaveVersionsRef,
            draftBodiesRef,
            setSavingBodiesById,
            setDocuments,
            setError
          )
        );
      }
    }

    return () => {
      for (const timeout of timeouts) {
        window.clearTimeout(timeout);
      }
    };
  }, [documents, draftBodiesById]);

  useEffect(() => {
    const timeouts: number[] = [];

    for (const document of documents) {
      const draft = draftTitlesById[document.id];

      if (draft !== undefined && draft !== document.title) {
        timeouts.push(
          persistDocumentValue(
            document.id,
            draft,
            renameDocument,
            titleSaveVersionsRef,
            draftTitlesRef,
            setSavingTitlesById,
            setDocuments,
            setError,
            {
              getValue: (document) => document.title,
              setDrafts: setDraftTitlesById
            }
          )
        );
      }
    }

    return () => {
      for (const timeout of timeouts) {
        window.clearTimeout(timeout);
      }
    };
  }, [documents, draftTitlesById]);

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
      const updated = await renameDocument(documentId, title);

      titleSaveVersionsRef.current[documentId] = (titleSaveVersionsRef.current[documentId] ?? 0) + 1;
      persistedTitlesRef.current = { ...persistedTitlesRef.current, [documentId]: updated.title };
      setDraftTitlesById((current) => {
        const next = { ...current, [documentId]: updated.title };
        draftTitlesRef.current = next;
        return next;
      });
      setSavingTitlesById((current) => {
        if (current[documentId] === undefined) {
          return current;
        }

        const next = { ...current };
        delete next[documentId];
        return next;
      });
      setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));
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

  function handleDraftBodyChange(body: string) {
    if (!selectedDocumentKey) {
      return;
    }

    setDraftBodiesById((current) => {
      const next = { ...current, [selectedDocumentKey]: body };
      draftBodiesRef.current = next;
      return next;
    });
  }

  function handleDraftTitleChange(title: string) {
    if (!selectedDocumentKey) {
      return;
    }

    setDraftTitlesById((current) => {
      const next = { ...current, [selectedDocumentKey]: title };
      draftTitlesRef.current = next;
      return next;
    });
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
                {!showEditor ? (
                  <div className="hidden lg:block">
                    <SegmentedControl label="Workspace view" value={viewMode} options={readerViewOptions} onChange={setViewMode} />
                  </div>
                ) : null}
              </div>

              <div className={`grid min-h-0 flex-1 gap-4 ${contentGridColumns}`}>
                <div
                  className={`min-h-[24rem] min-w-0 ${mobileTab === "edit" ? "block" : "hidden"} ${
                    showEditor ? "lg:block" : "lg:hidden"
                  }`}
                >
                  <EditorPane
                    document={selectedDocument}
                    title={draftTitle}
                    body={draftBody}
                    saveStatus={saveStatus}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onBodyChange={handleDraftBodyChange}
                    onRename={handleDraftTitleChange}
                  />
                </div>

                <div
                  className={`min-h-[24rem] min-w-0 ${mobileTab === "read" ? "block" : "hidden"} ${
                    showReader ? "lg:block" : "lg:hidden"
                  }`}
                >
                  <PreviewPane document={selectedDocument} title={draftTitle} body={draftBody} previewOnly={viewMode === "preview"} />
                </div>
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
