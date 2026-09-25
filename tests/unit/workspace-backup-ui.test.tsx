import React, { Suspense } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MdezWorkspace } from "@/components/mdez/MdezWorkspace";
import { ThemeProvider } from "@/components/mdez/ThemeProvider";
import { db } from "@/lib/db";
import { createWorkspaceBackupBlob } from "@/lib/workspace-backup";

vi.mock("next/dynamic", async () => {
  const { lazy } = await import("react");
  return { default: (load: () => Promise<React.ComponentType>) => lazy(async () => ({ default: await load() })) };
});

// Keep the real library hook and IndexedDB transaction; fail only the screen's
// post-commit refresh, which must never make a successful restore retryable.
vi.mock("@/hooks/useWorkspaceLibrary", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/hooks/useWorkspaceLibrary")>();
  return { useWorkspaceLibrary: () => ({
    ...original.useWorkspaceLibrary(),
    refreshContent: async () => { throw new Error("Screen refresh unavailable."); }
  }) };
});

describe("workspace backup completion", () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.delete();
    await db.open();
    vi.stubGlobal("React", React);
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn()
    })));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete();
  });

  it("closes a committed restore and gives reload guidance when content refresh fails", async () => {
    const timestamp = "2026-09-22T00:00:00.000Z";
    const blob = await createWorkspaceBackupBlob({
      appVersion: "0.1.0", exportedAt: timestamp, books: [], githubSources: [], bookmarks: [],
      pages: [{ id: "archive-page", title: "Recovered", body: "Saved content", folderId: null, order: 0, createdAt: timestamp, updatedAt: timestamp }]
    });
    render(<ThemeProvider><Suspense fallback={null}><MdezWorkspace /></Suspense></ThemeProvider>);
    await screen.findByRole("heading", { name: "Your library starts here." });
    fireEvent.click(screen.getAllByRole("button", { name: /import/i })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: "Restore backup" }));
    fireEvent.change(within(dialog).getByLabelText("Choose Mdez backup"), { target: { files: [new File([blob], "backup.mdez.zip")] } });
    await within(dialog).findByText("Backup ready to restore");
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore backup" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent(/Restored 1 page in 0 books.*reload/i);
    expect(await db.documents.toArray()).toEqual([expect.objectContaining({ title: "Recovered", body: "Saved content" })]);
    fireEvent.click(screen.getAllByRole("button", { name: /import/i })[0]);
    const reopened = await screen.findByRole("dialog");
    fireEvent.click(within(reopened).getByRole("tab", { name: "Restore backup" }));
    expect(within(reopened).getByRole("button", { name: "Restore backup" })).toBeDisabled();
  });
});
