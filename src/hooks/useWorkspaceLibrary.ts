"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { UNSORTED_COLLECTION_ID } from "@/lib/library-tree";
import { loadExpandedCollection, saveExpandedCollection } from "@/lib/workspace-ui-preferences";
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
import type { Document, Folder } from "@/types/content";
import type { GitHubImportResult, GitHubImportSession, GitHubSource } from "@/types/github";

type ContentSnapshot = Awaited<ReturnType<typeof listContent>>;

export type WorkspaceLibraryController = {
  folders: Folder[];
  documents: Document[];
  sources: GitHubSource[];
  selectedFolderId: string | null;
  selectedDocumentId: string | null;
  expandedCollectionId: string | null;
  selectedFolder: Folder | null;
  selectedDocument: Document | null;
  isReady: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setDocuments: Dispatch<SetStateAction<Document[]>>;
  selectFolder: (folderId: string | null) => void;
  selectDocument: (documentId: string) => void;
  toggleFolder: (folderId: string) => void;
  createBook: (parentId: string | null) => Promise<void>;
  renameBook: (folderId: string, name: string) => Promise<void>;
  deleteBook: (folderId: string) => Promise<void>;
  createPage: (folderId?: string | null) => Promise<void>;
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

export function useWorkspaceLibrary(): WorkspaceLibraryController {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sources, setSources] = useState<GitHubSource[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
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
        setExpandedCollectionId(loadExpandedCollection("local", new Set(content.folders.map((folder) => folder.id))));
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

  const selectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
  }, []);

  const selectDocument = useCallback((documentId: string) => {
    const document = documents.find((item) => item.id === documentId);
    if (!document) return;
    setSelectedFolderId(document.folderId);
    setSelectedDocumentId(document.id);
    const collectionId = document.folderId ?? UNSORTED_COLLECTION_ID;
    setExpandedCollectionId(collectionId);
    saveExpandedCollection("local", collectionId);
  }, [documents]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedCollectionId((current) => {
      const next = current === folderId ? null : folderId;
      saveExpandedCollection("local", next);
      return next;
    });
  }, []);

  const refreshContent = useCallback(async (preferredDocumentId?: string | null) => {
    await loadContent(preferredDocumentId);
  }, [loadContent]);

  const createBook = useCallback(async (parentId: string | null) => {
    void parentId;
    const name = window.prompt("New book name", "New Book");
    if (name === null) return;

    try {
      const folder = await createFolder(name, null);
      setError(null);
      setExpandedCollectionId(folder.id);
      saveExpandedCollection("local", folder.id);
      setSelectedFolderId(folder.id);
      await loadContent(null);
    } catch {
      setError("Could not create book.");
    }
  }, [loadContent]);

  const renameBook = useCallback(async (folderId: string, name: string) => {
    try {
      await renameFolder(folderId, name);
      setError(null);
      await loadContent();
    } catch (cause) {
      setError("Could not rename book.");
      throw cause;
    }
  }, [loadContent]);

  const deleteBook = useCallback(async (folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return;
    const count = documents.filter((item) => item.folderId === folderId).length;
    const message = count === 0 ? `Delete “${folder.name}”?` : `Delete “${folder.name}”? Its ${count} ${count === 1 ? "page" : "pages"} will move to Unsorted. No pages will be deleted.`;
    if (!window.confirm(message)) return;

    try {
      await deleteFolder(folderId);
      setError(null);
      setExpandedCollectionId((current) => {
        const next = current === folderId || selectedFolderId === folderId ? UNSORTED_COLLECTION_ID : current;
        if (next !== current) saveExpandedCollection("local", next);
        return next;
      });
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
        await loadContent(selectedDocumentId);
      } else {
        await loadContent();
      }
    } catch {
      setError("Could not delete book.");
    }
  }, [documents, folders, loadContent, selectedDocumentId, selectedFolderId]);

  const createPage = useCallback(async (targetFolderId = selectedFolderId) => {
    try {
      const document = await createDocument({ title: "untitled.md", body: "# Untitled\n", folderId: targetFolderId });
      setError(null);
      setSelectedFolderId(targetFolderId);
      setSelectedDocumentId(document.id);
      const collectionId = targetFolderId ?? UNSORTED_COLLECTION_ID;
      setExpandedCollectionId(collectionId);
      saveExpandedCollection("local", collectionId);
      await loadContent(document.id);
    } catch (cause) {
      setError("Could not create page.");
      throw cause;
    }
  }, [loadContent, selectedFolderId]);

  const importPages = useCallback(async (items: { title: string; body: string }[], folderId: string | null) => {
    try {
      const importedDocuments = await createDocuments(items, folderId);
      const newestDocumentId = importedDocuments[importedDocuments.length - 1]?.id ?? null;
      setError(null);
      setSelectedFolderId(folderId);
      setExpandedCollectionId(folderId ?? UNSORTED_COLLECTION_ID);
      saveExpandedCollection("local", folderId ?? UNSORTED_COLLECTION_ID);
      await loadContent(newestDocumentId);
    } catch {
      setError("Could not import markdown.");
      throw new Error("Could not import markdown.");
    }
  }, [loadContent]);

  const renamePage = useCallback(async (documentId: string, title: string) => {
    void title;
    setError((current) => (current === "Could not rename page." ? null : current));
    await loadContent(selectedDocumentId === documentId ? documentId : undefined);
  }, [loadContent, selectedDocumentId]);

  const movePage = useCallback(async (documentId: string, folderId: string | null) => {
    try {
      await moveDocument(documentId, folderId);
      setError(null);
      const active = selectedDocumentId === documentId;
      if (active) {
        const collectionId = folderId ?? UNSORTED_COLLECTION_ID;
        setSelectedFolderId(folderId);
        setExpandedCollectionId(collectionId);
        saveExpandedCollection("local", collectionId);
      }
      await loadContent(active ? documentId : selectedDocumentId);
    } catch (cause) {
      setError("Could not move page.");
      throw cause;
    }
  }, [loadContent, selectedDocumentId]);

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
    setExpandedCollectionId(folderId ?? UNSORTED_COLLECTION_ID);
    saveExpandedCollection("local", folderId ?? UNSORTED_COLLECTION_ID);
    return result;
  }, [loadContent]);

  const refreshGitHub = useCallback(async (sourceId: string, session: GitHubImportSession) => {
    const result = await refreshGitHubSource(sourceId, session);
    const content = await loadContent(result.firstDocumentId);
    const firstDocument = content.documents.find((document) => document.id === result.firstDocumentId) ?? null;
    const folderId = firstDocument?.folderId ?? result.rootFolderId;
    setSelectedFolderId(folderId);
    setExpandedCollectionId(folderId ?? UNSORTED_COLLECTION_ID);
    saveExpandedCollection("local", folderId ?? UNSORTED_COLLECTION_ID);
    return result;
  }, [loadContent]);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;

  return useMemo(() => ({
    folders,
    documents,
    sources,
    selectedFolderId,
    selectedDocumentId,
    expandedCollectionId,
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
  }), [createBook, createPage, deleteBook, deletePage, documents, error, expandedCollectionId, folders, importGitHub,
    importPages, isReady, movePage, refreshContent, refreshGitHub, renameBook, renamePage, selectDocument, selectFolder,
    selectedDocument, selectedDocumentId, selectedFolder, selectedFolderId, sources, toggleFolder]);
}
