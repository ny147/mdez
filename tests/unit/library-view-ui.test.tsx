import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { BookCover } from "@/components/mdez/BookCover";
import { LibraryPageList } from "@/components/mdez/LibraryPageList";
import { LibrarySearch } from "@/components/mdez/LibrarySearch";
import { ShelfPane } from "@/components/mdez/ShelfPane";
import type { Document, Folder } from "@/types/content";

const timestamp = "2026-09-07T00:00:00.000Z";
const book: Folder = { id: "book", name: "แนวคิดสำหรับ世界", parentId: null, order: 0, createdAt: timestamp, updatedAt: timestamp };
const page: Document = { id: "page", title: "A very long multilingual page title ภาษาไทย 日本語 that must remain available in full", body: "body", folderId: "book", order: 0, createdAt: timestamp, updatedAt: timestamp };

describe("redesigned library presentation", () => {
  it("renders a real zero-page cover and selects a child book", () => {
    const select = vi.fn();
    render(<BookCover folder={book} directPageCount={0} selected={false} onSelect={select} />);
    fireEvent.click(screen.getByRole("button", { name: /0 pages, closed/i }));
    expect(select).toHaveBeenCalledWith("book");
    expect(screen.getAllByText("0 pages")).toHaveLength(2);
  });

  it("keeps the page target independent from its bookmark toggle and preserves the full title", () => {
    const open = vi.fn();
    const toggle = vi.fn();
    render(<LibraryPageList documents={[page]} folders={[book]} bookmarkedIds={new Set()} onSelectDocument={open} onToggleBookmark={toggle} />);
    const item = screen.getByRole("listitem");
    fireEvent.click(within(item).getByRole("button", { name: new RegExp(`Open ${page.title}`) }));
    expect(open).toHaveBeenCalledWith("page");
    expect(toggle).not.toHaveBeenCalled();
    fireEvent.click(within(item).getByRole("button", { name: new RegExp(`Bookmark ${page.title}`) }));
    expect(toggle).toHaveBeenCalledWith("page");
    expect(within(item).getByText(page.title)).toHaveAttribute("title", page.title);
  });

  it("submits search and offers an explicit clear action for zero results", () => {
    const change = vi.fn();
    const submit = vi.fn();
    const clear = vi.fn();
    render(<LibrarySearch query="missing" onQueryChange={change} onSubmit={submit} hasResults={false} onClear={clear} />);
    fireEvent.submit(screen.getByRole("search"));
    expect(submit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("surfaces unavailable personal metadata without blocking the library", () => {
    render(
      <ShelfPane
        folders={[]}
        documents={[]}
        books={[]}
        pages={[]}
        selectedFolderId={null}
        selectedDocumentId={null}
        filter="all"
        query=""
        bookmarkedIds={new Set()}
        resumePage={null}
        metadataError="Bookmarks are unavailable in this browser."
        isReady
        onSelectFolder={vi.fn()}
        onSelectDocument={vi.fn()}
        onToggleBookmark={vi.fn()}
        onCreateDocument={vi.fn()}
        onCreateFolder={vi.fn()}
        onOpenImport={vi.fn()}
        onExportFolder={vi.fn()}
        onClearSearch={vi.fn()}
      />
    );

    expect(screen.getByText("Bookmarks are unavailable in this browser.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create page" })).toBeEnabled();
  });
});
