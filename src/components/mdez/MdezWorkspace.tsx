"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Columns2, Library, Link2, Menu, PanelLeftClose, PanelLeftOpen, PencilLine } from "lucide-react";

import { renameDocument, updateDocumentBody } from "@/lib/repository";
import type { ViewMode } from "@/types/content";
import type { GitHubImportSession, GitHubSource } from "@/types/github";
import { requestGitHubImportPreview } from "@/lib/github-import";
import { downloadBlob, ExportControls } from "@/components/mdez/ExportControls";
import { Sidebar } from "@/components/mdez/Sidebar";
import { ShelfPane } from "@/components/mdez/ShelfPane";
import { WorkspaceStatus } from "@/components/mdez/WorkspaceStatus";
import { SplitWorkspace } from "@/components/mdez/SplitWorkspace";
import { createFolderZipBlob } from "@/lib/export";
import { useDocumentDrafts } from "@/hooks/useDocumentDrafts";
import { useWorkspaceViewport } from "@/hooks/useWorkspaceViewport";
import { useWorkspaceLibrary } from "@/hooks/useWorkspaceLibrary";
import { makeMarkdownFileName } from "@/lib/markdown";
import { WORKSPACE_COPY } from "@/lib/workspace-copy";
import { CreateGroupDialog } from "@/components/mdez/CreateGroupDialog";
import { JoinGroupDialog } from "@/components/mdez/JoinGroupDialog";
import { WorkspaceSwitcher } from "@/components/mdez/WorkspaceSwitcher";
import { useKeyGroupLibrary } from "@/hooks/useKeyGroupLibrary";
import { loadRememberedGroups } from "@/lib/key-group-repository";
import type { RememberedGroup } from "@/lib/db";

const EditorPane = dynamic(
  () => import("@/components/mdez/EditorPane").then((module) => module.EditorPane),
  { ssr: false, loading: () => <p role="status">Loading editor…</p> }
);
const PreviewPane = dynamic(
  () => import("@/components/mdez/PreviewPane").then((module) => module.PreviewPane),
  { ssr: false, loading: () => <p role="status">Loading reader…</p> }
);
const ImportDialog = dynamic(
  () => import("@/components/mdez/ImportDialog").then((module) => module.ImportDialog),
  { ssr: false }
);
const QuickShareDialog = dynamic(
  () => import("@/components/mdez/QuickShareDialog").then((module) => module.QuickShareDialog),
  { ssr: false }
);
const SharedLinksDialog = dynamic(
  () => import("@/components/mdez/SharedLinksDialog").then((module) => module.SharedLinksDialog),
  { ssr: false }
);

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

