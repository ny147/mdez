import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { BookDialog } from "@/components/mdez/BookDialog";
import type { Folder } from "@/types/content";

function folder(overrides: Partial<Folder> = {}): Folder {
  return { id: "folder-1", name: "Book", parentId: null, order: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", ...overrides };
}

it("preserves input and reports duplicate sibling names", () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  render(<BookDialog intent={{ mode: "create", parentId: null, parentName: null }} folders={[folder({ name: "Research" })]} busy={false} onClose={onClose} onSubmit={onSubmit} />);
  const input = screen.getByRole("textbox", { name: "Book name" });
  fireEvent.change(input, { target: { value: "research" } });
  fireEvent.click(screen.getByRole("button", { name: "Create book" }));
  expect(screen.getByRole("alert")).toHaveTextContent("A book named Research already exists here.");
  expect(input).toHaveValue("research");
  expect(onSubmit).not.toHaveBeenCalled();
});
