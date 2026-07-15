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
});