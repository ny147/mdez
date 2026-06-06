"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { BookOpen, Files, PencilLine } from "lucide-react";

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
import { downloadBlob, ExportControls } from "@/components/mdez/ExportControls";
import { ImportDialog } from "@/components/mdez/ImportDialog";
import { PreviewPane } from "@/components/mdez/PreviewPane";
import { Sidebar } from "@/components/mdez/Sidebar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { createFolderZipBlob } from "@/lib/export";
import { makeMarkdownFileName } from "@/lib/markdown";

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

const mobileIcons = {
  files: Files,
  edit: PencilLine,
  read: BookOpen
};

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

type SaveRequest = {
  value: string;
  version: number;
  resolve: (document: Document | null) => void;
  reject: (error: unknown) => void;
};

type SaveQueueEntry = {
  isRunning: boolean;
  latest: SaveRequest | null;
};

type SaveQueueRef = MutableRefObject<Record<string, SaveQueueEntry | undefined>>;

function clearSavingDraft(
  documentId: string,
  value: string,
  setSavingDrafts: Dispatch<SetStateAction<Record<string, string>>>
) {
  setSavingDrafts((current) => {
    if (current[documentId] !== value) {
      return current;
    }

    const next = { ...current };
    delete next[documentId];
    return next;
  });
}

function enqueueDocumentValue(
  documentId: string,
  value: string,
  persist: (id: string, value: string) => Promise<Document>,
  saveVersions: MutableRefObject<Record<string, number>>,
  drafts: MutableRefObject<Record<string, string>>,
  saveQueues: SaveQueueRef,
  setSavingDrafts: Dispatch<SetStateAction<Record<string, string>>>,
  setDocuments: Dispatch<SetStateAction<Document[]>>,
  setError: Dispatch<SetStateAction<string | null>>,
  canonicalizeDraft?: {
    getValue: (document: Document) => string;
    setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  }
) {
  const version = (saveVersions.current[documentId] ?? 0) + 1;
  saveVersions.current[documentId] = version;
  setSavingDrafts((current) => ({ ...current, [documentId]: value }));

  const entry = saveQueues.current[documentId] ?? { isRunning: false, latest: null };
  saveQueues.current[documentId] = entry;

  if (entry.latest) {
    entry.latest.resolve(null);
  }

  const promise = new Promise<Document | null>((resolve, reject) => {
    entry.latest = { value, version, resolve, reject };
  });

  if (!entry.isRunning) {
    entry.isRunning = true;
    void runSaveQueue(documentId, persist, saveVersions, drafts, saveQueues, setSavingDrafts, setDocuments, setError, canonicalizeDraft);
  }

  return promise;
}

async function runSaveQueue(
  documentId: string,
  persist: (id: string, value: string) => Promise<Document>,
  saveVersions: MutableRefObject<Record<string, number>>,
  drafts: MutableRefObject<Record<string, string>>,
  saveQueues: SaveQueueRef,
  setSavingDrafts: Dispatch<SetStateAction<Record<string, string>>>,
  setDocuments: Dispatch<SetStateAction<Document[]>>,
  setError: Dispatch<SetStateAction<string | null>>,
  canonicalizeDraft?: {
    getValue: (document: Document) => string;
    setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  }
) {
  const entry = saveQueues.current[documentId];

  if (!entry) {
    return;
  }

  while (entry.latest) {
    const request = entry.latest;
    entry.latest = null;

    try {
      const updated = await persist(documentId, request.value);
      const stillCurrent = saveVersions.current[documentId] === request.version && drafts.current[documentId] === request.value;

      if (!stillCurrent) {
        clearSavingDraft(documentId, request.value, setSavingDrafts);
        request.resolve(null);
        continue;
      }

      if (canonicalizeDraft) {
        const canonicalValue = canonicalizeDraft.getValue(updated);

        if (canonicalValue !== request.value) {
          canonicalizeDraft.setDrafts((current) => {
            if (current[updated.id] !== request.value) {
              return current;
            }

            const next = { ...current, [updated.id]: canonicalValue };
            drafts.current = next;
            return next;
          });
        }
      }

      setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));
      clearSavingDraft(updated.id, request.value, setSavingDrafts);
      setError((current) => (current === SAVE_ERROR_MESSAGE ? null : current));
      request.resolve(updated);
    } catch (error) {
      const stillCurrent = saveVersions.current[documentId] === request.version && drafts.current[documentId] === request.value;

      clearSavingDraft(documentId, request.value, setSavingDrafts);

      if (!stillCurrent) {
        request.resolve(null);
        continue;
      }

      setError(SAVE_ERROR_MESSAGE);
      request.reject(error);
    }
  }

  entry.isRunning = false;

  if (entry.latest) {
    entry.isRunning = true;
    void runSaveQueue(documentId, persist, saveVersions, drafts, saveQueues, setSavingDrafts, setDocuments, setError, canonicalizeDraft);
  } else {
    delete saveQueues.current[documentId];
  }
}

