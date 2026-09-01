import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { BackupImportPanel } from "@/components/mdez/import/BackupImportPanel";
import { createWorkspaceBackupBlob } from "@/lib/workspace-backup";

it("previews a backup before explicit restore and preserves it after an error", async () => {
  const blob = await createWorkspaceBackupBlob({
    appVersion: "0.1.0",
    workspace: { kind: "local", id: null, name: "Research" },
    folders: [],
    documents: [{ id: "page", title: "Brief", body: "# Brief", folderId: null, order: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }],
    githubSources: []
  });
  const onRestore = vi.fn().mockRejectedValue(new Error("Restore failed safely."));
  render(<BackupImportPanel disabled={false} onBusyChange={vi.fn()} onRestore={onRestore} onRestored={vi.fn()} />);
  const file = new File([blob], "research.mdez.zip", { type: "application/zip" });
  fireEvent.change(screen.getByLabelText("Choose Mdez workspace backup"), { target: { files: [file] } });
  expect(await screen.findByText("Research")).toBeVisible();
  expect(screen.getByText(/1 page/)).toBeVisible();
  const restore = screen.getByRole("button", { name: "Restore to Local Library" });
  expect(restore).toBeEnabled();
  fireEvent.click(restore);
  await waitFor(() => expect(onRestore).toHaveBeenCalledOnce());
  expect(await screen.findByRole("alert")).toHaveTextContent("Restore failed safely.");
  expect(screen.getByText("Research")).toBeVisible();
});
