import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { SidebarSearch } from "@/components/mdez/SidebarSearch";
import type { Document, Folder } from "@/types/content";

const timestamp = "2026-09-02T00:00:00.000Z";
const folders: Folder[] = [
  { id: "writing", name: "Writing", parentId: null, order: 0, createdAt: timestamp, updatedAt: timestamp },
  { id: "drafts", name: "Drafts", parentId: "writing", order: 0, createdAt: timestamp, updatedAt: timestamp }
];
const documents: Document[] = [
  { id: "launch", title: "Launch plan", body: "", folderId: "drafts", order: 0, createdAt: timestamp, updatedAt: timestamp }
];

it("renders grouped results with path context and clears the query", () => {
  const onQueryChange = vi.fn();
  render(
    <SidebarSearch
      folders={folders}
      documents={documents}
      query="plan"
      disabled={false}
      inputRef={{ current: null }}
      onQueryChange={onQueryChange}
      onSelectFolder={vi.fn()}
      onSelectDocument={vi.fn()}
    />
  );

  expect(screen.getByRole("heading", { name: "Pages" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Open Launch plan in Writing / Drafts" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear search field" }));
  expect(onQueryChange).toHaveBeenCalledWith("");
});

it("shows a recoverable no-results state", () => {
  const onQueryChange = vi.fn();
  render(
    <SidebarSearch
      folders={folders}
      documents={documents}
      query="missing"
      disabled={false}
      inputRef={{ current: null }}
      onQueryChange={onQueryChange}
      onSelectFolder={vi.fn()}
      onSelectDocument={vi.fn()}
    />
  );

  expect(screen.getByText("No books or pages match “missing”.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(onQueryChange).toHaveBeenCalledWith("");
});
