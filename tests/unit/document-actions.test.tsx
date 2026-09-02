import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { DocumentActions } from "@/components/mdez/DocumentActions";
import type { Document, Folder } from "@/types/content";

const timestamp = "2026-09-02T00:00:00.000Z";
const documentItem: Document = {
  id: "notes",
  title: "Notes",
  body: "# Notes",
  folderId: null,
  order: 0,
  createdAt: timestamp,
  updatedAt: timestamp
};
const folders: Folder[] = [
  { id: "writing", name: "Writing", parentId: null, order: 0, createdAt: timestamp, updatedAt: timestamp }
];

it("discloses page management in a labelled group and restores focus", () => {
  render(
    <DocumentActions
      document={documentItem}
      folders={folders}
      onRename={vi.fn()}
      onMove={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  const trigger = screen.getByRole("button", { name: "Manage Notes" });
  fireEvent.click(trigger);

  expect(screen.getByRole("group", { name: "Manage Notes" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Rename Notes" })).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Move Notes page" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Delete Notes" })).toBeVisible();

  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("group", { name: "Manage Notes" })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("closes the popover after moving a page", () => {
  const onMove = vi.fn();
  render(
    <DocumentActions
      document={documentItem}
      folders={folders}
      onRename={vi.fn()}
      onMove={onMove}
      onDelete={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Manage Notes" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Move Notes page" }), { target: { value: "writing" } });

  expect(onMove).toHaveBeenCalledWith("writing");
  expect(screen.getByRole("button", { name: "Manage Notes" })).toHaveAttribute("aria-expanded", "false");
});
