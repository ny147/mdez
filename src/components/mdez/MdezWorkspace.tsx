"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Columns2, Library, Link2, Menu, PanelLeftClose, PanelLeftOpen, PencilLine, RefreshCw, Settings } from "lucide-react";

import { renameDocument, updateDocumentBody } from "@/lib/repository";
import type { ViewMode } from "@/types/content";
import type { GitHubImportSession, GitHubSource } from "@/types/github";
import { requestGitHubImportPreview } from "@/lib/github-import";
import { downloadBlob, ExportControls } from "@/components/mdez/ExportControls";
import { Sidebar } from "@/components/mdez/Sidebar";
import { AnimatedBrandLogo } from "@/components/mdez/AnimatedBrandLogo";
import { ShelfPane } from "@/components/mdez/ShelfPane";
import { LibrarySearch } from "@/components/mdez/LibrarySearch";
import { WorkspaceStatus } from "@/components/mdez/WorkspaceStatus";
import { SplitWorkspace } from "@/components/mdez/SplitWorkspace";
import { createFolderZipBlob } from "@/lib/export";
import { useDocumentDrafts, type PersistedDraftConflict } from "@/hooks/useDocumentDrafts";
import { useWorkspaceViewport } from "@/hooks/useWorkspaceViewport";
import { useWorkspaceLibrary } from "@/hooks/useWorkspaceLibrary";
import { makeMarkdownFileName } from "@/lib/markdown";
import { WORKSPACE_COPY } from "@/lib/workspace-copy";
import { CreateGroupDialog } from "@/components/mdez/CreateGroupDialog";
import { JoinGroupDialog } from "@/components/mdez/JoinGroupDialog";
import { WorkspaceSwitcher } from "@/components/mdez/WorkspaceSwitcher";
import { useKeyGroupLibrary } from "@/hooks/useKeyGroupLibrary";
import { forgetGroup, loadRememberedGroups } from "@/lib/key-group-repository";
import type { RememberedGroup } from "@/lib/db";
import type { GroupConflict } from "@/types/key-group";
import { GroupConflictDialog } from "@/components/mdez/GroupConflictDialog";
import { GroupSettingsDialog } from "@/components/mdez/GroupSettingsDialog";
import { selectLibraryView, type LibraryFilter } from "@/lib/library-view";
import { usePageBookmarks } from "@/hooks/usePageBookmarks";
import { useWorkspaceResume } from "@/hooks/useWorkspaceResume";
import { loadLastContentMode, saveLastContentMode } from "@/lib/workspace-ui-preferences";

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

const workspacePanelId = "workspace-mode-panel";

function modeTabId(location: "desktop" | "mobile", mode: ViewMode) {
  return `${location}-workspace-mode-${mode}`;
}

