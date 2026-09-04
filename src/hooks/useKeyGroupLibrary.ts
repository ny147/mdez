"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createGroupDocument, createGroupFolder, deleteGroupDocument, deleteGroupFolder, deleteKeyGroup, getGroupSnapshot, renameKeyGroup, restoreKeyGroup, updateGroupDocument, updateGroupFolder } from "@/lib/key-group-client";
import { cacheGroupSnapshot, loadCachedGroup, loadRememberedGroup, rememberGroup } from "@/lib/key-group-repository";
import type { WorkspaceLibraryController } from "@/hooks/useWorkspaceLibrary";
import type { Document, Folder } from "@/types/content";
import type { GitHubImportResult, GitHubImportSession } from "@/types/github";
import type { GroupDocument, GroupFolder, GroupSnapshot, GroupSummary } from "@/types/key-group";
import type { PersistedDraftConflict } from "@/hooks/useDocumentDrafts";
import { useGroupRefresh } from "@/hooks/useGroupRefresh";
import { nextUntitledPageTitle } from "@/lib/document-titles";

export type WorkspaceController = WorkspaceLibraryController & { kind: "local" | "group"; group?: GroupSummary; refresh?: () => Promise<void>; hasConflict?: boolean; persistBody?: (id: string, body: string) => Promise<Document>; persistTitle?: (id: string, title: string) => Promise<Document>; copyConflictDraft?: (draft: PersistedDraftConflict) => Promise<void>; reloadConflictDocument?: (id: string) => Promise<Document>; setRefreshBlocked?: (blocked: boolean) => void; renameGroup?: (name: string) => Promise<void>; deleteGroup?: () => Promise<void>; restoreGroup?: () => Promise<void> };

const folderView = (folder: GroupFolder): Folder => ({ id: folder.id, parentId: folder.parentId, name: folder.name, order: folder.order, createdAt: folder.createdAt, updatedAt: folder.updatedAt });
const documentView = (document: GroupDocument): Document => ({ id: document.id, folderId: document.folderId, title: document.title, body: document.body, order: document.order, createdAt: document.createdAt, updatedAt: document.updatedAt });

