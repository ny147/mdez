"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Columns2, Library, Menu, PanelLeftClose, PanelLeftOpen, PencilLine } from "lucide-react";

import { folderHasContent } from "@/lib/tree";
import {
  createDocument,
  createDocuments,
  createFolder,
  deleteDocument,
  deleteFolder,
  listContent,
  importGitHubSource,
  moveDocument,
  renameDocument,
  refreshGitHubSource,
  renameFolder,
  updateDocumentBody
} from "@/lib/repository";
import type { Document, Folder, ViewMode } from "@/types/content";
import type { GitHubImportSession, GitHubSource } from "@/types/github";
import { requestGitHubImportPreview } from "@/lib/github-import";
import { EditorPane } from "@/components/mdez/EditorPane";
import { downloadBlob, ExportControls } from "@/components/mdez/ExportControls";
import { ImportDialog } from "@/components/mdez/ImportDialog";
import { PreviewPane } from "@/components/mdez/PreviewPane";
import { Sidebar } from "@/components/mdez/Sidebar";
import { ShelfPane } from "@/components/mdez/ShelfPane";
import { WorkspaceStatus } from "@/components/mdez/WorkspaceStatus";
import { SplitWorkspace } from "@/components/mdez/SplitWorkspace";
import { createFolderZipBlob } from "@/lib/export";
import { useDocumentDrafts } from "@/hooks/useDocumentDrafts";
import { useWorkspaceViewport } from "@/hooks/useWorkspaceViewport";
import { makeMarkdownFileName } from "@/lib/markdown";

type OperationStatus = {
  message: string;
  state: "saved" | "loading" | "error";
};

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

