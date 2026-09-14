import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LibraryTree, UNSORTED_COLLECTION_ID } from "@/components/mdez/LibraryTree";
import type { Document, Folder } from "@/types/content";

const timestamp = "2026-08-29T00:00:00.000Z";
const books: Folder[] = [
  { id: "book-b", name: "Research", parentId: null, order: 0, createdAt: timestamp, updatedAt: timestamp },
  { id: "book-a", name: "My novel", parentId: null, order: 1, createdAt: timestamp, updatedAt: timestamp }
];
const pages: Document[] = [
  { id: "p10", title: "Chapter 10", body: "", folderId: "book-a", order: 0, createdAt: timestamp, updatedAt: timestamp },
  { id: "p2", title: "Chapter 2", body: "", folderId: "book-a", order: 1, createdAt: timestamp, updatedAt: timestamp },
  { id: "loose", title: "Loose note", body: "", folderId: null, order: 0, createdAt: timestamp, updatedAt: timestamp }
];

const renderTree = (overrides: Partial<React.ComponentProps<typeof LibraryTree>> = {}) => {
  const props: React.ComponentProps<typeof LibraryTree> = {
    folders: books, documents: pages, selectedFolderId: "book-a", selectedDocumentId: "p2",
    expandedCollectionId: "book-a", pageReveal: null, filter: "all", onSelectFolder: vi.fn(), onToggleCollection: vi.fn(),
    onRenameFolder: vi.fn(), onDeleteFolder: vi.fn(),
    onSelectDocument: vi.fn(), onCreateDocument: vi.fn(), onRenameDocument: vi.fn(),
    onMoveDocument: vi.fn(), onDeleteDocument: vi.fn(), ...overrides
  };
  return { props, ...render(<LibraryTree {...props} />) };
};

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("flat Library tree", () => {
  it("shows naturally sorted pages inside the one expanded book", () => {
    renderTree();
    const list = screen.getByRole("list", { name: "Pages in My novel" });
    expect(within(list).getAllByRole("button", { name: /^Open / }).map((button) => button.textContent)).toEqual(["Chapter 2", "Chapter 10"]);
    expect(screen.queryByRole("list", { name: "Pages in Research" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage My novel" })).toBeVisible();
  });

  it("keeps book selection and disclosure as separate actions", () => {
    const { props } = renderTree();
    fireEvent.click(screen.getByRole("button", { name: "Open Research book" }));
    expect(props.onSelectFolder).toHaveBeenCalledWith("book-b");
    expect(props.onToggleCollection).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Expand Research" }));
    expect(props.onToggleCollection).toHaveBeenCalledWith("book-b");
  });

  it("expands Unsorted as a fixed collection", () => {
    const { props } = renderTree({ expandedCollectionId: UNSORTED_COLLECTION_ID });
    expect(screen.getByRole("list", { name: "Pages in Unsorted pages" })).toHaveTextContent("Loose note");
    fireEvent.click(screen.getByRole("button", { name: "Collapse Unsorted pages" }));
    expect(props.onToggleCollection).toHaveBeenCalledWith(UNSORTED_COLLECTION_ID);
  });

  it("renames a book inline with Enter", async () => {
    const { props } = renderTree();
    fireEvent.click(screen.getByRole("button", { name: "Manage My novel" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename My novel" }));
    const input = screen.getByRole("textbox", { name: "Rename My novel" });
    fireEvent.change(input, { target: { value: "Draft novel" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onRenameFolder).toHaveBeenCalledWith("book-a", "Draft novel");
    expect(await screen.findByRole("button", { name: "Open My novel book" })).toBeVisible();
  });

  it("keeps a blank rename draft open with adjacent feedback", () => {
    const { props } = renderTree();
    fireEvent.click(screen.getByRole("button", { name: "Manage My novel" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename My novel" }));
    const input = screen.getByRole("textbox", { name: "Rename My novel" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(props.onRenameFolder).not.toHaveBeenCalled();
  });

  it("dismisses only the active menu on Escape and restores its trigger", async () => {
    renderTree();
    const trigger = screen.getByRole("button", { name: "Manage Chapter 2" });
    fireEvent.click(trigger);
    const rename = screen.getByRole("menuitem", { name: "Rename page" });
    fireEvent.keyDown(rename, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("menuitem", { name: "Rename page" })).toBeNull();
  });

  it("keeps a rejected rename draft focused and editable", async () => {
    renderTree({ onRenameDocument: vi.fn().mockRejectedValue(new Error("offline")) });
    fireEvent.click(screen.getByRole("button", { name: "Manage Chapter 2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename page" }));
    const input = screen.getByRole("textbox", { name: "Rename Chapter 2" });
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    expect(input).toHaveFocus();
    expect(input).toBeEnabled();
  });

  it("moves pages through the menu and drag-and-drop", async () => {
    const { props } = renderTree();
    fireEvent.click(screen.getByRole("button", { name: "Manage Chapter 2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to…" }));
    fireEvent.click(screen.getByRole("radio", { name: "Research" }));
    fireEvent.click(screen.getByRole("button", { name: "Move page" }));
    await waitFor(() => expect(props.onMoveDocument).toHaveBeenCalledWith("p2", "book-b"));
    expect(await screen.findByText("Chapter 2 moved to Research.")).toHaveAttribute("aria-live", "polite");
    const transfer = { getData: () => "p2", setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    fireEvent.drop(screen.getByTestId("collection-book-b"), { dataTransfer: transfer });
    expect(props.onMoveDocument).toHaveBeenCalledWith("p2", "book-b");
  });

  it("handles each explicit reveal only once when page data changes", () => {
    const scrollTo = vi.fn();
    const initial = renderTree();
    const props = initial.props;
    initial.unmount();
    const tree = (documents: Document[], sequence: number) => <div className="sidebar-library-scroll" ref={(node) => {
      if (node) Object.defineProperty(node, "scrollTo", { value: scrollTo, configurable: true });
    }}><LibraryTree {...props} documents={documents} pageReveal={{ documentId: "p2", sequence }} /></div>;
    const { rerender } = render(tree(pages, 1));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    rerender(tree(pages.map((page) => ({ ...page })), 1));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    rerender(tree(pages, 2));
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("keeps the mounted page rows bounded for very large books", () => {
    const manyPages = Array.from({ length: 1000 }, (_, index): Document => ({
      id: `page-${index}`, title: `Page ${index}`, body: "", folderId: "book-a", order: index,
      createdAt: timestamp, updatedAt: timestamp
    }));
    renderTree({ documents: manyPages, selectedDocumentId: "page-0" });
    expect(screen.getAllByRole("button", { name: /^Open Page/ }).length).toBeLessThan(100);
  });
});
