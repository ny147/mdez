"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { folderHasContent } from "@/lib/tree";
import {
  createDocument,
  createDocuments,
  createFolder,
  deleteDocument,
  deleteFolder,
  importGitHubSource,
  listContent,
  moveDocument,
  refreshGitHubSource,
  renameFolder
} from "@/lib/repository";
import { nextUntitledPageTitle } from "@/lib/document-titles";
import type { Document, Folder } from "@/types/content";
import type { GitHubImportResult, GitHubImportSession, GitHubSource } from "@/types/github";

type ContentSnapshot = Awaited<ReturnType<typeof listContent>>;

export type WorkspaceLibraryController = {
  folders: Folder[];
  documents: Document[];
  sources: GitHubSource[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  expandedFolderIds: Set<string>;
  selectedFolder: Folder | null;
  selectedDocument: Document | null;
  isReady: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setDocuments: Dispatch<SetStateAction<Document[]>>;
  selectFolder: (folderId: string | null) => void;
  selectDocument: (documentId: string) => void;
  toggleFolder: (folderId: string) => void;
  createBook: (parentId: string | null, name: string) => Promise<Folder>;
  renameBook: (folderId: string, name: string) => Promise<Folder>;
  deleteBook: (folderId: string) => Promise<void>;
  createPage: () => Promise<Document | null>;
  importPages: (items: { title: string; body: string }[], folderId: string | null) => Promise<void>;
  renamePage: (documentId: string, title: string) => Promise<void>;
  movePage: (documentId: string, folderId: string | null) => Promise<void>;
  deletePage: (documentId: string) => Promise<void>;
  refreshContent: (preferredDocumentId?: string | null) => Promise<void>;
  importGitHub: (session: GitHubImportSession) => Promise<GitHubImportResult>;
  refreshGitHub: (sourceId: string, session: GitHubImportSession) => Promise<GitHubImportResult>;
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

export function useWorkspaceLibrary(): WorkspaceLibraryController {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sources, setSources] = useState<GitHubSource[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyContent = useCallback((content: ContentSnapshot, preferredDocumentId?: string | null) => {
    setFolders(content.folders);
    setDocuments(content.documents);
    setSources(content.sources);

    if (preferredDocumentId !== undefined) {
      setSelectedDocumentId(preferredDocumentId);
    }
  }, []);

  const loadContent = useCallback(async (preferredDocumentId?: string | null) => {
    const content = await listContent();
    applyContent(content, preferredDocumentId);
    return content;
  }, [applyContent]);

  useEffect(() => {
    let alive = true;

    listContent()
      .then((content) => {
        if (!alive) return;
        const firstDocument = content.documents[0] ?? null;
        applyContent(content, firstDocument?.id ?? null);
        setSelectedFolderId(firstDocument?.folderId ?? null);
        setExpandedFolderIds(new Set(getExpandedFolderIdsForSelection(content.folders, firstDocument?.folderId ?? null)));
        setIsReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setError("IndexedDB is unavailable. Mdez can show the workspace, but it cannot save local documents in this browser session.");
        setIsReady(true);
      });

    return () => {
      alive = false;
    };
  }, [applyContent]);

  const expandFolderAncestors = useCallback((folderId: string | null, sourceFolders: Folder[], includeFolder = false) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      for (const ancestorId of getAncestorFolderIds(sourceFolders, folderId)) next.add(ancestorId);
      if (includeFolder && folderId !== null) next.add(folderId);
      return next;
    });
  }, []);

  const selectFolder = useCallback((folderId: string | null) => {
    const firstDocument = documents
      .filter((document) => document.folderId === folderId)
      .sort(byOrderThenTitle)[0];

    setSelectedFolderId(folderId);
    setSelectedDocumentId(firstDocument?.id ?? null);
    expandFolderAncestors(folderId, folders, true);
  }, [documents, expandFolderAncestors, folders]);

  const selectDocument = useCallback((documentId: string) => {
    const document = documents.find((item) => item.id === documentId);
    if (!document) return;
    setSelectedFolderId(document.folderId);
    setSelectedDocumentId(document.id);
    expandFolderAncestors(document.folderId, folders, true);
  }, [documents, expandFolderAncestors, folders]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const refreshContent = useCallback(async (preferredDocumentId?: string | null) => {
    const content = await loadContent(preferredDocumentId);
    if (preferredDocumentId !== undefined) {
      const preferred = content.documents.find((document) => document.id === preferredDocumentId) ?? null;
      setSelectedFolderId(preferred?.folderId ?? null);
      expandFolderAncestors(preferred?.folderId ?? null, content.folders, true);
    }
  }, [expandFolderAncestors, loadContent]);

  const createBook = useCallback(async (parentId: string | null, name: string) => {
    try {
      const folder = await createFolder(name, parentId);
      setError(null);
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        for (const ancestorId of getAncestorFolderIds(folders, parentId)) next.add(ancestorId);
        if (parentId !== null) next.add(parentId);
        next.add(folder.id);
        return next;
      });
      setSelectedFolderId(folder.id);
      await loadContent(null);
      return folder;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Could not create book.");
      setError(error.message);
      throw error;
    }
  }, [folders, loadContent]);

  const renameBook = useCallback(async (folderId: string, name: string) => {
    try {
      const folder = await renameFolder(folderId, name);
      setError(null);
      await loadContent();
      return folder;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Could not rename book.");
      setError(error.message);
      throw error;
    }
  }, [loadContent]);

  const deleteBook = useCallback(async (folderId: string) => {
    if (folderHasContent(folders, documents, folderId)) {
      setError("Move or delete nested books and pages before deleting this book.");
      return;
    }
    if (!window.confirm("Delete this empty book?")) return;

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
        await loadContent(null);
      } else {
        await loadContent();
      }
    } catch {
      setError("Could not delete book.");
    }
  }, [documents, folders, loadContent, selectedFolderId]);

  const createPage = useCallback(async () => {
    try {
      const title = nextUntitledPageTitle(documents, selectedFolderId);
      const document = await createDocument({ title, body: "# Untitled\n", folderId: selectedFolderId });
      setError(null);
      setSelectedDocumentId(document.id);
      await loadContent(document.id);
      return document;
    } catch (cause) {
      setError("Could not create page.");
      throw cause;
    }
  }, [documents, loadContent, selectedFolderId]);

  const importPages = useCallback(async (items: { title: string; body: string }[], folderId: string | null) => {
    try {
      const importedDocuments = await createDocuments(items, folderId);
      const newestDocumentId = importedDocuments[importedDocuments.length - 1]?.id ?? null;
      setError(null);
      setSelectedFolderId(folderId);
      expandFolderAncestors(folderId, folders, true);
      await loadContent(newestDocumentId);
    } catch {
      setError("Could not import markdown.");
      throw new Error("Could not import markdown.");
    }
  }, [expandFolderAncestors, folders, loadContent]);

  const renamePage = useCallback(async (documentId: string, title: string) => {
    void title;
    setError((current) => (current === "Could not rename page." ? null : current));
    await loadContent(selectedDocumentId === documentId ? documentId : undefined);
  }, [loadContent, selectedDocumentId]);

  const movePage = useCallback(async (documentId: string, folderId: string | null) => {
    try {
      await moveDocument(documentId, folderId);
      setError(null);
      setSelectedFolderId(folderId);
      setSelectedDocumentId(documentId);
      expandFolderAncestors(folderId, folders, true);
      await loadContent(documentId);
    } catch {
      setError("Could not move page.");
    }
  }, [expandFolderAncestors, folders, loadContent]);

  const deletePage = useCallback(async (documentId: string) => {
    if (!window.confirm("Delete this page?")) return;
    const document = documents.find((item) => item.id === documentId);
    if (!document) {
      setError("Page not found.");
      return;
    }
    const nextDocument = selectedDocumentId === documentId
      ? documents.filter((item) => item.id !== documentId && item.folderId === document.folderId).sort(byOrderThenTitle)[0] ?? null
      : documents.find((item) => item.id === selectedDocumentId) ?? null;

    try {
      await deleteDocument(documentId);
      setError(null);
      await loadContent(nextDocument?.id ?? null);
    } catch {
      setError("Could not delete page.");
    }
  }, [documents, loadContent, selectedDocumentId]);

  const importGitHub = useCallback(async (session: GitHubImportSession) => {
    const result = await importGitHubSource(session);
    const content = await loadContent(result.firstDocumentId);
    const firstDocument = content.documents.find((document) => document.id === result.firstDocumentId) ?? null;
    const folderId = firstDocument?.folderId ?? result.rootFolderId;
    setSelectedFolderId(folderId);
    expandFolderAncestors(folderId, content.folders, true);
    return result;
  }, [expandFolderAncestors, loadContent]);

  const refreshGitHub = useCallback(async (sourceId: string, session: GitHubImportSession) => {
    const result = await refreshGitHubSource(sourceId, session);
    const content = await loadContent(result.firstDocumentId);
    const firstDocument = content.documents.find((document) => document.id === result.firstDocumentId) ?? null;
    const folderId = firstDocument?.folderId ?? result.rootFolderId;
    setSelectedFolderId(folderId);
    expandFolderAncestors(folderId, content.folders, true);
    return result;
  }, [expandFolderAncestors, loadContent]);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;

  return useMemo(() => ({
    folders,
    documents,
    sources,
    selectedFolderId,
    selectedDocumentId,
    expandedFolderIds,
    selectedFolder,
    selectedDocument,
    isReady,
    error,
    setError,
    setDocuments,
    selectFolder,
    selectDocument,
    toggleFolder,
    createBook,
    renameBook,
    deleteBook,
    createPage,
    importPages,
    renamePage,
    movePage,
    deletePage,
    refreshContent,
    importGitHub,
    refreshGitHub
  }), [createBook, createPage, deleteBook, deletePage, documents, error, expandedFolderIds, folders, importGitHub,
    importPages, isReady, movePage, refreshContent, refreshGitHub, renameBook, renamePage, selectDocument, selectFolder,
    selectedDocument, selectedDocumentId, selectedFolder, selectedFolderId, sources, toggleFolder]);
}