export function useKeyGroupLibrary(groupId: string | null): WorkspaceController {
  const [folders, setFolders] = useState<Folder[]>([]); const [documents, setDocuments] = useState<Document[]>([]); const [group, setGroup] = useState<GroupSummary>();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null); const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(!groupId); const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(""); const [refreshBlocked, setRefreshBlocked] = useState(false);
  const keyRef = useRef(""); const folderVersions = useRef(new Map<string, number>()); const documentVersions = useRef(new Map<string, number>());

  const apply = useCallback((snapshot: GroupSnapshot, preferred?: string | null) => {
    setGroup(snapshot.group); setFolders(snapshot.folders.map(folderView)); setDocuments(snapshot.documents.map(documentView));
    folderVersions.current = new Map(snapshot.folders.map((folder) => [folder.id, folder.version])); documentVersions.current = new Map(snapshot.documents.map((document) => [document.id, document.version]));
    setSelectedDocumentId((current) => preferred !== undefined ? preferred : snapshot.documents.some((document) => document.id === current) ? current : snapshot.documents[0]?.id ?? null);
  }, []);

  const fullRefresh = useCallback(async () => {
    if (!groupId || !keyRef.current) return; const snapshot = await getGroupSnapshot(groupId, keyRef.current); apply(snapshot); await cacheGroupSnapshot(snapshot);
  }, [apply, groupId]);

  const applyChanges = useCallback((result: Extract<import("@/types/key-group").GroupChangesResult, { status: "changes" }>) => {
    const deletedFolders = new Set(result.changes.filter((change) => change.entityType === "folder" && change.operation === "delete").map((change) => change.entityId));
    const deletedDocuments = new Set(result.changes.filter((change) => change.entityType === "document" && change.operation === "delete").map((change) => change.entityId));
    setGroup((current) => result.records.group ?? (current ? { ...current, revision: result.revision } : current));
    setFolders((current) => { const records = new Set(result.records.folders.map((item) => item.id)); result.records.folders.forEach((item) => folderVersions.current.set(item.id, item.version)); return [...current.filter((item) => !deletedFolders.has(item.id) && !records.has(item.id)), ...result.records.folders.map(folderView)]; });
    setDocuments((current) => { const records = new Set(result.records.documents.map((item) => item.id)); result.records.documents.forEach((item) => documentVersions.current.set(item.id, item.version)); return [...current.filter((item) => !deletedDocuments.has(item.id) && !records.has(item.id)), ...result.records.documents.map(documentView)]; });
  }, []);
  const { refresh } = useGroupRefresh({ groupId: groupId ?? "", key, revision: group?.revision ?? 0, hasUnsavedDraft: refreshBlocked, onChanges: applyChanges, onReset: async (snapshot) => { apply(snapshot); await cacheGroupSnapshot(snapshot); } });

  useEffect(() => {
    let alive = true; setIsReady(!groupId); setError(null);
    if (!groupId) return () => { alive = false; };
    void (async () => {
      try {
        const cached = await loadCachedGroup(groupId); if (alive && cached) apply(cached.snapshot);
        const remembered = await loadRememberedGroup(groupId); if (!remembered) throw new Error("Group access is not remembered in this browser"); keyRef.current = remembered.key; setKey(remembered.key);
        const snapshot = await getGroupSnapshot(groupId, remembered.key); if (!alive) return; apply(snapshot); await cacheGroupSnapshot(snapshot); await rememberGroup({ ...remembered, name: snapshot.group.name, lastOpenedAt: new Date().toISOString() });
      } catch (cause) { if (alive) setError(cause instanceof Error ? cause.message : "Could not load group"); }
      finally { if (alive) setIsReady(true); }
    })();
    return () => { alive = false; };
  }, [apply, groupId]);

  const selectFolder = useCallback((id: string | null) => { setSelectedFolderId(id); setSelectedDocumentId(documents.filter((item) => item.folderId === id).sort((a, b) => a.order - b.order)[0]?.id ?? null); if (id) setExpandedFolderIds((current) => new Set(current).add(id)); }, [documents]);
  const selectDocument = useCallback((id: string) => { const document = documents.find((item) => item.id === id); if (!document) return; setSelectedDocumentId(id); setSelectedFolderId(document.folderId); }, [documents]);
  const toggleFolder = useCallback((id: string) => setExpandedFolderIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);

  const createBook = useCallback(async (parentId: string | null, name: string) => { if (!groupId) throw new Error("Group is unavailable"); try { const created = await createGroupFolder(groupId, keyRef.current, { name, parentId }); const view = folderView(created); folderVersions.current.set(created.id, created.version); setFolders((current) => [...current, view]); setSelectedFolderId(created.id); setError(null); return view; } catch (cause) { const error = cause instanceof Error ? cause : new Error("Could not create book."); setError(error.message); throw error; } }, [groupId]);
  const renameBook = useCallback(async (id: string, name: string) => { if (!groupId) throw new Error("Group is unavailable"); try { const updated = await updateGroupFolder(groupId, keyRef.current, id, { name, expectedVersion: folderVersions.current.get(id) ?? 1 }); const view = folderView(updated); folderVersions.current.set(id, updated.version); setFolders((current) => current.map((item) => item.id === id ? view : item)); setError(null); return view; } catch (cause) { const error = cause instanceof Error ? cause : new Error("Could not rename book."); setError(error.message); throw error; } }, [groupId]);
  const deleteBook = useCallback(async (id: string) => { if (!groupId || !window.confirm("Delete this empty book?")) return; try { await deleteGroupFolder(groupId, keyRef.current, id, folderVersions.current.get(id) ?? 1); setFolders((current) => current.filter((item) => item.id !== id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete book."); } }, [groupId]);
  const createPage = useCallback(async () => { if (!groupId) return null; const title = nextUntitledPageTitle(documents, selectedFolderId); const created = await createGroupDocument(groupId, keyRef.current, { title, body: "# Untitled\n", folderId: selectedFolderId }); const view = documentView(created); documentVersions.current.set(created.id, created.version); setDocuments((current) => [...current, view]); setSelectedDocumentId(created.id); return view; }, [documents, groupId, selectedFolderId]);
  const importPages = useCallback(async (items: { title: string; body: string }[], folderId: string | null) => { if (!groupId) return; let newest: GroupDocument | null = null; for (const item of items) { newest = await createGroupDocument(groupId, keyRef.current, { ...item, folderId }); documentVersions.current.set(newest.id, newest.version); setDocuments((current) => [...current, documentView(newest!)]); } setSelectedFolderId(folderId); setSelectedDocumentId(newest?.id ?? null); }, [groupId]);
  const persistBody = useCallback(async (id: string, body: string) => { if (!groupId) throw new Error("Group is unavailable"); const updated = await updateGroupDocument(groupId, keyRef.current, id, { body, expectedVersion: documentVersions.current.get(id) ?? 1 }); documentVersions.current.set(id, updated.version); const view = documentView(updated); setDocuments((current) => current.map((item) => item.id === id ? view : item)); return view; }, [groupId]);
  const persistTitle = useCallback(async (id: string, title: string) => { if (!groupId) throw new Error("Group is unavailable"); const updated = await updateGroupDocument(groupId, keyRef.current, id, { title, expectedVersion: documentVersions.current.get(id) ?? 1 }); documentVersions.current.set(id, updated.version); const view = documentView(updated); setDocuments((current) => current.map((item) => item.id === id ? view : item)); return view; }, [groupId]);
  const movePage = useCallback(async (id: string, folderId: string | null) => { if (!groupId) return; const updated = await updateGroupDocument(groupId, keyRef.current, id, { folderId, expectedVersion: documentVersions.current.get(id) ?? 1 }); documentVersions.current.set(id, updated.version); setDocuments((current) => current.map((item) => item.id === id ? documentView(updated) : item)); setSelectedFolderId(folderId); }, [groupId]);
  const deletePage = useCallback(async (id: string) => { if (!groupId || !window.confirm("Delete this page?")) return; await deleteGroupDocument(groupId, keyRef.current, id, documentVersions.current.get(id) ?? 1); setDocuments((current) => current.filter((item) => item.id !== id)); setSelectedDocumentId((current) => current === id ? null : current); }, [groupId]);
  const copyConflictDraft = useCallback(async (draft: PersistedDraftConflict) => {
    if (!groupId) return;
    const source = documents.find((item) => item.id === draft.id);
    const extension = draft.title.toLowerCase().endsWith(".md") ? ".md" : "";
    const base = extension ? draft.title.slice(0, -3) : draft.title;
    let title = `${base} (conflict copy)${extension}`;
    let suffix = 2;
    while (documents.some((item) => item.title === title)) title = `${base} (conflict copy ${suffix++})${extension}`;
    const created = await createGroupDocument(groupId, keyRef.current, { title, body: draft.body, folderId: source?.folderId ?? null });
    documentVersions.current.set(created.id, created.version); setDocuments((current) => [...current, documentView(created)]); setSelectedFolderId(created.folderId); setSelectedDocumentId(created.id);
  }, [documents, groupId]);
  const reloadConflictDocument = useCallback(async (id: string) => {
    if (!groupId) throw new Error("Group is unavailable");
    const snapshot = await getGroupSnapshot(groupId, keyRef.current); const record = snapshot.documents.find((item) => item.id === id); if (!record) throw new Error("Shared page no longer exists");
    apply(snapshot, id); await cacheGroupSnapshot(snapshot); return documentView(record);
  }, [apply, groupId]);
  const renameGroupName = useCallback(async (name: string) => { if (!groupId) return; const updated = await renameKeyGroup(groupId, keyRef.current, name); setGroup(updated); const remembered = await loadRememberedGroup(groupId); if (remembered) await rememberGroup({ ...remembered, name: updated.name, lastOpenedAt: new Date().toISOString() }); }, [groupId]);
  const deleteCurrentGroup = useCallback(async () => { if (!groupId) return; setGroup(await deleteKeyGroup(groupId, keyRef.current)); }, [groupId]);
  const restoreCurrentGroup = useCallback(async () => { if (!groupId) return; setGroup(await restoreKeyGroup(groupId, keyRef.current)); }, [groupId]);
  const refreshContent = useCallback(async (preferred?: string | null) => { await fullRefresh(); if (preferred !== undefined) setSelectedDocumentId(preferred); }, [fullRefresh]);
  const unavailable = useCallback(async (session: GitHubImportSession): Promise<GitHubImportResult> => { void session; throw new Error("GitHub refresh is unavailable in a group"); }, []);
  const selectedFolder = folders.find((item) => item.id === selectedFolderId) ?? null; const selectedDocument = documents.find((item) => item.id === selectedDocumentId) ?? null;
  return useMemo(() => ({ kind: "group" as const, group, folders, documents, sources: [], selectedFolderId, selectedDocumentId, expandedFolderIds, selectedFolder, selectedDocument, isReady, error, setError: setError as Dispatch<SetStateAction<string | null>>, setDocuments, selectFolder, selectDocument, toggleFolder, createBook, renameBook, deleteBook, createPage, importPages, renamePage: async () => {}, movePage, deletePage, refreshContent, importGitHub: unavailable, refreshGitHub: async (_sourceId: string, session: GitHubImportSession) => unavailable(session), refresh, persistBody, persistTitle, copyConflictDraft, reloadConflictDocument, setRefreshBlocked, renameGroup: renameGroupName, deleteGroup: deleteCurrentGroup, restoreGroup: restoreCurrentGroup }), [copyConflictDraft, createBook, createPage, deleteBook, deleteCurrentGroup, deletePage, documents, error, expandedFolderIds, folders, group, importPages, isReady, movePage, persistBody, persistTitle, refresh, refreshContent, reloadConflictDocument, renameBook, renameGroupName, restoreCurrentGroup, selectDocument, selectFolder, selectedDocument, selectedDocumentId, selectedFolder, selectedFolderId, toggleFolder, unavailable]);
}