export function MdezWorkspace() {
  const localLibrary = useWorkspaceLibrary();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const groupLibrary = useKeyGroupLibrary(activeGroupId);
  const library = activeGroupId ? groupLibrary : localLibrary;
  const [rememberedGroups, setRememberedGroups] = useState<RememberedGroup[]>([]);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [persistConflict, setPersistConflict] = useState<{ conflict: GroupConflict; draft: PersistedDraftConflict } | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [groupSettingsBusy, setGroupSettingsBusy] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isQuickShareOpen, setIsQuickShareOpen] = useState(false);
  const [isSharedLinksOpen, setIsSharedLinksOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("shelf");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null);
  const [refreshingSourceId, setRefreshingSourceId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { isTabletLayout, isMobileLayout } = useWorkspaceViewport();
  const sidebarRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const recordNextSelectionRef = useRef(false);
  const lastNonShelfModeRef = useRef<ViewMode>("editor");
  const modeWorkspaceRef = useRef<string | null>(null);
  const workspaceId = activeGroupId ? `group:${activeGroupId}` : "local";
  const bookmarkMetadata = usePageBookmarks(workspaceId);
  const resumeMetadata = useWorkspaceResume(workspaceId);
  const reloadRememberedGroups = () => loadRememberedGroups().then(setRememberedGroups);
  useEffect(() => { void reloadRememberedGroups(); }, []);
  useEffect(() => {
    setLibraryFilter("all");
    setLibraryQuery("");
  }, [workspaceId]);
  useEffect(() => {
    if (modeWorkspaceRef.current !== workspaceId) {
      modeWorkspaceRef.current = workspaceId;
      const saved = loadLastContentMode(workspaceId);
      lastNonShelfModeRef.current = saved;
      if (viewMode !== "shelf" && viewMode !== saved) setViewMode(saved);
      return;
    }
    if (viewMode === "shelf") return;
    lastNonShelfModeRef.current = viewMode;
    saveLastContentMode(workspaceId, viewMode);
  }, [viewMode, workspaceId]);
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

  useEffect(() => {
    function handleLibraryShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("en-US") === "k") {
        event.preventDefault();
        librarySearchRef.current?.focus();
        return;
      }
      if (event.key === "Escape" && libraryQuery) {
        setLibraryQuery("");
      }
    }
    document.addEventListener("keydown", handleLibraryShortcut);
    return () => document.removeEventListener("keydown", handleLibraryShortcut);
  }, [libraryQuery]);

  const {
    liveDocuments,
    draftBody,
    draftTitle,
    saveStatus,
    changeBody: handleDraftBodyChange,
    changeTitle: handleDraftTitleChange,
    renameTitleById: renameDraftTitle,
    discardDraft
  } = useDocumentDrafts({
    documents: library.documents,
    selectedDocumentId: library.selectedDocumentId,
    setDocuments: library.setDocuments,
    setError: library.setError,
    persistBody: groupLibrary.persistBody && activeGroupId ? groupLibrary.persistBody : updateDocumentBody,
    persistTitle: groupLibrary.persistTitle && activeGroupId ? groupLibrary.persistTitle : renameDocument,
    onPersistConflict: activeGroupId ? (conflict, draft) => setPersistConflict({ conflict, draft }) : undefined
  });

  async function reloadConflict() {
    if (!persistConflict || !groupLibrary.reloadConflictDocument) return;
    setConflictBusy(true);
    try { const shared = await groupLibrary.reloadConflictDocument(persistConflict.draft.id); discardDraft(persistConflict.draft.id, shared); setPersistConflict(null); }
    catch (cause) { library.setError(cause instanceof Error ? cause.message : "Could not reload shared page"); }
    finally { setConflictBusy(false); }
  }

  async function copyConflict() {
    if (!persistConflict || !groupLibrary.copyConflictDraft) return;
    setConflictBusy(true);
    try { await groupLibrary.copyConflictDraft(persistConflict.draft); setPersistConflict(null); }
    catch (cause) { library.setError(cause instanceof Error ? cause.message : "Could not copy draft"); }
    finally { setConflictBusy(false); }
  }

  useEffect(() => {
    if (saveStatus === "Saving...") {
      setOperationStatus(null);
    }
  }, [saveStatus]);
  useEffect(() => { groupLibrary.setRefreshBlocked?.(saveStatus !== "Saved" || Boolean(persistConflict)); }, [groupLibrary, persistConflict, saveStatus]);

  async function leaveGroup() {
    if (!activeGroupId) return; setGroupSettingsBusy(true);
    try { await forgetGroup(activeGroupId); setActiveGroupId(null); setIsGroupSettingsOpen(false); await reloadRememberedGroups(); }
    finally { setGroupSettingsBusy(false); }
  }
  async function renameActiveGroup(name: string) { setGroupSettingsBusy(true); try { await groupLibrary.renameGroup?.(name); await reloadRememberedGroups(); } finally { setGroupSettingsBusy(false); } }
  async function deleteActiveGroup() { if (!window.confirm("Delete this group for every key holder?")) return; setGroupSettingsBusy(true); try { await groupLibrary.deleteGroup?.(); } finally { setGroupSettingsBusy(false); } }
  async function restoreActiveGroup() { setGroupSettingsBusy(true); try { await groupLibrary.restoreGroup?.(); } finally { setGroupSettingsBusy(false); } }
  const activeSourceId = library.selectedFolder?.sourceId ?? library.selectedDocument?.sourceId;
  const activeGitHubSource = activeGroupId ? null : library.sources.find((source) => source.id === activeSourceId) ?? null;
  const liveSelectedDocument = liveDocuments.find(
    (document) => document.id === library.selectedDocumentId
  ) ?? null;
  const libraryView = useMemo(() => selectLibraryView({
    documents: liveDocuments,
    folders: library.folders,
    selectedFolderId: library.selectedFolderId,
    filter: libraryFilter,
    query: libraryQuery,
    bookmarkedIds: bookmarkMetadata.bookmarkedIds,
    lastOpenedDocumentId: resumeMetadata.lastOpenedDocumentId
  }), [bookmarkMetadata.bookmarkedIds, library.folders, library.selectedFolderId, libraryFilter, libraryQuery, liveDocuments, resumeMetadata.lastOpenedDocumentId]);

  useEffect(() => {
    if (!recordNextSelectionRef.current || !library.selectedDocumentId) return;
    recordNextSelectionRef.current = false;
    void resumeMetadata.recordOpened(library.selectedDocumentId).catch(() => {
      setOperationStatus({ message: "Resume history could not be saved", state: "error" });
    });
  }, [library.selectedDocumentId, resumeMetadata]);

  const showShelf = viewMode === "shelf";
  const showEditor = viewMode === "split" || viewMode === "editor";
  const showReader = viewMode === "split" || viewMode === "preview";

  function handleSelectFolder(folderId: string | null) {
    setLibraryFilter("all");
    library.selectFolder(folderId);
    setViewMode("shelf");
    setIsDrawerOpen(false);
  }

  function handleSelectDocument(documentId: string) {
    if (!library.documents.some((document) => document.id === documentId)) return;
    library.selectDocument(documentId);
    void resumeMetadata.recordOpened(documentId).catch(() => {
      setOperationStatus({ message: "Resume history could not be saved", state: "error" });
    });
    if (viewMode === "shelf") setViewMode(lastNonShelfModeRef.current);
    setIsDrawerOpen(false);
  }

  async function handleCreateDocument(folderId?: string | null | unknown) {
    try {
      const targetFolderId = typeof folderId === "string" || folderId === null ? folderId : undefined;
      recordNextSelectionRef.current = true;
      await library.createPage(targetFolderId);
      setViewMode("editor");
      setIsDrawerOpen(false);
    } catch {
      recordNextSelectionRef.current = false;
      // The controller owns the exact user-facing error.
    }
  }

  async function handleImport(items: { title: string; body: string }[], folderId: string | null) {
    recordNextSelectionRef.current = true;
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
      recordNextSelectionRef.current = true;
      const result = await library.importGitHub(session);
      setViewMode("editor");
      setIsDrawerOpen(false);
      setOperationStatus({
        message: "Imported " + result.source.owner + "/" + result.source.repository + " from GitHub",
        state: "saved"
      });
    } catch (importError) {
      recordNextSelectionRef.current = false;
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
      throw new Error("Could not rename page.");
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

  function handleLibraryFilter(nextFilter: LibraryFilter) {
    setLibraryFilter(nextFilter);
    library.selectFolder(null);
    setViewMode("shelf");
    setIsDrawerOpen(false);
  }

  function handleLibrarySearchSubmit() {
    if (!libraryQuery.trim()) return;
    setViewMode("shelf");
    setIsDrawerOpen(false);
  }

  function handleToggleBookmark(documentId: string) {
    void bookmarkMetadata.toggleBookmark(documentId).catch(() => {
      setOperationStatus({ message: "Bookmark could not be saved", state: "error" });
    });
  }

  function handleViewModeChange(nextMode: ViewMode) {
    setViewMode(nextMode);
    setIsDrawerOpen(false);
    if (nextMode !== "shelf" && library.selectedDocumentId) {
      void resumeMetadata.recordOpened(library.selectedDocumentId).catch(() => {
        setOperationStatus({ message: "Resume history could not be saved", state: "error" });
      });
    }
  }

  function handleModeTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, options: { value: ViewMode }[]) {
    const currentIndex = options.findIndex((option) => option.value === viewMode);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % options.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + options.length) % options.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    handleViewModeChange(options[nextIndex].value);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.item(nextIndex).focus();
  }

  function toggleDesktopSidebar() {
    const nextVisible = !isSidebarVisible;
    setIsSidebarVisible(nextVisible);
    window.localStorage.setItem("mdez-sidebar-state", nextVisible ? "visible" : "hidden");
  }

  const sidebarIsHidden = isTabletLayout ? !isDrawerOpen : !isSidebarVisible;
  const metadataError = bookmarkMetadata.error ?? resumeMetadata.error;
  const statusMessage = library.error ?? metadataError
    ?? (saveStatus === "Saving..."
      ? "Saving changes..."
      : saveStatus === "Unsaved"
        ? "Unsaved changes"
        : operationStatus?.message ?? "Saved in this browser");
  const statusState = library.error || metadataError
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
            title="Toggle sidebar"
            aria-expanded={isSidebarVisible}
            className="workspace-icon-button desktop-sidebar-toggle"
          >
            {isSidebarVisible ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />}
          </button>
          <AnimatedBrandLogo />
        </div>

        <LibrarySearch query={libraryQuery} onQueryChange={setLibraryQuery} onSubmit={handleLibrarySearchSubmit} hasResults={libraryView.books.length + libraryView.pages.length > 0} onClear={() => setLibraryQuery("")} inputRef={librarySearchRef} />

        <div className="workspace-actions">
          <button
            ref={drawerTriggerRef}
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open library shelf"
            title="Open library shelf"
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
          expandedCollectionId={library.expandedCollectionId}
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
          filter={libraryFilter}
          bookmarkCount={bookmarkMetadata.bookmarkedIds.size}
          onSelectFilter={handleLibraryFilter}
          workspaceControls={(
            <div className="sidebar-workspace-menu">
              <WorkspaceSwitcher activeGroupId={activeGroupId} groups={rememberedGroups} onSelect={setActiveGroupId} onCreate={() => setIsCreateGroupOpen(true)} onJoin={() => setIsJoinGroupOpen(true)} />
              <div className="sidebar-workspace-actions">
                {activeGroupId ? <button type="button" onClick={() => void groupLibrary.refresh?.()} aria-label="Refresh group" title="Refresh group"><RefreshCw aria-hidden="true" /></button> : null}
                {activeGroupId ? <button type="button" onClick={() => setIsGroupSettingsOpen(true)} aria-label="Group settings" title="Group settings"><Settings aria-hidden="true" /></button> : null}
                <button type="button" onClick={() => setIsSharedLinksOpen(true)} aria-label="Shared links" title="Shared links"><Link2 aria-hidden="true" /></button>
              </div>
            </div>
          )}
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
          <section
            id={workspacePanelId}
            className="workspace-surface"
            role="tabpanel"
            aria-labelledby={modeTabId(isMobileLayout ? "mobile" : "desktop", viewMode)}
          >
            <div className="workspace-context">
              <p className="workspace-context-label">Workspace <span aria-hidden="true">/</span> <strong>{library.selectedFolder?.name ?? (libraryFilter === "bookmarks" ? "Bookmarks" : libraryFilter === "recent" ? "Recent pages" : libraryFilter === "unsorted" ? "Unsorted pages" : "My library")}</strong></p>
              <div className="workspace-mode-nav" role="tablist" aria-label="Workspace modes">
                {readerViewOptions.map((option) => <button key={option.value} id={modeTabId("desktop", option.value)} type="button" role="tab" data-active-treatment="filled" aria-selected={viewMode === option.value} aria-controls={workspacePanelId} tabIndex={viewMode === option.value ? 0 : -1} onClick={() => handleViewModeChange(option.value)} onKeyDown={(event) => handleModeTabKeyDown(event, readerViewOptions)} className="workspace-mode-button">{option.label}</button>)}
              </div>
            </div>

            {showShelf ? (
              <ShelfPane
                folders={library.folders}
                documents={liveDocuments}
                books={libraryView.books}
                pages={libraryView.pages}
                selectedFolderId={library.selectedFolderId}
                selectedDocumentId={library.selectedDocumentId}
                filter={libraryFilter}
                query={libraryQuery}
                bookmarkedIds={bookmarkMetadata.bookmarkedIds}
                resumePage={libraryView.resumePage}
                metadataError={metadataError}
                isReady={library.isReady}
                onSelectFolder={handleSelectFolder}
                onSelectDocument={handleSelectDocument}
                onToggleBookmark={handleToggleBookmark}
                onCreateDocument={handleCreateDocument}
                onCreateFolder={library.createBook}
                onOpenImport={handleOpenImport}
                onExportFolder={() => void handleSidebarFolderExport()}
                onClearSearch={() => setLibraryQuery("")}
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

      <div className="mobile-mode-nav" role="tablist" aria-label="Workspace modes" inert={isMobileLayout && isDrawerOpen}>
        {mobileOptions.map((option) => {
          const Icon = mobileIcons[option.value];
          return (
            <button
              key={option.value}
              id={modeTabId("mobile", option.value)}
              type="button"
              role="tab"
              data-active-treatment="filled"
              aria-selected={viewMode === option.value}
              aria-controls={workspacePanelId}
              tabIndex={viewMode === option.value ? 0 : -1}
              onClick={() => handleViewModeChange(option.value)}
              onKeyDown={(event) => handleModeTabKeyDown(event, mobileOptions)}
              className="mobile-mode-button"
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>

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
      <GroupConflictDialog open={Boolean(persistConflict)} busy={conflictBusy} onReload={() => void reloadConflict()} onCopy={() => void copyConflict()} onClose={() => setPersistConflict(null)} />
      {groupLibrary.group ? <GroupSettingsDialog open={isGroupSettingsOpen} group={groupLibrary.group} busy={groupSettingsBusy} onClose={() => setIsGroupSettingsOpen(false)} onRename={(name) => void renameActiveGroup(name)} onLeave={() => void leaveGroup()} onDelete={() => void deleteActiveGroup()} onRestore={() => void restoreActiveGroup()} /> : null}
    </div>
  );

}
