import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImportDialog } from "@/components/mdez/ImportDialog";
import { WorkspaceBackupError } from "@/types/backup";
import { backupPlan } from "./backup-test-fixture";

function props(overrides: Partial<React.ComponentProps<typeof ImportDialog>> = {}) {
  return {
    folders: [],
    selectedFolderId: null,
    onClose: vi.fn(),
    onImport: vi.fn().mockResolvedValue(undefined),
    onRequestGitHubPreview: vi.fn(),
    onImportGitHub: vi.fn(),
    onRequestBackupPreview: vi.fn().mockResolvedValue(backupPlan),
    onRestoreBackup: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function selectRestoreTab() {
  const github = screen.getByRole("tab", { name: "GitHub repository" });
  fireEvent.keyDown(github, { key: "ArrowRight" });
  return screen.getByRole("tab", { name: "Restore backup" });
}

describe("ImportDialog backup restore", () => {
  it("adds Restore backup to roving tab navigation", async () => {
    render(<ImportDialog {...props()} />);
    const restore = selectRestoreTab();
    await waitFor(() => expect(restore).toHaveFocus());
    expect(restore).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(restore, { key: "Home" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Paste text" })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("tab", { name: "Paste text" }), { key: "End" });
    await waitFor(() => expect(restore).toHaveFocus());
  });

  it("previews and confirms the selected backup", async () => {
    const callbacks = props();
    render(<ImportDialog {...callbacks} />);
    selectRestoreTab();
    const file = new File(["backup"], "library.mdez.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Choose Mdez backup"), { target: { files: [file] } });
    await waitFor(() => expect(callbacks.onRequestBackupPreview).toHaveBeenCalledWith(file));
    const restoreButton = await screen.findByRole("button", { name: "Restore backup" });
    expect(restoreButton).toBeEnabled();
    fireEvent.click(restoreButton);
    await waitFor(() => expect(callbacks.onRestoreBackup).toHaveBeenCalledWith(backupPlan));
  });

  it("clears an old preview immediately when a replacement file is selected", async () => {
    let resolveSecond!: (plan: typeof backupPlan) => void;
    const onRequestBackupPreview = vi.fn()
      .mockResolvedValueOnce(backupPlan)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(<ImportDialog {...props({ onRequestBackupPreview })} />);
    selectRestoreTab();
    const input = screen.getByLabelText("Choose Mdez backup");
    fireEvent.change(input, { target: { files: [new File(["a"], "first.mdez.zip")] } });
    await screen.findByText("Backup ready to restore");
    fireEvent.change(input, { target: { files: [new File(["b"], "second.mdez.zip")] } });
    expect(screen.queryByText("Backup ready to restore")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /checking backup/i })).toBeDisabled();
    for (const tab of screen.getAllByRole("tab")) expect(tab).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close import" })).toBeDisabled();
    resolveSecond(backupPlan);
    await screen.findByText("Backup ready to restore");
  });

  it("clears stale plans but retains other failed plans for retry", async () => {
    const stale = props({ onRestoreBackup: vi.fn().mockRejectedValue(new WorkspaceBackupError("stale_preview", "Preview again.")) });
    const { unmount } = render(<ImportDialog {...stale} />);
    selectRestoreTab();
    fireEvent.change(screen.getByLabelText("Choose Mdez backup"), { target: { files: [new File(["a"], "one.mdez.zip")] } });
    fireEvent.click(await screen.findByRole("button", { name: "Restore backup" }));
    await screen.findByText("Preview again.");
    expect(screen.getByRole("button", { name: "Restore backup" })).toBeDisabled();
    unmount();

    const ordinary = props({ onRestoreBackup: vi.fn().mockRejectedValue(new Error("Storage unavailable.")) });
    render(<ImportDialog {...ordinary} />);
    selectRestoreTab();
    fireEvent.change(screen.getByLabelText("Choose Mdez backup"), { target: { files: [new File(["b"], "two.mdez.zip")] } });
    fireEvent.click(await screen.findByRole("button", { name: "Restore backup" }));
    await screen.findByText("Storage unavailable.");
    expect(screen.getByRole("button", { name: "Restore backup" })).toBeEnabled();
  });
});
