"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createGroupDocument, createGroupFolder, deleteGroupDocument, deleteGroupFolder, getGroupSnapshot, updateGroupDocument, updateGroupFolder } from "@/lib/key-group-client";
import { cacheGroupSnapshot, loadCachedGroup, loadRememberedGroup, rememberGroup } from "@/lib/key-group-repository";
import type { WorkspaceLibraryController } from "@/hooks/useWorkspaceLibrary";
import type { Document, Folder } from "@/types/content";
import type { GitHubImportResult, GitHubImportSession } from "@/types/github";
import type { GroupDocument, GroupFolder, GroupSnapshot, GroupSummary } from "@/types/key-group";

export type WorkspaceController = WorkspaceLibraryController & { kind: "local" | "group"; group?: GroupSummary; refresh?: () => Promise<void>; hasConflict?: boolean; persistBody?: (id: string, body: string) => Promise<Document>; persistTitle?: (id: string, title: string) => Promise<Document> };

const folderView = (folder: GroupFolder): Folder => ({ id: folder.id, parentId: folder.parentId, name: folder.name, order: folder.order, createdAt: folder.createdAt, updatedAt: folder.updatedAt });
const documentView = (document: GroupDocument): Document => ({ id: document.id, folderId: document.folderId, title: document.title, body: document.body, order: document.order, createdAt: document.createdAt, updatedAt: document.updatedAt });

