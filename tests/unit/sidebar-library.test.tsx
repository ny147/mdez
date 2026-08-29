import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DocumentList } from "@/components/mdez/DocumentList";
import { FolderTree } from "@/components/mdez/FolderTree";
import type { Document, Folder } from "@/types/content";

const document: Document = {
  id: "document-1",
  title: "Probability notes.md",
  body: "# Notes",
  folderId: null,
  order: 0,
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z"
};

const folder: Folder = {
  id: "folder-1",
  name: "Study",
  parentId: null,
  order: 0,
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z"
};

beforeAll(() => {
  vi.stubGlobal("React", React);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("compact sidebar library", () => {
  it("explains that unsorted pages have not been added to a book", () => {
    const onSelectFolder = vi.fn();

    render(
      <FolderTree
        folders={[folder]}
        documents={[document]}
        selectedFolderId={null}
        expandedFolderIds={new Set()}
        onSelectFolder={onSelectFolder}
        onToggleFolder={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
      />
    );

    const unsorted = screen.getByRole("button", { name: /Unsorted pages, 1 page, open/i });
    expect(within(unsorted).getByText("Not added to a book yet")).toBeVisible();
    fireEvent.click(unsorted);
    expect(onSelectFolder).toHaveBeenCalledWith(null);
  });

  it("shows each page as one compact row with management actions on demand", () => {
    render(
      <DocumentList
        folders={[folder]}
        documents={[document]}
        selectedFolderId={null}
        selectedDocumentId={document.id}
        onSelectDocument={vi.fn()}
        onCreateDocument={vi.fn()}
        onRenameDocument={vi.fn()}
        onMoveDocument={vi.fn()}
        onDeleteDocument={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Unsorted pages" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create page" })).toBeVisible();

    const row = screen.getByRole("article", { name: "Probability notes.md" });
    expect(within(row).getByText("Probability notes.md")).toBeVisible();
    expect(within(row).queryByText("Manage page")).not.toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Manage Probability notes.md" }));
    expect(within(row).getByRole("button", { name: "Rename Probability notes.md" })).toBeVisible();
    expect(within(row).getByRole("combobox", { name: "Move Probability notes.md page" })).toBeVisible();
    expect(within(row).getByRole("button", { name: "Delete Probability notes.md" })).toBeVisible();
  });
});
