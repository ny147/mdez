"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { BookOpen, Columns2, Library, Menu, PanelLeftClose, PanelLeftOpen, PencilLine } from "lucide-react";

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
import type { Document, Folder, SaveStatus, ViewMode } from "@/types/content";
import { EditorPane } from "@/components/mdez/EditorPane";
import { downloadBlob, ExportControls } from "@/components/mdez/ExportControls";
import { ImportDialog } from "@/components/mdez/ImportDialog";
import { PreviewPane } from "@/components/mdez/PreviewPane";
import { Sidebar } from "@/components/mdez/Sidebar";
import { ShelfPane } from "@/components/mdez/ShelfPane";
import { WorkspaceStatus } from "@/components/mdez/WorkspaceStatus";
import { SplitWorkspace } from "@/components/mdez/SplitWorkspace";
import { createFolderZipBlob } from "@/lib/export";
import { makeMarkdownFileName } from "@/lib/markdown";

const SAVE_ERROR_MESSAGE = "Mdez could not save this page. Your current text remains visible in the editor.";

const readerViewOptions: { value: ViewMode; label: string }[] = [
  { value: "shelf", label: "Shelf" },
  { value: "editor", label: "Edit" },
  { value: "preview", label: "Read" },
  { value: "split", label: "Split" }
];

const mobileOptions: { value: ViewMode; label: string }[] = [
  { value: "shelf", label: "Shelf" },
  { value: "editor", label: "Edit" },
  { value: "preview", label: "Read" },
  { value: "split", label: "Split" }
];

