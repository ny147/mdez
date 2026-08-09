"use client";

import { MoreHorizontal } from "lucide-react";
import { useId, useRef, type MouseEvent, type ReactNode } from "react";

type RowActionsPopoverProps = {
  label: string;
  children: ReactNode;
  selected: boolean;
};

export function RowActionsPopover({ label, children, selected }: RowActionsPopoverProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function positionPopover() {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;

    const rect = trigger.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - 208, window.innerWidth - 216));
    const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 232));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function closeAfterAction(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-row-action]")) {
      popoverRef.current?.hidePopover();
      triggerRef.current?.focus();
    }
  }

  return (
    <div className="sidebar-row-actions" data-selected={selected}>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-label={label}
        title={label}
        className="sidebar-row-actions-trigger"
        onClick={positionPopover}
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </button>
      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        aria-label={label}
        className="row-actions-popover"
        onClick={closeAfterAction}
      >
        {children}
      </div>
    </div>
  );
}
