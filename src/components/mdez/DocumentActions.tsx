"use client";

import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import type { Document, Folder } from "@/types/content";
import { WORKSPACE_COPY } from "@/lib/workspace-copy";

type DocumentActionsProps = {
  document: Document;
  folders: Folder[];
  onRename: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
};

export function DocumentActions({ document, folders, onRename, onMove, onDelete }: DocumentActionsProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sortedFolders = folders.slice().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const panelId = `page-actions-${document.id}`;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    globalThis.document.addEventListener("pointerdown", onPointerDown);
    globalThis.document.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.document.removeEventListener("pointerdown", onPointerDown);
      globalThis.document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function select(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="sidebar-item-actions sidebar-page-actions">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Manage ${document.title}`}
        title={`Manage ${document.title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="sidebar-item-actions-trigger"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </button>

      {open ? (
        <div ref={panelRef} id={panelId} role="group" aria-label={`Manage ${document.title}`} className="sidebar-page-actions-popover">
          <button type="button" onClick={() => select(onRename)} aria-label={`Rename ${document.title}`} className="sidebar-item-action">
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Rename page
          </button>
          <label className="sidebar-page-move-label">
            <span>Move page to</span>
            <select
              value={document.folderId ?? ""}
              onChange={(event) => select(() => onMove(event.currentTarget.value || null))}
              aria-label={`Move ${document.title} page`}
              className="workspace-input"
            >
              <option value="">{WORKSPACE_COPY.pagesWithoutBook}</option>
              {sortedFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => select(onDelete)} aria-label={`Delete ${document.title}`} className="sidebar-item-action is-danger">
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Delete page
          </button>
        </div>
      ) : null}
    </div>
  );
}
