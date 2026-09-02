"use client";

import React, { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import type { Folder } from "@/types/content";

type BookActionsMenuProps = {
  folder: Folder;
  onCreateInside: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export function BookActionsMenu({ folder, onCreateInside, onRename, onDelete }: BookActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const actions = [
    { label: `Create book inside ${folder.name}`, icon: BookOpen, onSelect: onCreateInside, danger: false },
    { label: `Rename ${folder.name}`, icon: Pencil, onSelect: onRename, danger: false },
    { label: `Delete ${folder.name}`, icon: Trash2, onSelect: onDelete, danger: true }
  ];

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => itemRefs.current[0]?.focus());
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function focusItem(index: number) {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item));
    if (items.length > 0) items[(index + items.length) % items.length]?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item));
    const current = items.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") { event.preventDefault(); focusItem(current + 1); }
    if (event.key === "ArrowUp") { event.preventDefault(); focusItem(current - 1); }
    if (event.key === "Home") { event.preventDefault(); focusItem(0); }
    if (event.key === "End") { event.preventDefault(); focusItem(-1); }
  }

  function select(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="sidebar-item-actions">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Manage ${folder.name}`}
        title={`Manage ${folder.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="sidebar-item-actions-trigger"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${folder.name} actions`}
          className="sidebar-item-actions-popover"
          onKeyDown={handleMenuKeyDown}
        >
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                ref={(element) => { itemRefs.current[index] = element; }}
                type="button"
                role="menuitem"
                onClick={() => select(action.onSelect)}
                className={action.danger ? "sidebar-item-action is-danger" : "sidebar-item-action"}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