export function useKeyGroupLibrary(groupId: string | null): WorkspaceController {
  const [folders, setFolders] = useState<Folder[]>([]); const [documents, setDocuments] = useState<Document[]>([]); const [group, setGroup] = useState<GroupSummary>();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null); const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(!groupId); const [error, setError] = useState<string | null>(null);
  const keyRef = useRef(""); const folderVersions = useRef(new Map<string, number>()); const documentVersions = useRef(new Map<string, number>());

  const apply = useCallback((snapshot: GroupSnapshot, preferred?: string | null) => {
    setGroup(snapshot.group); setFolders(snapshot.folders.map(folderView)); setDocuments(snapshot.documents.map(documentView));
    folderVersions.current = new Map(snapshot.folders.map((folder) => [folder.id, folder.version])); documentVersions.current = new Map(snapshot.documents.map((document) => [document.id, document.version]));
    setSelectedDocumentId((current) => preferred !== undefined ? preferred : snapshot.documents.some((document) => document.id === current) ? current : snapshot.documents[0]?.id ?? null);
  }, []);

  const refresh = useCallback(async () => {
    if (!groupId || !keyRef.current) return; const snapshot = await getGroupSnapshot(groupId, keyRef.current); apply(snapshot); await cacheGroupSnapshot(snapshot);
  }, [apply, groupId]);

  useEffect(() => {
    let alive = true; setIsReady(!groupId); setError(null);
    if (!groupId) return () => { alive = false; };
    void (async () => {
      try {
        const cached = await loadCachedGroup(groupId); if (alive && cached) apply(cached.snapshot);
        const remembered = await loadRememberedGroup(groupId); if (!remembered) throw new Error("Group access is not remembered in this browser"); keyRef.current = remembered.key;
        const snapshot = await getGroupSnapshot(groupId, remembered.key); if (!alive) return; apply(snapshot); await cacheGroupSnapshot(snapshot); await rememberGroup({ ...remembered, name: snapshot.group.name, lastOpenedAt: new Date().toISOString() });
      } catch (cause) { if (alive) setError(cause instanceof Error ? cause.message : "Could not load group"); }
      finally { if (alive) setIsReady(true); }
    })();
    return () => { alive = false; };
  }, [apply, groupId]);

  const selectFolder = useCallback((id: string | null) => { setSelectedFolderId(id); setSelectedDocumentId(documents.filter((item) => item.folderId === id).sort((a, b) => a.order - b.order)[0]?.id ?? null); if (id) setExpandedFolderIds((current) => new Set(current).add(id)); }, [documents]);
  const selectDocument = useCallback((id: string) => { const document = documents.find((item) => item.id === id); if (!document) return; setSelectedDocumentId(id); setSelectedFolderId(document.folderId); }, [documents]);
  const toggleFolder = useCallback((id: string) => setExpandedFolderIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);

  const createBook = useCallback(async (parentId: string | null) => { if (!groupId) return; const name = window.prompt("New book name", "New Book"); if (name === null) return; try { const created = await createGroupFolder(groupId, keyRef.current, { name, parentId }); folderVersions.current.set(created.id, created.version); setFolders((current) => [...current, folderView(created)]); setSelectedFolderId(created.id); } catch { setError("Could not create book."); } }, [groupId]);
  const renameBook = useCallback(async (id: string, name: string) => { if (!groupId) return; try { const updated = await updateGroupFolder(groupId, keyRef.current, id, { name, expectedVersion: folderVersions.current.get(id) ?? 1 }); folderVersions.current.set(id, updated.version); setFolders((current) => current.map((item) => item.id === id ? folderView(updated) : item)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not rename book."); } }, [groupId]);
  const deleteBook = useCallback(async (id: string) => { if (!groupId || !window.confirm("Delete this empty book?")) return; try { await deleteGroupFolder(groupId, keyRef.current, id, folderVersions.current.get(id) ?? 1); setFolders((current) => current.filter((item) => item.id !== id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete book."); } }, [groupId]);
  const createPage = useCallback(async () => { if (!groupId) return; const created = await createGroupDocument(groupId, keyRef.current, { title: "untitled.md", body: "# Untitled\n", folderId: selectedFolderId }); documentVersions.current.set(created.id, created.version); setDocuments((current) => [...current, documentView(created)]); setSelectedDocumentId(created.id); }, [groupId, selectedFolderId]);
  const importPages = useCallback(async (items: { title: string; body: string }[], folderId: string | null) => { if (!groupId) return; let newest: GroupDocument | null = null; for (const item of items) { newest = await createGroupDocument(groupId, keyRef.current, { ...item, folderId }); documentVersions.current.set(newest.id, newest.version); setDocuments((current) => [...current, documentView(newest!)]); } setSelectedFolderId(folderId); setSelectedDocumentId(newest?.id ?? null); }, [groupId]);
  const persistBody = useCallback(async (id: string, body: string) => { if (!groupId) throw new Error("Group is unavailable"); const updated = await updateGroupDocument(groupId, keyRef.current, id, { body, expectedVersion: documentVersions.current.get(id) ?? 1 }); documentVersions.current.set(id, updated.version); const view = documentView(updated); setDocuments((current) => current.map((item) => item.id === id ? view : item)); return view; }, [groupId]);
  const persistTitle = useCallback(async (id: string, title: string) => { if (!groupId) throw new Error("Group is unavailable"); const updated = await updateGroupDocument(groupId, keyRef.current, id, { title, expectedVersion: documentVersions.current.get(id) ?? 1 }); documentVersions.current.set(id, updated.version); const view = documentView(updated); setDocuments((current) => current.map((item) => item.id === id ? view : item)); return view; }, [groupId]);
  const movePage = useCallback(async (id: string, folderId: string | null) => { if (!groupId) return; const updated = await updateGroupDocument(groupId, keyRef.current, id, { folderId, expectedVersion: documentVersions.current.get(id) ?? 1 }); documentVersions.current.set(id, updated.version); setDocuments((current) => current.map((item) => item.id === id ? documentView(updated) : item)); setSelectedFolderId(folderId); }, [groupId]);
  const deletePage = useCallback(async (id: string) => { if (!groupId || !window.confirm("Delete this page?")) return; await deleteGroupDocument(groupId, keyRef.current, id, documentVersions.current.get(id) ?? 1); setDocuments((current) => current.filter((item) => item.id !== id)); setSelectedDocumentId((current) => current === id ? null : current); }, [groupId]);
  const refreshContent = useCallback(async (preferred?: string | null) => { await refresh(); if (preferred !== undefined) setSelectedDocumentId(preferred); }, [refresh]);
  const unavailable = useCallback(async (session: GitHubImportSession): Promise<GitHubImportResult> => { void session; throw new Error("GitHub refresh is unavailable in a group"); }, []);
  const selectedFolder = folders.find((item) => item.id === selectedFolderId) ?? null; const selectedDocument = documents.find((item) => item.id === selectedDocumentId) ?? null;
  return useMemo(() => ({ kind: "group" as const, group, folders, documents, sources: [], selectedFolderId, selectedDocumentId, expandedFolderIds, selectedFolder, selectedDocument, isReady, error, setError: setError as Dispatch<SetStateAction<string | null>>, setDocuments, selectFolder, selectDocument, toggleFolder, createBook, renameBook, deleteBook, createPage, importPages, renamePage: async () => {}, movePage, deletePage, refreshContent, importGitHub: unavailable, refreshGitHub: async (_sourceId: string, session: GitHubImportSession) => unavailable(session), refresh, persistBody, persistTitle }), [createBook, createPage, deleteBook, deletePage, documents, error, expandedFolderIds, folders, group, importPages, isReady, movePage, persistBody, persistTitle, refresh, refreshContent, renameBook, selectDocument, selectFolder, selectedDocument, selectedDocumentId, selectedFolder, selectedFolderId, toggleFolder, unavailable]);
}