function persistDocumentValue(
  documentId: string,
  value: string,
  persist: (id: string, value: string) => Promise<Document>,
  saveVersions: MutableRefObject<Record<string, number>>,
  drafts: MutableRefObject<Record<string, string>>,
  saveQueues: SaveQueueRef,
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

    void enqueueDocumentValue(
      documentId,
      value,
      persist,
      saveVersions,
      drafts,
      saveQueues,
      setSavingDrafts,
      setDocuments,
      setError,
      canonicalizeDraft
    ).catch(() => undefined);
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
  const bodySaveQueuesRef = useRef<Record<string, SaveQueueEntry | undefined>>({});
  const titleSaveQueuesRef = useRef<Record<string, SaveQueueEntry | undefined>>({});
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
  const liveDocuments = useMemo(
    () =>
      documents.map((document) => ({
        ...document,
        title: draftTitlesById[document.id] ?? document.title,
        body: draftBodiesById[document.id] ?? document.body
      })),
    [documents, draftBodiesById, draftTitlesById]
  );
  const liveSelectedDocument = selectedDocument ? { ...selectedDocument, title: draftTitle, body: draftBody } : null;
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

    const documentIds = new Set(documents.map((document) => document.id));
    bodySaveVersionsRef.current = Object.fromEntries(
      Object.entries(bodySaveVersionsRef.current).filter(([documentId]) => documentIds.has(documentId))
    );
    titleSaveVersionsRef.current = Object.fromEntries(
      Object.entries(titleSaveVersionsRef.current).filter(([documentId]) => documentIds.has(documentId))
    );

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
            bodySaveQueuesRef,
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
            titleSaveQueuesRef,
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
      draftTitlesRef.current = { ...draftTitlesRef.current, [documentId]: title };
      setDraftTitlesById((current) => {
        const next = { ...current, [documentId]: title };
        draftTitlesRef.current = next;
        return next;
      });

      const updated = await enqueueDocumentValue(
        documentId,
        title,
        renameDocument,
        titleSaveVersionsRef,
        draftTitlesRef,
        titleSaveQueuesRef,
        setSavingTitlesById,
        setDocuments,
        setError,
        {
          getValue: (document) => document.title,
          setDrafts: setDraftTitlesById
        }
      );

      if (updated) {
        persistedTitlesRef.current = { ...persistedTitlesRef.current, [documentId]: updated.title };
        setError(null);
        await refreshContent(selectedDocumentId === documentId ? documentId : undefined);
      }
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

  async function handleSidebarFolderExport() {
    if (!selectedFolderId) {
      setError("Select a folder before exporting a ZIP.");
      return;
    }

    const folder = folders.find((item) => item.id === selectedFolderId);

    if (!folder) {
      setError("Mdez could not find that folder for export.");
      return;
    }

    try {
      const blob = await createFolderZipBlob(folders, liveDocuments, selectedFolderId);
      downloadBlob(blob, makeMarkdownFileName(folder.name).replace(/\.md$/, ".zip"));
      setError(null);
    } catch {
      setError("Mdez could not generate the ZIP export.");
    }
  }

  function handleOpenImport() {
    setIsImportOpen(true);
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
    <main className="relative min-h-screen overflow-hidden bg-deep-void text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(39,194,255,0.04)_1px,transparent_1px),linear-gradient(0deg,rgba(39,194,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(39,194,255,0.2),transparent_24rem),radial-gradient(circle_at_84%_14%,rgba(255,133,218,0.16),transparent_22rem),radial-gradient(circle_at_52%_96%,rgba(185,131,255,0.12),transparent_26rem)]" />
      <span className="kawaii-motif left-[7%] top-[8%] h-14 w-14 rotate-12" aria-hidden="true" />
      <span className="kawaii-motif right-[8%] top-[11%] h-10 w-10 -rotate-12" aria-hidden="true" />
      <span className="kawaii-motif bottom-[15%] left-[12%] hidden h-11 w-11 rotate-45 sm:block" aria-hidden="true" />
      <span className="kawaii-motif bottom-[21%] right-[11%] h-8 w-8 rotate-12" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-4 pb-24 pt-4 sm:px-5 lg:px-6 lg:pb-4">
        <header className="cyber-panel mb-4 flex items-center justify-between gap-3 rounded-md p-3 shadow-sticker lg:hidden">
          <div className="min-w-0">
            <p className="holo-label">Markdown Easy Reader</p>
            <h1 className="sticker-logo truncate font-display text-3xl font-black">Mdez</h1>
          </div>
          <p className="shrink-0 rounded border border-holo-blue/45 bg-deep-void/65 px-3 py-1.5 font-mono text-xs font-extrabold text-holo-blue shadow-glow">
            {saveStatus}
          </p>
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
              onOpenImport={handleOpenImport}
              onExportFolder={() => void handleSidebarFolderExport()}
            />
          </div>

          <section
            className={`cyber-panel min-h-0 rounded-md p-4 ${
              mobileTab === "files" ? "hidden lg:block" : "block"
            }`}
          >
            <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:min-h-0 lg:h-full">
              <div className="flex flex-col gap-3 border-b border-markdown-gray/20 pb-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="holo-label">
                    {selectedFolder ? selectedFolder.name : "Root"}
                  </p>
                  <h2 className="mt-1 truncate font-display text-3xl font-black text-ink">
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
                    rightSlot={
                      <ExportControls
                        folders={folders}
                        documents={liveDocuments}
                        selectedDocument={liveSelectedDocument}
                        selectedFolderId={selectedFolderId}
                        onError={setError}
                      />
                    }
                    onCreateDocument={handleCreateDocument}
                    onOpenImport={handleOpenImport}
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
                  <PreviewPane
                    document={selectedDocument}
                    title={draftTitle}
                    body={draftBody}
                    previewOnly={viewMode === "preview"}
                    onCreateDocument={handleCreateDocument}
                    onOpenImport={handleOpenImport}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <nav
        aria-label="Mobile workspace navigation"
        className="fixed inset-x-4 bottom-4 z-40 rounded-md border border-markdown-gray/30 bg-panel/90 p-1.5 shadow-[0_0_24px_rgba(39,194,255,0.26)] backdrop-blur-xl lg:hidden"
      >
        <div className="grid grid-cols-3 gap-1">
          {mobileOptions.map((option) => {
            const Icon = mobileIcons[option.value];
            const active = mobileTab === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileTab(option.value)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded px-3 text-sm font-extrabold transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-holo-blue ${
                  active
                    ? "border border-holo-blue bg-holo-blue text-deep-void shadow-glow-pink"
                    : "border border-transparent text-ink-muted hover:border-holo-blue/35 hover:bg-deep-void/45 hover:text-ink"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
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
