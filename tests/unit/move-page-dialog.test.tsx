import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { MovePageDialog } from "@/components/mdez/MovePageDialog";
import type { Document, Folder } from "@/types/content";

const stamp = "2026-09-13T00:00:00.000Z";
const page: Document = { id: "page", title: "Draft", body: "keep", folderId: "current", order: 0, createdAt: stamp, updatedAt: stamp };
const books: Folder[] = [
  { id: "current", name: "Current", parentId: null, order: 0, createdAt: stamp, updatedAt: stamp },
  { id: "research", name: "Research notes", parentId: null, order: 1, createdAt: stamp, updatedAt: stamp }
];

describe("MovePageDialog", () => {
  it("filters destinations, excludes the current book, and moves explicitly", async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    render(<MovePageDialog page={page} books={books} onMove={move} onClose={vi.fn()} />);
    expect(screen.queryByText("Current")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search books" }), { target: { value: "rese" } });
    fireEvent.click(screen.getByRole("radio", { name: "Research notes" }));
    fireEvent.click(screen.getByRole("button", { name: "Move page" }));
    expect(move).toHaveBeenCalledWith("page", "research");
  });

  it("keeps the dialog and error visible after a rejected move", async () => {
    render(<MovePageDialog page={page} books={books} onMove={vi.fn().mockRejectedValue(new Error("offline"))} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Unsorted pages" }));
    fireEvent.click(screen.getByRole("button", { name: "Move page" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not move");
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("clears a destination when filtering hides it", () => {
    render(<MovePageDialog page={page} books={books} onMove={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Research notes" }));
    expect(screen.getByRole("button", { name: "Move page" })).toBeEnabled();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search books" }), { target: { value: "missing" } });

    expect(screen.getByRole("button", { name: "Move page" })).toBeDisabled();
  });
});
