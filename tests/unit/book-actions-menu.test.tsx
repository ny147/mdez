import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { BookActionsMenu } from "@/components/mdez/BookActionsMenu";
import type { Folder } from "@/types/content";

const folder: Folder = {
  id: "writing",
  name: "Writing",
  parentId: null,
  order: 0,
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z"
};

it("discloses book actions and restores focus after Escape", () => {
  render(
    <BookActionsMenu
      folder={folder}
      onCreateInside={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  const trigger = screen.getByRole("button", { name: "Manage Writing" });
  fireEvent.click(trigger);

  expect(screen.getByRole("menuitem", { name: "Create book inside Writing" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Rename Writing" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Delete Writing" })).toBeVisible();

  fireEvent.keyDown(screen.getByRole("menu", { name: "Writing actions" }), { key: "Escape" });

  expect(screen.queryByRole("menu", { name: "Writing actions" })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("closes before invoking the selected action", () => {
  const onRename = vi.fn();
  render(
    <BookActionsMenu
      folder={folder}
      onCreateInside={vi.fn()}
      onRename={onRename}
      onDelete={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Manage Writing" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename Writing" }));

  expect(onRename).toHaveBeenCalledOnce();
  expect(screen.queryByRole("menu", { name: "Writing actions" })).not.toBeInTheDocument();
});
