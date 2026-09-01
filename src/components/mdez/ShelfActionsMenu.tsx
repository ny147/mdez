"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Archive, BookOpen, Download, MoreHorizontal, Upload } from "lucide-react";

type ShelfActionsMenuProps = {
  bookExportLabel: string;
  bookExportDescription: string;
  bookExportDisabled: boolean;
  onCreateBook: () => void;
  onImportMarkdown: () => void;
  onExportBook: () => void;
  onBackupWorkspace: () => void;
};

type MenuAction = {
  label: string;
  description: string;
  disabled?: boolean;
  icon: typeof BookOpen;
  onSelect: () => void;
};

export function ShelfActionsMenu(props: ShelfActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const actions: MenuAction[] = [
    { label: "Create book", description: "Add a new book to the root shelf.", icon: BookOpen, onSelect: props.onCreateBook },
    { label: "Import Markdown", description: "Add files, pasted text, or a public GitHub repository.", icon: Upload, onSelect: props.onImportMarkdown },
    { label: props.bookExportLabel, description: props.bookExportDescription, disabled: props.bookExportDisabled, icon: Download, onSelect: props.onExportBook },
    { label: "Download workspace backup", description: "Create a restorable copy of this workspace.", icon: Archive, onSelect: props.onBackupWorkspace }
  ];

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => {
      itemRefs.current.find((item) => item && !item.disabled)?.focus();
    });
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

  function enabledItems() {
    return itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled));
  }

  function focusAt(index: number) {
    const items = enabledItems();
    if (items.length > 0) items[(index + items.length) % items.length]?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = enabledItems();
    const current = items.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") { event.preventDefault(); focusAt(current + 1); }
    if (event.key === "ArrowUp") { event.preventDefault(); focusAt(current - 1); }
    if (event.key === "Home") { event.preventDefault(); focusAt(0); }
    if (event.key === "End") { event.preventDefault(); focusAt(-1); }
  }

  function select(action: MenuAction) {
    if (action.disabled) return;
    setOpen(false);
    action.onSelect();
  }

  return (
    <div className="shelf-actions-menu">
      <button ref={triggerRef} type="button" aria-label="More Shelf actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="secondary-button shelf-more-button px-4 py-2 text-sm font-extrabold">
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" /><span>More</span>
      </button>
      {open ? (
        <div ref={menuRef} role="menu" aria-label="Shelf actions" className="shelf-actions-popover" onKeyDown={handleMenuKeyDown}>
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button key={action.label} ref={(element) => { itemRefs.current[index] = element; }} type="button" role="menuitem" disabled={action.disabled} onClick={() => select(action)} className="shelf-menu-item">
                <Icon aria-hidden="true" className="h-4 w-4" />
                <span><span className="shelf-menu-title">{action.label}</span><span className="shelf-menu-description">{action.description}</span></span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