export function MdezWorkspace() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [sources, setSources] = useState<GitHubSource[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("shelf");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null);
  const [refreshingSourceId, setRefreshingSourceId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { isTabletLayout, isMobileLayout } = useWorkspaceViewport();
  const sidebarRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

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
        setSources(content.sources);
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
    const savedSidebar = window.localStorage.getItem("mdez-sidebar-state");
    if (savedSidebar === "hidden") {
      setIsSidebarVisible(false);
    }
  }, []);

  useEffect(() => {
    if (!isTabletLayout || !isDrawerOpen) {
      return;
    }

    window.setTimeout(() => sidebarRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(), 0);
  }, [isDrawerOpen, isTabletLayout]);

  useEffect(() => {
    function closeOverlays(event: KeyboardEvent) {
      if (event.key !== "Escape" || !isDrawerOpen) {
        return;
      }

      setIsDrawerOpen(false);
      if (isTabletLayout) {
        window.setTimeout(() => drawerTriggerRef.current?.focus(), 0);
      }
    }

    document.addEventListener("keydown", closeOverlays);
    return () => document.removeEventListener("keydown", closeOverlays);
  }, [isDrawerOpen, isTabletLayout]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const {
    liveDocuments,
    draftBody,
    draftTitle,
    saveStatus,
    changeBody: handleDraftBodyChange,
    changeTitle: handleDraftTitleChange
  } = useDocumentDrafts({
    documents,
    selectedDocumentId,
    setDocuments,
    setError,
    persistBody: updateDocumentBody,
    persistTitle: renameDocument
  });
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const activeSourceId = selectedFolder?.sourceId ?? selectedDocument?.sourceId;
  const activeGitHubSource = sources.find((source) => source.id === activeSourceId) ?? null;
  const liveSelectedDocument = selectedDocument ? { ...selectedDocument, title: draftTitle, body: draftBody } : null;

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
    setSources(content.sources);

    if (nextSelectedDocumentId !== undefined) {
      setSelectedDocumentId(nextSelectedDocumentId);
    }
    return content;
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

  async function handleRequestGitHubPreview(url: string) {
    setError(null);
    setOperationStatus({ message: "Checking GitHub repository", state: "loading" });

    try {
      const session = await requestGitHubImportPreview(url);
      setOperationStatus({
        message: "Previewed " + session.repository.owner + "/" + session.repository.repository,
        state: "saved"
      });
      return session;
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : "Mdez could not preview this repository.";
      setError(message);
      setOperationStatus({ message: "GitHub import failed", state: "error" });
      throw previewError;
    }
  }

  async function handleImportGitHub(session: GitHubImportSession) {
    setError(null);
    setOperationStatus({ message: "Importing GitHub repository", state: "loading" });

    try {
      const result = await importGitHubSource(session);
      const content = await refreshContent(result.firstDocumentId);
      const firstDocument = content.documents.find((document) => document.id === result.firstDocumentId) ?? null;
      const folderId = firstDocument?.folderId ?? result.rootFolderId;

      setSelectedFolderId(folderId);
      expandFolderAncestors(folderId, content.folders, true);
      setViewMode("editor");
      setIsDrawerOpen(false);
      setOperationStatus({
        message: "Imported " + result.source.owner + "/" + result.source.repository + " from GitHub",
        state: "saved"
      });
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Mdez could not import this repository.";
      setError(message);
      setOperationStatus({ message: "GitHub import failed", state: "error" });
      throw importError;
    }
  }

  async function handleRefreshGitHub(source: GitHubSource) {
    if (refreshingSourceId) {
      return;
    }

    const confirmed = window.confirm(
      "Refresh " +
        source.owner +
        "/" +
        source.repository +
        " from GitHub? This replaces local edits inside this imported book."
    );

    if (!confirmed) {
      return;
    }

    setRefreshingSourceId(source.id);
    setError(null);
    setOperationStatus({ message: "Checking GitHub for changes", state: "loading" });

    try {
      const session = await handleRequestGitHubPreview(source.normalizedUrl);
      setOperationStatus({ message: "Refreshing imported book", state: "loading" });
      const result = await refreshGitHubSource(source.id, session);
      const content = await refreshContent(result.firstDocumentId);
      const firstDocument = content.documents.find((document) => document.id === result.firstDocumentId) ?? null;
      const folderId = firstDocument?.folderId ?? result.rootFolderId;

      setSelectedFolderId(folderId);
      expandFolderAncestors(folderId, content.folders, true);
      setViewMode("editor");
      setIsDrawerOpen(false);
      setOperationStatus({
        message: "Refreshed " + source.owner + "/" + source.repository + " from GitHub",
        state: "saved"
      });
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Mdez could not refresh this repository.";
      setError(message);
      setOperationStatus({ message: "GitHub refresh failed", state: "error" });
    } finally {
      setRefreshingSourceId(null);
    }
  }

  async function handleRenameDocument(documentId: string, title: string) {
    try {
      const updated = await renameDocument(documentId, title);
      setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));
      setError(null);
      await refreshContent(selectedDocumentId === documentId ? documentId : undefined);
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

  function handleViewModeChange(nextMode: ViewMode) {
    setViewMode(nextMode);
    setIsDrawerOpen(false);
  }

  function toggleDesktopSidebar() {
    const nextVisible = !isSidebarVisible;
    setIsSidebarVisible(nextVisible);
    window.localStorage.setItem("mdez-sidebar-state", nextVisible ? "visible" : "hidden");
  }

  const sidebarIsHidden = isTabletLayout ? !isDrawerOpen : !isSidebarVisible;
  const statusMessage =
    error ?? (saveStatus === "Saving..." ? "Saving" : operationStatus?.message ?? saveStatus);
  const statusState = error
    ? "error"
    : saveStatus === "Saving..."
      ? "saving"
      : operationStatus?.state ?? "saved";
  const editorPane = (
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
          githubSource={activeGitHubSource}
          refreshingSourceId={refreshingSourceId}
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
          onRefreshGitHub={(source) => void handleRefreshGitHub(source)}
        />

        {isTabletLayout && isDrawerOpen ? (
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
          inert={isTabletLayout && isDrawerOpen}
        >
          <section className="workspace-surface">
            <div className="mb-4 flex min-w-0 items-center justify-between gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-muted">
                  {selectedFolder ? selectedFolder.name + " book" : "Shelf root"}
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
              <SplitWorkspace
                editor={editorPane}
                reader={readerPane}
                orientation={isTabletLayout ? "horizontal" : "vertical"}
              />
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
        isInert={isMobileLayout && isDrawerOpen}
      />

      <nav className="mobile-mode-nav" aria-label="Workspace modes" inert={isMobileLayout && isDrawerOpen}>
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
          onRequestGitHubPreview={handleRequestGitHubPreview}
          onImportGitHub={handleImportGitHub}
        />
      ) : null}
    </div>
  );

}