const mobileIcons = {
  shelf: Library,
  editor: PencilLine,
  preview: BookOpen,
  split: Columns2
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
  const [viewMode, setViewMode] = useState<ViewMode>("shelf");
  const [draftBodiesById, setDraftBodiesById] = useState<Record<string, string>>({});
  const [draftTitlesById, setDraftTitlesById] = useState<Record<string, string>>({});
  const [savingBodiesById, setSavingBodiesById] = useState<Record<string, string>>({});
  const [savingTitlesById, setSavingTitlesById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobile(query.matches);

    syncViewport();
    query.addEventListener("change", syncViewport);
    return () => query.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    const savedSidebar = window.localStorage.getItem("mdez-sidebar-state");
    if (savedSidebar === "hidden") {
      setIsSidebarVisible(false);
    }
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }

    window.setTimeout(() => sidebarRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(), 0);
  }, [isDrawerOpen]);

  useEffect(() => {
    function closeOverlays(event: KeyboardEvent) {
      if (event.key !== "Escape" || !isDrawerOpen) {
        return;
      }

      setIsDrawerOpen(false);
      window.setTimeout(() => drawerTriggerRef.current?.focus(), 0);
    }

    document.addEventListener("keydown", closeOverlays);
    return () => document.removeEventListener("keydown", closeOverlays);
  }, [isDrawerOpen]);

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

  const showShelf = viewMode === "shelf";
  const showEditor = viewMode === "split" || viewMode === "editor";
  const showReader = viewMode === "split" || viewMode === "preview";

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
    setViewMode("shelf");
    setIsDrawerOpen(false);
  }

  function handleSelectDocument(documentId: string) {
    const document = documents.find((item) => item.id === documentId);

    if (!document) {
      return;
    }

    setSelectedFolderId(document.folderId);
    setSelectedDocumentId(document.id);
    expandFolderAncestors(document.folderId, folders, true);
    setViewMode("editor");
    setIsDrawerOpen(false);
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
    const name = window.prompt("New book name", "New Book");

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
      setError("Could not create book.");
    }
  }

  async function handleRenameFolder(folderId: string, name: string) {
    try {
      await renameFolder(folderId, name);
      setError(null);
      await refreshContent();
    } catch {
      setError("Could not rename book.");
    }
  }

  async function handleDeleteFolder(folderId: string) {
    if (folderHasContent(folders, documents, folderId)) {
      setError("Move or delete nested books and pages before deleting this book.");
      return;
    }

    if (!window.confirm("Delete this empty book?")) {
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
      setError("Could not delete book.");
    }
  }

  async function handleCreateDocument() {
    try {
      const document = await createDocument({
        title: "untitled.md",
        body: "# Untitled\n",
        folderId: selectedFolderId
      });

      setError(null);
      setSelectedDocumentId(document.id);
      setViewMode("editor");
      setIsDrawerOpen(false);
      await refreshContent(document.id);
    } catch {
      setError("Could not create page.");
    }
  }

  async function handleImport(items: { title: string; body: string }[], folderId: string | null) {
    try {
      const importedDocuments = await createDocuments(items, folderId);
      const newestDocumentId = importedDocuments[importedDocuments.length - 1]?.id ?? null;

      setError(null);
      setSelectedFolderId(folderId);
      expandFolderAncestors(folderId, folders, true);
      setViewMode("editor");
      setIsDrawerOpen(false);
      await refreshContent(newestDocumentId);
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
      setError("Could not rename page.");
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
      setError("Could not move page.");
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!window.confirm("Delete this page?")) {
      return;
    }

    const document = documents.find((item) => item.id === documentId);

    if (!document) {
      setError("Page not found.");
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
      setError("Could not delete page.");
    }
  }

  async function handleSidebarFolderExport() {
    if (!selectedFolderId) {
      setError("Open a book before preparing a ZIP.");
      return;
    }

    const folder = folders.find((item) => item.id === selectedFolderId);

    if (!folder) {
      setError("Mdez could not find that book for export.");
      return;
    }

    try {
      const blob = await createFolderZipBlob(folders, liveDocuments, selectedFolderId);
      downloadBlob(blob, makeMarkdownFileName(folder.name).replace(/\.md$/, ".zip"));
      setError(null);
    } catch {
      setError("Mdez could not prepare the book ZIP.");
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

  function handleViewModeChange(nextMode: ViewMode) {
    setViewMode(nextMode);
    setIsDrawerOpen(false);
  }

  function toggleDesktopSidebar() {
    const nextVisible = !isSidebarVisible;
    setIsSidebarVisible(nextVisible);
    window.localStorage.setItem("mdez-sidebar-state", nextVisible ? "visible" : "hidden");
  }

  const sidebarIsHidden = isMobile ? !isDrawerOpen : !isSidebarVisible;
  const statusMessage = error ?? (saveStatus === "Saving..." ? "Saving" : saveStatus);
  const statusState = error ? "error" : saveStatus === "Saving..." ? "saving" : "saved";  const editorPane = (
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
      onViewModeChange={handleViewModeChange}
      onBodyChange={handleDraftBodyChange}
      onRename={handleDraftTitleChange}
    />
  );
  const readerPane = (
    <PreviewPane
      document={selectedDocument}
      title={draftTitle}
      body={draftBody}
      previewOnly={viewMode === "preview"}
      onCreateDocument={handleCreateDocument}
      onOpenImport={handleOpenImport}
    />
  );
  return (
    <div
      className="workspace-shell"
      data-testid="workspace-shell"
      data-mode={viewMode}
      data-sidebar={isSidebarVisible ? "visible" : "hidden"}
    >
      <header className="workspace-topbar">
        <div className="workspace-brand">
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            aria-label="Toggle sidebar"
            aria-expanded={isSidebarVisible}
            className="workspace-icon-button desktop-sidebar-toggle"
          >
            {isSidebarVisible ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />}
          </button>
          <span className="workspace-wordmark">Mdez</span>
        </div>

        <nav className="workspace-mode-nav" aria-label="Workspace modes">
          {readerViewOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={viewMode === option.value}
              onClick={() => handleViewModeChange(option.value)}
              className="workspace-mode-button"
            >
              {option.label}
            </button>
          ))}
        </nav>

        <div className="workspace-actions">
          <button
            ref={drawerTriggerRef}
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open library shelf"
            aria-controls="library-shelf"
            aria-expanded={isDrawerOpen}
            className="workspace-icon-button mobile-drawer-trigger"
          >
            <Menu aria-hidden="true" className="h-4 w-4" />
          </button>
          <span className="hidden font-mono text-xs text-muted sm:inline">Local</span>
        </div>
      </header>

      <section className="workspace-content" aria-label="Mdez workspace">
        <Sidebar
          folders={folders}
          documents={liveDocuments}
          selectedFolderId={selectedFolderId}
          selectedDocumentId={selectedDocumentId}
          expandedFolderIds={expandedFolderIds}
          error={error}
          isHidden={sidebarIsHidden}
          sidebarRef={sidebarRef}
          onClose={() => setIsDrawerOpen(false)}
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

        {isMobile && isDrawerOpen ? (
          <button
            type="button"
            className="workspace-scrim"
            aria-label="Close library shelf"
            onClick={() => setIsDrawerOpen(false)}
          />
        ) : null}

        <main
          className="workspace-main"
          data-testid="workspace-main"
          inert={isMobile && isDrawerOpen}
        >
          <section className="workspace-surface">
            <div className="mb-4 flex min-w-0 items-center justify-between gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-muted">
                  {selectedFolder ? `${selectedFolder.name} book` : "Shelf root"}
                </p>
                <h1 className="truncate font-display text-2xl font-bold text-ink">
                  {showShelf ? "Bookshelf" : selectedDocument?.title ?? (isReady ? "No page selected" : "Loading workspace...")}
                </h1>
              </div>
            </div>

            {showShelf ? (
              <ShelfPane
                folders={folders}
                documents={liveDocuments}
                selectedFolderId={selectedFolderId}
                selectedDocumentId={selectedDocumentId}
                isReady={isReady}
                onSelectFolder={handleSelectFolder}
                onSelectDocument={handleSelectDocument}
                onCreateDocument={handleCreateDocument}
                onCreateFolder={handleCreateFolder}
                onOpenImport={handleOpenImport}
                onExportFolder={() => void handleSidebarFolderExport()}
              />
            ) : viewMode === "split" ? (
              <SplitWorkspace editor={editorPane} reader={readerPane} />
            ) : (
              <div className="grid min-h-0 gap-4">
                {showEditor ? <div data-testid="screen-editor" className="min-h-[24rem] min-w-0">{editorPane}</div> : null}
                {showReader ? <div data-testid="screen-reader" className="min-h-[24rem] min-w-0">{readerPane}</div> : null}
              </div>
            )}
          </section>
        </main>
      </section>

      <WorkspaceStatus
        message={statusMessage}
        state={statusState}
        activePage={selectedDocument?.title ?? "Shelf root"}
      />

      <nav className="mobile-mode-nav" aria-label="Workspace modes">
        {mobileOptions.map((option) => {
          const Icon = mobileIcons[option.value];
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={viewMode === option.value}
              onClick={() => handleViewModeChange(option.value)}
              className="mobile-mode-button"
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </nav>

      {isImportOpen ? (
        <ImportDialog
          folders={folders}
          selectedFolderId={selectedFolderId}
          onClose={() => setIsImportOpen(false)}
          onImport={handleImport}
        />
      ) : null}
    </div>
  );

}
