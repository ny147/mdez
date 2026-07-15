import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SAVE_ERROR_MESSAGE, useDocumentDrafts } from "@/hooks/useDocumentDrafts";
import type { Document } from "@/types/content";

const page: Document = {
  id: "page-1",
  folderId: null,
  title: "Page",
  body: "Initial",
  order: 0,
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z"
};

const secondPage: Document = {
  ...page,
  id: "page-2",
  title: "Second page",
  body: "Second initial"
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDocumentDrafts", () => {
  it("debounces rapid body edits and persists the newest body", async () => {
    vi.useFakeTimers();
    const persistBody = vi.fn(async (_id: string, body: string) => ({ ...page, body }));
    const { result } = renderHook(() =>
      useDocumentDrafts({
        documents: [page],
        selectedDocumentId: page.id,
        setDocuments: vi.fn(),
        setError: vi.fn(),
        persistBody,
        persistTitle: vi.fn()
      })
    );

    act(() => {
      result.current.changeBody("One");
      result.current.changeBody("Two");
      result.current.changeBody("Newest");
      vi.advanceTimersByTime(650);
    });
    await act(async () => Promise.resolve());

    expect(persistBody).toHaveBeenCalledOnce();
    expect(persistBody).toHaveBeenCalledWith(page.id, "Newest");
  });

  it("retains the visible draft and reports the standard message after failure", async () => {
    vi.useFakeTimers();
    const setError = vi.fn();
    const { result } = renderHook(() =>
      useDocumentDrafts({
        documents: [page],
        selectedDocumentId: page.id,
        setDocuments: vi.fn(),
        setError,
        persistBody: vi.fn().mockRejectedValue(new Error("offline")),
        persistTitle: vi.fn()
      })
    );

    act(() => {
      result.current.changeBody("Still visible");
      vi.advanceTimersByTime(650);
    });
    await act(async () => Promise.resolve());

    expect(result.current.draftBody).toBe("Still visible");
    expect(setError).toHaveBeenCalledWith(SAVE_ERROR_MESSAGE);
  });

  it("uses the canonical title returned by the repository", async () => {
    vi.useFakeTimers();
    const canonical = { ...page, title: "untitled.md" };
    const setDocuments = vi.fn();
    const { result } = renderHook(() =>
      useDocumentDrafts({
        documents: [page],
        selectedDocumentId: page.id,
        setDocuments,
        setError: vi.fn(),
        persistBody: vi.fn(),
        persistTitle: vi.fn().mockResolvedValue(canonical)
      })
    );

    act(() => {
      result.current.changeTitle("   ");
      vi.advanceTimersByTime(650);
    });
    await act(async () => Promise.resolve());

    expect(result.current.draftTitle).toBe("untitled.md");
    expect(setDocuments).toHaveBeenCalledOnce();
    const update = setDocuments.mock.calls[0][0] as (documents: Document[]) => Document[];
    expect(update([page])).toEqual([canonical]);
  });

  it("does not let a stale async completion replace a newer draft", async () => {
    vi.useFakeTimers();
    const first = deferred<Document>();
    const second = deferred<Document>();
    const persistBody = vi
      .fn<(id: string, body: string) => Promise<Document>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const setDocuments = vi.fn();
    const { result } = renderHook(() =>
      useDocumentDrafts({
        documents: [page],
        selectedDocumentId: page.id,
        setDocuments,
        setError: vi.fn(),
        persistBody,
        persistTitle: vi.fn()
      })
    );

    act(() => {
      result.current.changeBody("First");
      vi.advanceTimersByTime(650);
    });
    act(() => {
      result.current.changeBody("Second");
      vi.advanceTimersByTime(650);
    });
    await act(async () => first.resolve({ ...page, body: "First" }));

    expect(result.current.draftBody).toBe("Second");
    expect(setDocuments).not.toHaveBeenCalled();
    expect(persistBody).toHaveBeenLastCalledWith(page.id, "Second");

    await act(async () => second.resolve({ ...page, body: "Second" }));
    expect(result.current.draftBody).toBe("Second");
    expect(setDocuments).toHaveBeenCalledOnce();
  });

  it("clears pending work and draft state when a document is removed", () => {
    vi.useFakeTimers();
    const persistBody = vi.fn();
    const options = {
      selectedDocumentId: page.id as string | null,
      setDocuments: vi.fn(),
      setError: vi.fn(),
      persistBody,
      persistTitle: vi.fn()
    };
    const { result, rerender } = renderHook(
      ({ documents }: { documents: Document[] }) => useDocumentDrafts({ ...options, documents }),
      { initialProps: { documents: [page] } }
    );

    act(() => result.current.changeBody("Removed draft"));
    rerender({ documents: [] });
    act(() => vi.advanceTimersByTime(650));

    expect(persistBody).not.toHaveBeenCalled();
    expect(result.current.liveDocuments).toEqual([]);
    expect(result.current.draftBody).toBe("");
  });

  it("cancels pending saves when unmounted", () => {
    vi.useFakeTimers();
    const persistBody = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDocumentDrafts({
        documents: [page],
        selectedDocumentId: page.id,
        setDocuments: vi.fn(),
        setError: vi.fn(),
        persistBody,
        persistTitle: vi.fn()
      })
    );

    act(() => result.current.changeBody("Never persisted"));
    unmount();
    act(() => vi.advanceTimersByTime(650));

    expect(persistBody).not.toHaveBeenCalled();
  });
  it("clears an active document queue on removal so its waiting value never persists", async () => {
    vi.useFakeTimers();
    const active = deferred<Document>();
    const persistBody = vi
      .fn<(id: string, body: string) => Promise<Document>>()
      .mockReturnValueOnce(active.promise)
      .mockResolvedValue({ ...page, body: "Waiting" });
    const setError = vi.fn();
    const props = {
      selectedDocumentId: page.id as string | null,
      setDocuments: vi.fn(),
      setError,
      persistBody,
      persistTitle: vi.fn()
    };
    const { result, rerender } = renderHook(
      ({ documents }: { documents: Document[] }) => useDocumentDrafts({ ...props, documents }),
      { initialProps: { documents: [page] } }
    );

    act(() => {
      result.current.changeBody("Active");
      vi.advanceTimersByTime(650);
    });
    act(() => {
      result.current.changeBody("Waiting");
      vi.advanceTimersByTime(650);
    });
    rerender({ documents: [] });
    await act(async () => {
      active.resolve({ ...page, body: "Active" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(persistBody).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });

  it("does not report an active save rejection after its document is removed", async () => {
    vi.useFakeTimers();
    const active = deferred<Document>();
    const setError = vi.fn();
    const props = {
      selectedDocumentId: page.id as string | null,
      setDocuments: vi.fn(),
      setError,
      persistBody: vi.fn().mockReturnValue(active.promise),
      persistTitle: vi.fn()
    };
    const { result, rerender } = renderHook(
      ({ documents }: { documents: Document[] }) => useDocumentDrafts({ ...props, documents }),
      { initialProps: { documents: [page] } }
    );

    act(() => {
      result.current.changeBody("Active");
      vi.advanceTimersByTime(650);
    });
    rerender({ documents: [] });
    await act(async () => {
      active.reject(new Error("offline"));
      await Promise.resolve();
    });

    expect(setError).not.toHaveBeenCalled();
  });

  it("clears a waiting value behind an active save when unmounted", async () => {
    vi.useFakeTimers();
    const active = deferred<Document>();
    const persistBody = vi
      .fn<(id: string, body: string) => Promise<Document>>()
      .mockReturnValueOnce(active.promise)
      .mockResolvedValue({ ...page, body: "Waiting" });
    const { result, unmount } = renderHook(() =>
      useDocumentDrafts({
        documents: [page],
        selectedDocumentId: page.id,
        setDocuments: vi.fn(),
        setError: vi.fn(),
        persistBody,
        persistTitle: vi.fn()
      })
    );

    act(() => {
      result.current.changeBody("Active");
      vi.advanceTimersByTime(650);
    });
    act(() => {
      result.current.changeBody("Waiting");
      vi.advanceTimersByTime(650);
    });
    unmount();
    await act(async () => {
      active.resolve({ ...page, body: "Active" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(persistBody).toHaveBeenCalledTimes(1);
  });

  it("does not show a save failure from the previously selected document", async () => {
    vi.useFakeTimers();
    const active = deferred<Document>();
    const setError = vi.fn();
    const shared = {
      documents: [page, secondPage],
      setDocuments: vi.fn(),
      setError,
      persistBody: vi.fn().mockReturnValue(active.promise),
      persistTitle: vi.fn()
    };
    const { result, rerender } = renderHook(
      ({ selectedDocumentId }: { selectedDocumentId: string }) =>
        useDocumentDrafts({ ...shared, selectedDocumentId }),
      { initialProps: { selectedDocumentId: page.id } }
    );

    act(() => {
      result.current.changeBody("Active");
      vi.advanceTimersByTime(650);
    });
    rerender({ selectedDocumentId: secondPage.id });
    await act(async () => active.reject(new Error("offline")));

    expect(setError).not.toHaveBeenCalled();
  });

  it("does not clear the selected document error when an old document save succeeds", async () => {
    vi.useFakeTimers();
    const active = deferred<Document>();
    const setError = vi.fn();
    const setDocuments = vi.fn();
    const shared = {
      documents: [page, secondPage],
      setDocuments,
      setError,
      persistBody: vi.fn().mockReturnValue(active.promise),
      persistTitle: vi.fn()
    };
    const { result, rerender } = renderHook(
      ({ selectedDocumentId }: { selectedDocumentId: string }) =>
        useDocumentDrafts({ ...shared, selectedDocumentId }),
      { initialProps: { selectedDocumentId: page.id } }
    );

    act(() => {
      result.current.changeBody("Saved on A");
      vi.advanceTimersByTime(650);
    });
    rerender({ selectedDocumentId: secondPage.id });
    await act(async () => active.resolve({ ...page, body: "Saved on A" }));

    expect(setDocuments).toHaveBeenCalledOnce();
    expect(setError).not.toHaveBeenCalled();
  });

  it("serializes an immediate selected-page rename behind an editor title save", async () => {
    vi.useFakeTimers();
    const editorSave = deferred<Document>();
    const sidebarSave = deferred<Document>();
    const persistTitle = vi
      .fn<(id: string, title: string) => Promise<Document>>()
      .mockReturnValueOnce(editorSave.promise)
      .mockReturnValueOnce(sidebarSave.promise);
    const { result } = renderHook(() =>
      useDocumentDrafts({
        documents: [page],
        selectedDocumentId: page.id,
        setDocuments: vi.fn(),
        setError: vi.fn(),
        persistBody: vi.fn(),
        persistTitle
      })
    );

    act(() => {
      result.current.changeTitle("Editor title");
      vi.advanceTimersByTime(650);
    });
    let renamePromise!: Promise<Document | null>;
    act(() => {
      renamePromise = result.current.renameTitleById(page.id, "Sidebar title");
    });
    await act(async () => editorSave.resolve({ ...page, title: "Editor title" }));

    expect(persistTitle).toHaveBeenCalledTimes(2);
    expect(persistTitle).toHaveBeenLastCalledWith(page.id, "Sidebar title");

    const canonical = { ...page, title: "Sidebar title.md" };
    let renamed: Document | null = null;
    await act(async () => {
      sidebarSave.resolve(canonical);
      renamed = await renamePromise;
    });
    expect(renamed).toEqual(canonical);
    expect(result.current.draftTitle).toBe("Sidebar title.md");
  });

  it("immediately renames a nonselected page through the shared title queue", async () => {
    const canonical = { ...secondPage, title: "Canonical second.md" };
    const persistTitle = vi.fn().mockResolvedValue(canonical);
    const { result } = renderHook(() =>
      useDocumentDrafts({
        documents: [page, secondPage],
        selectedDocumentId: page.id,
        setDocuments: vi.fn(),
        setError: vi.fn(),
        persistBody: vi.fn(),
        persistTitle
      })
    );

    let renamed: Document | null = null;
    await act(async () => {
      renamed = await result.current.renameTitleById(secondPage.id, "Second sidebar title");
    });

    expect(persistTitle).toHaveBeenCalledWith(secondPage.id, "Second sidebar title");
    expect(renamed).toEqual(canonical);
    expect(result.current.liveDocuments.find((document) => document.id === secondPage.id)?.title).toBe(
      "Canonical second.md"
    );
  });

  it("does not persist or show Saving when an edit reverts before debounce", () => {
    vi.useFakeTimers();
    const persistBody = vi.fn();
    const { result } = renderHook(() =>
      useDocumentDrafts({
        documents: [page],
        selectedDocumentId: page.id,
        setDocuments: vi.fn(),
        setError: vi.fn(),
        persistBody,
        persistTitle: vi.fn()
      })
    );

    act(() => result.current.changeBody("Temporary"));
    act(() => result.current.changeBody(page.body));
    expect(result.current.saveStatus).toBe("Saved");
    act(() => vi.advanceTimersByTime(650));

    expect(persistBody).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe("Saved");
  });

  it("queues a restoring save when reverting while an older save is active", async () => {
    vi.useFakeTimers();
    const staleSave = deferred<Document>();
    const restoreSave = deferred<Document>();
    const persistBody = vi
      .fn<(id: string, body: string) => Promise<Document>>()
      .mockReturnValueOnce(staleSave.promise)
      .mockReturnValueOnce(restoreSave.promise);
    const { result } = renderHook(() =>
      useDocumentDrafts({
        documents: [page],
        selectedDocumentId: page.id,
        setDocuments: vi.fn(),
        setError: vi.fn(),
        persistBody,
        persistTitle: vi.fn()
      })
    );

    act(() => {
      result.current.changeBody("Stale value");
      vi.advanceTimersByTime(650);
    });
    act(() => {
      result.current.changeBody(page.body);
      vi.advanceTimersByTime(650);
    });
    expect(persistBody).toHaveBeenCalledOnce();

    await act(async () => staleSave.resolve({ ...page, body: "Stale value" }));
    expect(persistBody).toHaveBeenCalledTimes(2);
    expect(persistBody).toHaveBeenLastCalledWith(page.id, page.body);

    await act(async () => restoreSave.resolve(page));
    expect(result.current.draftBody).toBe(page.body);
  });
});