export function MdezWorkspace() {
  const localLibrary = useWorkspaceLibrary();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const groupLibrary = useKeyGroupLibrary(activeGroupId);
  const library = activeGroupId ? groupLibrary : localLibrary;
  const [rememberedGroups, setRememberedGroups] = useState<RememberedGroup[]>([]);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isQuickShareOpen, setIsQuickShareOpen] = useState(false);
  const [isSharedLinksOpen, setIsSharedLinksOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("shelf");
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null);
  const [refreshingSourceId, setRefreshingSourceId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { isTabletLayout, isMobileLayout } = useWorkspaceViewport();
  const sidebarRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const reloadRememberedGroups = () => loadRememberedGroups().then(setRememberedGroups);
  useEffect(() => { void reloadRememberedGroups(); }, []);
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

  const {
    liveDocuments,
    draftBody,
    draftTitle,
    saveStatus,
    changeBody: handleDraftBodyChange,
    changeTitle: handleDraftTitleChange,
    renameTitleById: renameDraftTitle
  } = useDocumentDrafts({
    documents: library.documents,
    selectedDocumentId: library.selectedDocumentId,
    setDocuments: library.setDocuments,
    setError: library.setError,
    persistBody: groupLibrary.persistBody && activeGroupId ? groupLibrary.persistBody : updateDocumentBody,
    persistTitle: groupLibrary.persistTitle && activeGroupId ? groupLibrary.persistTitle : renameDocument
  });

  useEffect(() => {
    if (saveStatus === "Saving...") {
      setOperationStatus(null);
    }
  }, [saveStatus]);
  const activeSourceId = library.selectedFolder?.sourceId ?? library.selectedDocument?.sourceId;
  const activeGitHubSource = activeGroupId ? null : library.sources.find((source) => source.id === activeSourceId) ?? null;
  const liveSelectedDocument = liveDocuments.find(
    (document) => document.id === library.selectedDocumentId
  ) ?? null;

  const showShelf = viewMode === "shelf";
  const showEditor = viewMode === "split" || viewMode === "editor";
  const showReader = viewMode === "split" || viewMode === "preview";

  function handleSelectFolder(folderId: string | null) {
    library.selectFolder(folderId);
    setViewMode("shelf");
    setIsDrawerOpen(false);
  }

  function handleSelectDocument(documentId: string) {
    if (!library.documents.some((document) => document.id === documentId)) return;
    library.selectDocument(documentId);
    setViewMode("editor");
    setIsDrawerOpen(false);
  }

  async function handleCreateDocument() {
    try {
      await library.createPage();
      setViewMode("editor");
      setIsDrawerOpen(false);
    } catch {
      // The controller owns the exact user-facing error.
    }
  }

  async function handleImport(items: { title: string; body: string }[], folderId: string | null) {
    await library.importPages(items, folderId);
    setViewMode("editor");
    setIsDrawerOpen(false);
    const count = items.length;
    setOperationStatus({
      message: `Imported ${count} ${count === 1 ? "page" : "pages"}`,
      state: "saved"
    });
  }
  async function handleRequestGitHubPreview(url: string) {
    library.setError(null);
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
      library.setError(message);
      setOperationStatus({ message: "GitHub import failed", state: "error" });
      throw previewError;
    }
  }

  async function handleImportGitHub(session: GitHubImportSession) {
    library.setError(null);
    setOperationStatus({ message: "Importing GitHub repository", state: "loading" });

    try {
      const result = await library.importGitHub(session);
      setViewMode("editor");
      setIsDrawerOpen(false);
      setOperationStatus({
        message: "Imported " + result.source.owner + "/" + result.source.repository + " from GitHub",
        state: "saved"
      });
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Mdez could not import this repository.";
      library.setError(message);
      setOperationStatus({ message: "GitHub import failed", state: "error" });
      throw importError;
    }
  }

  async function handleRefreshGitHub(source: GitHubSource) {
    if (refreshingSourceId) return;
    const confirmed = window.confirm(
      "Refresh " + source.owner + "/" + source.repository +
      " from GitHub? This replaces local edits inside this imported book."
    );
    if (!confirmed) return;

    setRefreshingSourceId(source.id);
    library.setError(null);
    setOperationStatus({ message: "Checking GitHub for changes", state: "loading" });

    try {
      const session = await handleRequestGitHubPreview(source.normalizedUrl);
      setOperationStatus({ message: "Refreshing imported book", state: "loading" });
      await library.refreshGitHub(source.id, session);
      setViewMode("editor");
      setIsDrawerOpen(false);
      setOperationStatus({
        message: "Refreshed " + source.owner + "/" + source.repository + " from GitHub",
        state: "saved"
      });
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Mdez could not refresh this repository.";
      library.setError(message);
      setOperationStatus({ message: "GitHub refresh failed", state: "error" });
    } finally {
      setRefreshingSourceId(null);
    }
  }

  async function handleRenameDocument(documentId: string, title: string) {
    try {
      const updated = await renameDraftTitle(documentId, title);
      if (!updated) return;
      await library.renamePage(documentId, title);
    } catch {
      library.setError("Could not rename page.");
    }
  }

  async function handleSidebarFolderExport() {
    if (!library.selectedFolderId) {
      library.setError("Open a book before preparing a ZIP.");
      return;
    }
    const folder = library.folders.find((item) => item.id === library.selectedFolderId);
    if (!folder) {
      library.setError("Mdez could not find that book for export.");
      return;
    }

    try {
      const blob = await createFolderZipBlob(library.folders, liveDocuments, library.selectedFolderId);
      const fileName = makeMarkdownFileName(folder.name).replace(/\.md$/, ".zip");
      downloadBlob(blob, fileName);
      library.setError(null);
      setOperationStatus({ message: `Downloaded ${fileName}`, state: "saved" });
    } catch {
      library.setError("Mdez could not prepare the book ZIP.");
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
  const statusMessage = library.error
    ?? (saveStatus === "Saving..."
      ? "Saving changes..."
      : saveStatus === "Unsaved"
        ? "Unsaved changes"
        : operationStatus?.message ?? "Saved in this browser");
  const statusState = library.error
    ? "error"
    : saveStatus === "Saving..." || saveStatus === "Unsaved"
      ? "saving"
      : operationStatus?.state ?? "saved";
  const editorPane = (
    <EditorPane
      document={library.selectedDocument}
      title={draftTitle}
      body={draftBody}
      saveStatus={saveStatus}
      viewMode={viewMode}
      rightSlot={
        <ExportControls
          selectedDocument={liveSelectedDocument}
          onError={library.setError}
          onSuccess={(message) => setOperationStatus({ message, state: "saved" })}
        />
      }
      onCreateDocument={handleCreateDocument}
      onOpenImport={handleOpenImport}
      onQuickShare={() => setIsQuickShareOpen(true)}
      onViewModeChange={handleViewModeChange}
      onBodyChange={handleDraftBodyChange}
      onRename={handleDraftTitleChange}
    />
  );
  const readerPane = (
    <PreviewPane
      document={library.selectedDocument}
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
          <WorkspaceSwitcher
            activeGroupId={activeGroupId}
            groups={rememberedGroups}
            onSelect={setActiveGroupId}
            onCreate={() => setIsCreateGroupOpen(true)}
            onJoin={() => setIsJoinGroupOpen(true)}
          />
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
            type="button"
            onClick={() => setIsSharedLinksOpen(true)}
            aria-label="Shared links"
            className="workspace-icon-button"
          >
            <Link2 aria-hidden="true" className="h-4 w-4" />
          </button>
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
        </div>
      </header>

      <section className="workspace-content" aria-label="Mdez workspace">
        <Sidebar
          folders={library.folders}
          documents={liveDocuments}
          selectedFolderId={library.selectedFolderId}
          selectedDocumentId={library.selectedDocumentId}
          expandedFolderIds={library.expandedFolderIds}
          error={library.error}
          githubSource={activeGitHubSource}
          refreshingSourceId={refreshingSourceId}
          isHidden={sidebarIsHidden}
          isOverlay={isTabletLayout}
          sidebarRef={sidebarRef}
          onClose={() => setIsDrawerOpen(false)}
          onSelectFolder={handleSelectFolder}
          onToggleFolder={library.toggleFolder}
          onCreateFolder={library.createBook}
          onRenameFolder={library.renameBook}
          onDeleteFolder={library.deleteBook}
          onSelectDocument={handleSelectDocument}
          onCreateDocument={handleCreateDocument}
          onRenameDocument={handleRenameDocument}
          onMoveDocument={library.movePage}
          onDeleteDocument={library.deletePage}
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
            <div className="workspace-context">
              <div className="min-w-0">
                <p className="workspace-context-label">
                  {library.selectedFolder ? `${library.selectedFolder.name} book` : WORKSPACE_COPY.library}
                </p>
                {showShelf ? <h1 className="workspace-title truncate">{WORKSPACE_COPY.library}</h1> : null}
              </div>
              {!showShelf ? <p className="workspace-context-label">{readerViewOptions.find((option) => option.value === viewMode)?.label}</p> : null}
            </div>

            {showShelf ? (
              <ShelfPane
                folders={library.folders}
                documents={liveDocuments}
                selectedFolderId={library.selectedFolderId}
                selectedDocumentId={library.selectedDocumentId}
                isReady={library.isReady}
                onSelectFolder={handleSelectFolder}
                onSelectDocument={handleSelectDocument}
                onCreateDocument={handleCreateDocument}
                onCreateFolder={library.createBook}
                onOpenImport={handleOpenImport}
                onExportFolder={() => void handleSidebarFolderExport()}
              />
            ) : viewMode === "split" ? (
              <SplitWorkspace
                editor={editorPane}
                reader={readerPane}
                orientation={isTabletLayout ? "horizontal" : "vertical"}
                compact={isMobileLayout}
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
        activePage={library.selectedDocument?.title ?? WORKSPACE_COPY.library}
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
          folders={library.folders}
          selectedFolderId={library.selectedFolderId}
          onClose={() => setIsImportOpen(false)}
          onImport={handleImport}
          onRequestGitHubPreview={handleRequestGitHubPreview}
          onImportGitHub={handleImportGitHub}
        />
      ) : null}
      {isQuickShareOpen && liveSelectedDocument ? (
        <QuickShareDialog
          open
          document={liveSelectedDocument}
          onClose={() => setIsQuickShareOpen(false)}
        />
      ) : null}
      {isSharedLinksOpen ? (
        <SharedLinksDialog open onClose={() => setIsSharedLinksOpen(false)} />
      ) : null}
      <CreateGroupDialog
        open={isCreateGroupOpen}
        folders={localLibrary.folders}
        documents={localLibrary.documents}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreated={(groupId) => { void reloadRememberedGroups(); setActiveGroupId(groupId); }}
      />
      <JoinGroupDialog
        open={isJoinGroupOpen}
        onClose={() => setIsJoinGroupOpen(false)}
        onJoined={(groupId) => { void reloadRememberedGroups(); setIsJoinGroupOpen(false); setActiveGroupId(groupId); }}
      />
    </div>
  );

}
