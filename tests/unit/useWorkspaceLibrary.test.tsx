import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceLibrary } from "@/hooks/useWorkspaceLibrary";
import { UNSORTED_COLLECTION_ID } from "@/lib/library-tree";
import type { Document, Folder } from "@/types/content";

const repository = vi.hoisted(() => ({
  createDocument: vi.fn(),
  createDocuments: vi.fn(),
  createFolder: vi.fn(),
  deleteDocument: vi.fn(),
  deleteFolder: vi.fn(),
  importGitHubSource: vi.fn(),
  listContent: vi.fn(),
  moveDocument: vi.fn(),
  refreshGitHubSource: vi.fn(),
  renameFolder: vi.fn()
}));

vi.mock("@/lib/repository", () => repository);

const folder: Folder = {
  id: "book-1",
  name: "Book",
  parentId: null,
  order: 0,
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z"
};

const firstPage: Document = {
  id: "page-1",
  folderId: folder.id,
  title: "First",
  body: "First body",
  order: 0,
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z"
};

const secondPage: Document = {
  ...firstPage,
  id: "page-2",
  title: "Second",
  body: "Second body",
  order: 1
};

const content = {
  folders: [folder],
  documents: [firstPage, secondPage],
  sources: []
};

describe("useWorkspaceLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.listContent.mockResolvedValue(content);
  });

  it("keeps a non-first selected page across refresh unless an explicit replacement is supplied", async () => {
    const { result } = renderHook(() => useWorkspaceLibrary());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.selectedDocumentId).toBe(firstPage.id);

    act(() => result.current.selectDocument(secondPage.id));
    expect(result.current.selectedDocumentId).toBe(secondPage.id);

    repository.listContent.mockResolvedValueOnce({
      ...content,
      documents: [{ ...firstPage, title: "First refreshed" }, { ...secondPage, title: "Second refreshed" }]
    });
    await act(async () => result.current.refreshContent());

    expect(result.current.selectedDocumentId).toBe(secondPage.id);
    expect(result.current.selectedDocument?.title).toBe("Second refreshed");

    await act(async () => result.current.refreshContent(null));
    expect(result.current.selectedDocumentId).toBeNull();
    expect(result.current.selectedDocument).toBeNull();
  });

  it("opens a book shelf without replacing the active page", async () => {
    const otherFolder = { ...folder, id: "book-2", name: "Other" };
    repository.listContent.mockResolvedValueOnce({ ...content, folders: [folder, otherFolder] });
    const { result } = renderHook(() => useWorkspaceLibrary());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    act(() => result.current.selectDocument(secondPage.id));

    act(() => result.current.selectFolder(otherFolder.id));

    expect(result.current.selectedFolderId).toBe(otherFolder.id);
    expect(result.current.selectedDocumentId).toBe(secondPage.id);
  });

  it("moves a background page without replacing the active page or expansion", async () => {
    const { result } = renderHook(() => useWorkspaceLibrary());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    act(() => result.current.selectDocument(secondPage.id));
    repository.moveDocument.mockResolvedValue({ ...firstPage, folderId: null });
    repository.listContent.mockResolvedValueOnce({
      ...content,
      documents: [{ ...firstPage, folderId: null }, secondPage]
    });

    await act(async () => result.current.movePage(firstPage.id, null));

    expect(result.current.selectedDocumentId).toBe(secondPage.id);
    expect(result.current.selectedFolderId).toBe(folder.id);
    expect(result.current.expandedCollectionId).toBe(folder.id);
  });

  it("keeps the active page selected when deleting its book moves it to Unsorted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => useWorkspaceLibrary());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    act(() => result.current.selectDocument(secondPage.id));
    repository.deleteFolder.mockResolvedValue(undefined);
    repository.listContent.mockResolvedValueOnce({
      folders: [],
      documents: [{ ...firstPage, folderId: null }, { ...secondPage, folderId: null }],
      sources: []
    });

    await act(async () => result.current.deleteBook(folder.id));

    expect(result.current.selectedDocumentId).toBe(secondPage.id);
    expect(result.current.selectedFolderId).toBeNull();
    expect(result.current.expandedCollectionId).toBe(UNSORTED_COLLECTION_ID);
  });
});
