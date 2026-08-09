import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGroupRefresh } from "@/hooks/useGroupRefresh";
import * as client from "@/lib/key-group-client";

vi.mock("@/lib/key-group-client");
const key = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

it("polls after 30 seconds only when no draft is unsaved", async () => {
  vi.useFakeTimers(); vi.mocked(client.getGroupChanges).mockResolvedValue({ status: "changes", revision: 4, changes: [], records: { group: null, folders: [], documents: [] } });
  const onChanges = vi.fn();
  const { rerender } = renderHook(({ dirty }) => useGroupRefresh({ groupId: "g1", key, revision: 4, hasUnsavedDraft: dirty, onChanges, onReset: vi.fn() }), { initialProps: { dirty: true } });
  await act(async () => vi.advanceTimersByTimeAsync(30_000)); expect(client.getGroupChanges).not.toHaveBeenCalled();
  rerender({ dirty: false }); await act(async () => vi.advanceTimersByTimeAsync(30_000)); expect(client.getGroupChanges).toHaveBeenCalledWith("g1", key, 4);
});

it("performs a full snapshot reset when the server requests it", async () => {
  const snapshot = { group: { id: "g1", name: "Writers", revision: 90, deletedAt: null, purgeAfter: null, createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z" }, folders: [], documents: [] };
  vi.mocked(client.getGroupChanges).mockResolvedValue({ status: "reset_required", revision: 90 }); vi.mocked(client.getGroupSnapshot).mockResolvedValue(snapshot);
  const onReset = vi.fn(); const { result } = renderHook(() => useGroupRefresh({ groupId: "g1", key, revision: 4, hasUnsavedDraft: false, onChanges: vi.fn(), onReset }));
  await act(async () => result.current.refresh()); expect(client.getGroupSnapshot).toHaveBeenCalledWith("g1", key); expect(onReset).toHaveBeenCalledWith(snapshot);
});
