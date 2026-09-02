import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { EditorPane } from "@/components/mdez/EditorPane";
import type { Document } from "@/types/content";

vi.mock("@uiw/react-codemirror", () => ({ default: () => <div aria-label="Markdown editor" /> }));

const page: Document = {
  id: "page-1",
  title: "untitled.md",
  body: "# Untitled",
  folderId: null,
  order: 0,
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z"
};

const props = {
  document: page,
  title: page.title,
  body: page.body,
  saveStatus: "Saved" as const,
  viewMode: "editor" as const,
  onCreateDocument: vi.fn(),
  onOpenImport: vi.fn(),
  onQuickShare: vi.fn(),
  onViewModeChange: vi.fn(),
  onBodyChange: vi.fn(),
  onRename: vi.fn(),
  onTitleFocusHandled: vi.fn()
};

it("focuses and selects the full title for each matching request", () => {
  const { rerender } = render(<EditorPane {...props} titleFocusRequest={null} />);
  const title = screen.getByRole("textbox", { name: "Page title" }) as HTMLInputElement;

  rerender(<EditorPane {...props} titleFocusRequest={{ documentId: page.id, requestId: 1 }} />);
  expect(title).toHaveFocus();
  expect(title.selectionStart).toBe(0);
  expect(title.selectionEnd).toBe(page.title.length);
  expect(props.onTitleFocusHandled).toHaveBeenCalledWith(1);

  title.blur();
  rerender(<EditorPane {...props} titleFocusRequest={{ documentId: page.id, requestId: 2 }} />);
  expect(title).toHaveFocus();
  expect(title.selectionStart).toBe(0);
  expect(title.selectionEnd).toBe(page.title.length);
});
