import React from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { GroupConflictDialog } from "@/components/mdez/GroupConflictDialog";
import { useDocumentDrafts } from "@/hooks/useDocumentDrafts";
import { KeyGroupConflictError } from "@/lib/key-group-client";
import type { Document } from "@/types/content";

const page: Document = { id: "d1", folderId: null, title: "Welcome.md", body: "shared", order: 0, createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z" };

afterEach(() => vi.useRealTimers());

it("keeps a stale draft and reports typed recovery state", async () => {
  vi.useFakeTimers(); const onPersistConflict = vi.fn(); const setError = vi.fn();
  const { result } = renderHook(() => useDocumentDrafts({ documents: [page], selectedDocumentId: page.id, setDocuments: vi.fn(), setError, persistBody: vi.fn().mockRejectedValue(new KeyGroupConflictError({ entityType: "document", entityId: "d1", expectedVersion: 1, currentVersion: 2 })), persistTitle: vi.fn(), onPersistConflict }));
  act(() => { result.current.changeBody("shared local draft"); vi.advanceTimersByTime(650); });
  await act(async () => Promise.resolve());
  expect(result.current.draftBody).toBe("shared local draft");
  expect(onPersistConflict).toHaveBeenCalledWith(expect.objectContaining({ entityId: "d1" }), { id: "d1", title: "Welcome.md", body: "shared local draft", field: "body" });
  expect(setError).not.toHaveBeenCalled();
});

it("offers exactly the approved conflict recovery actions", () => {
  render(<GroupConflictDialog open busy={false} onReload={vi.fn()} onCopy={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByRole("dialog", { name: "This page changed in the group" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Reload shared version" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Copy my draft to a new page" })).toBeVisible();
});
