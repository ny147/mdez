"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Columns2, Library, Link2, Menu, PanelLeftClose, PanelLeftOpen, PencilLine, RefreshCw, Settings } from "lucide-react";

import { renameDocument, restoreWorkspaceBackup as persistWorkspaceRestore, updateDocumentBody } from "@/lib/repository";
import type { TitleFocusRequest, ViewMode } from "@/types/content";
import type { GitHubImportSession, GitHubSource } from "@/types/github";
import { requestGitHubImportPreview } from "@/lib/github-import";
import { downloadBlob, ExportControls } from "@/components/mdez/ExportControls";
import { Sidebar } from "@/components/mdez/Sidebar";
import { ShelfPane } from "@/components/mdez/ShelfPane";
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
import { BookDialog, type BookDialogIntent } from "@/components/mdez/BookDialog";
import type { Folder } from "@/types/content";
import type { ParsedWorkspaceBackup } from "@/types/backup";
import { createWorkspaceBackupBlob, prepareWorkspaceRestore } from "@/lib/workspace-backup";
import { readBackupRecency, writeBackupRecency } from "@/lib/backup-recency";

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
const APP_VERSION = "0.1.0";

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
  const [bookDialogIntent, setBookDialogIntent] = useState<BookDialogIntent | null>(null);
  const [bookDialogBusy, setBookDialogBusy] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("shelf");
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [refreshingSourceId, setRefreshingSourceId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [titleFocusRequest, setTitleFocusRequest] = useState<TitleFocusRequest>(null);
  const { isTabletLayout, isMobileLayout } = useWorkspaceViewport();
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarSearchRef = useRef<HTMLInputElement>(null);
  const sidebarSearchFocusPendingRef = useRef(false);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const titleFocusRequestIdRef = useRef(0);
  const reloadRememberedGroups = () => loadRememberedGroups().then(setRememberedGroups);
  const workspaceIdentity = activeGroupId
    ? { kind: "group" as const, id: activeGroupId, name: groupLibrary.group?.name ?? "Key Group" }
    : { kind: "local" as const, id: null, name: "Local Library" };
  useEffect(() => { void reloadRememberedGroups(); }, []);
  useEffect(() => {
    const recencyWorkspace = activeGroupId
      ? { kind: "group" as const, id: activeGroupId }
      : { kind: "local" as const, id: null };
    setLastBackupAt(readBackupRecency(recencyWorkspace)?.preparedAt ?? null);
  }, [activeGroupId]);
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

    window.setTimeout(() => {
      if (sidebarSearchFocusPendingRef.current) {
        sidebarSearchFocusPendingRef.current = false;
        sidebarSearchRef.current?.focus();
        return;
      }
      sidebarRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }, 0);
  }, [isDrawerOpen, isTabletLayout]);

  useEffect(() => {
    function focusSidebarSearch(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || (!event.ctrlKey && !event.metaKey) || event.altKey || event.shiftKey) {
        return;
      }

      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true'], .cm-editor, [role='dialog']")) {
        return;
      }

      event.preventDefault();
      if (isTabletLayout) {
        if (!isDrawerOpen) {
          sidebarSearchFocusPendingRef.current = true;
        }
        setIsDrawerOpen(true);
        if (isDrawerOpen) {
          window.requestAnimationFrame(() => sidebarSearchRef.current?.focus());
        }
        return;
      }
      if (!isSidebarVisible) {
        setIsSidebarVisible(true);
        window.localStorage.setItem("mdez-sidebar-state", "visible");
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => sidebarSearchRef.current?.focus());
      });
    }

    document.addEventListener("keydown", focusSidebarSearch);
    return () => document.removeEventListener("keydown", focusSidebarSearch);
  }, [isDrawerOpen, isSidebarVisible, isTabletLayout]);

  useEffect(() => {
    function closeOverlays(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== "Escape" || !isDrawerOpen) {
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

  function requestTitleFocus(documentId: string) {
    titleFocusRequestIdRef.current += 1;
    setTitleFocusRequest({ documentId, requestId: titleFocusRequestIdRef.current });
  }

  function handleTitleFocusHandled(requestId: number) {
    setTitleFocusRequest((current) => current?.requestId === requestId ? null : current);
  }

  async function handleCreateDocument() {
    try {
      const document = await library.createPage();
      setViewMode("editor");
      setIsDrawerOpen(false);
      if (document) requestTitleFocus(document.id);
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

  function handleRequestRenameDocument(documentId: string) {
    handleSelectDocument(documentId);
    requestTitleFocus(documentId);
  }

  async function handleBackupWorkspace() {
    if (backupBusy) return;
    setBackupBusy(true);
    library.setError(null);
    setOperationStatus({ message: "Preparing workspace backup", state: "loading" });
    try {
      const blob = await createWorkspaceBackupBlob({
        appVersion: APP_VERSION,
        workspace: workspaceIdentity,
        folders: library.folders,
        documents: liveDocuments,
        githubSources: activeGroupId ? [] : library.sources
      });
      const fileName = makeMarkdownFileName(workspaceIdentity.name).replace(/\.md$/i, ".mdez.zip");
      downloadBlob(blob, fileName);
      const preparedAt = new Date().toISOString();
      writeBackupRecency(workspaceIdentity, preparedAt);
      setLastBackupAt(preparedAt);
      setOperationStatus({ message: "Workspace backup ready", state: "saved" });
    } catch {
      library.setError("Mdez could not prepare the workspace backup. Try again.");
      setOperationStatus({ message: "Workspace backup failed", state: "error" });
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRestoreBackup(parsed: ParsedWorkspaceBackup) {
    const prepared = prepareWorkspaceRestore(parsed, localLibrary.folders);
    try {
      const result = await persistWorkspaceRestore(prepared);
      setActiveGroupId(null);
      await localLibrary.refreshContent(result.firstDocumentId);
      setViewMode(result.firstDocumentId ? "editor" : "shelf");
      localLibrary.setError(null);
      setOperationStatus({ message: `Restored ${result.documentCount} ${result.documentCount === 1 ? "page" : "pages"} to Local Library`, state: "saved" });
      return { folderCount: result.folderCount, documentCount: result.documentCount };
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Mdez could not restore this backup. Your existing pages were not changed.");
      localLibrary.setError(error.message);
      throw error;
    }
  }

  function handleRequestCreateBook(parentId: string | null) {
    const parentName = parentId ? library.folders.find((folder) => folder.id === parentId)?.name ?? null : null;
    setBookDialogIntent({ mode: "create", parentId, parentName });
  }

  function handleRequestRenameBook(folder: Folder) {
    setBookDialogIntent({ mode: "rename", folderId: folder.id, parentId: folder.parentId, currentName: folder.name });
  }

  async function handleSubmitBook(name: string) {
    if (!bookDialogIntent) return;
    setBookDialogBusy(true);
    try {
      if (bookDialogIntent.mode === "create") await library.createBook(bookDialogIntent.parentId, name);
      else await library.renameBook(bookDialogIntent.folderId, name);
      setBookDialogIntent(null);
    } finally {
      setBookDialogBusy(false);
    }
  }

  function handleViewModeChange(nextMode: ViewMode) {
    setViewMode(nextMode);
    setIsDrawerOpen(false);
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
      titleFocusRequest={titleFocusRequest}
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
      onTitleFocusHandled={handleTitleFocusHandled}
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
      <header className="workspace-topbar" aria-label="Workspace toolbar">
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
          <span className="workspace-wordmark">Mdez</span>
          <WorkspaceSwitcher
            activeGroupId={activeGroupId}
            groups={rememberedGroups}
            onSelect={setActiveGroupId}
            onCreate={() => setIsCreateGroupOpen(true)}
            onJoin={() => setIsJoinGroupOpen(true)}
          />
        </div>

        <div className="workspace-mode-nav" role="tablist" aria-label="Workspace modes">
          {readerViewOptions.map((option) => (
            <button
              key={option.value}
              id={modeTabId("desktop", option.value)}
              type="button"
              role="tab"
              data-active-treatment="filled"
              aria-selected={viewMode === option.value}
              aria-controls={workspacePanelId}
              tabIndex={viewMode === option.value ? 0 : -1}
              onClick={() => handleViewModeChange(option.value)}
              onKeyDown={(event) => handleModeTabKeyDown(event, readerViewOptions)}
              className="workspace-mode-button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="workspace-actions">
          {activeGroupId ? <button type="button" onClick={() => void groupLibrary.refresh?.()} aria-label="Refresh group" title="Refresh group" className="workspace-icon-button"><RefreshCw aria-hidden="true" className="h-4 w-4" /></button> : null}
          {activeGroupId ? <button type="button" onClick={() => setIsGroupSettingsOpen(true)} aria-label="Group settings" title="Group settings" className="workspace-icon-button"><Settings aria-hidden="true" className="h-4 w-4" /></button> : null}
          <button
            type="button"
            onClick={() => setIsSharedLinksOpen(true)}
            aria-label="Shared links"
            title="Shared links"
            className="workspace-icon-button"
          >
            <Link2 aria-hidden="true" className="h-4 w-4" />
          </button>
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
          expandedFolderIds={library.expandedFolderIds}
          error={library.error}
          githubSource={activeGitHubSource}
          refreshingSourceId={refreshingSourceId}
          isReady={library.isReady}
          workspaceKey={activeGroupId ? `group:${activeGroupId}` : "local"}
          isHidden={sidebarIsHidden}
          isOverlay={isTabletLayout}
          sidebarRef={sidebarRef}
          searchInputRef={sidebarSearchRef}
          onClose={() => setIsDrawerOpen(false)}
          onSelectFolder={handleSelectFolder}
          onToggleFolder={library.toggleFolder}
          onCreateFolder={handleRequestCreateBook}
          onRenameFolder={handleRequestRenameBook}
          onDeleteFolder={library.deleteBook}
          onSelectDocument={handleSelectDocument}
          onCreateDocument={handleCreateDocument}
          onRequestRenameDocument={handleRequestRenameDocument}
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
          <section
            id={workspacePanelId}
            className="workspace-surface"
            role="tabpanel"
            aria-labelledby={modeTabId(isMobileLayout ? "mobile" : "desktop", viewMode)}
          >
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
                onCreateFolder={handleRequestCreateBook}
                onOpenImport={handleOpenImport}
                onExportFolder={() => void handleSidebarFolderExport()}
                onBackupWorkspace={() => void handleBackupWorkspace()}
                workspaceKind={workspaceIdentity.kind}
                lastBackupAt={lastBackupAt}
                backupBusy={backupBusy}
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
          onRestoreBackup={handleRestoreBackup}
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
      {bookDialogIntent ? (
        <BookDialog
          intent={bookDialogIntent}
          folders={library.folders}
          busy={bookDialogBusy}
          onClose={() => setBookDialogIntent(null)}
          onSubmit={handleSubmitBook}
        />
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
