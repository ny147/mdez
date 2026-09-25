import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BackupImportPanel } from "@/components/mdez/import/BackupImportPanel";
import { backupPlan } from "./backup-test-fixture";

describe("BackupImportPanel", () => {
  it("shows the restore effects without rendering Markdown bodies", () => {
    render(<BackupImportPanel preview={backupPlan} message="" busyAction={null} onFile={vi.fn()} onDraggingChange={vi.fn()} dragging={false} />);

    for (const text of ["3 books", "1 empty book", "4 pages", "1 Unsorted page", "1 bookmark", "Notes → Notes (restored)"]) {
      expect(screen.getByText(text)).toBeVisible();
    }
    expect(screen.getByText(/restored as a local copy/i)).toBeVisible();
    expect(screen.queryByText("private markdown body")).not.toBeInTheDocument();
  });

  it("accepts one Mdez ZIP through the picker and drag/drop", () => {
    const onFile = vi.fn();
    const onDraggingChange = vi.fn();
    const { container } = render(<BackupImportPanel preview={null} message="" busyAction={null} onFile={onFile} onDraggingChange={onDraggingChange} dragging={false} />);
    const input = screen.getByLabelText("Choose Mdez backup");
    const first = new File(["backup"], "library.mdez.zip", { type: "application/zip" });
    fireEvent.change(input, { target: { files: [first] } });
    expect(input).toHaveAttribute("accept", ".mdez.zip,application/zip");
    expect(onFile).toHaveBeenCalledWith(first);

    const dropZone = container.querySelector("[data-backup-drop-zone]")!;
    const second = new File(["second"], "other.mdez.zip", { type: "application/zip" });
    fireEvent.dragEnter(dropZone, { dataTransfer: { files: [second] } });
    fireEvent.drop(dropZone, { dataTransfer: { files: [second] } });
    expect(onDraggingChange).toHaveBeenCalledWith(true);
    expect(onFile).toHaveBeenLastCalledWith(second);
  });

  it("disables selection while busy and associates errors with the panel", () => {
    render(<BackupImportPanel preview={null} message="The backup is damaged." busyAction="backup-preview" onFile={vi.fn()} onDraggingChange={vi.fn()} dragging={false} />);
    expect(screen.getByLabelText("Choose Mdez backup")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("The backup is damaged.");
  });
});
