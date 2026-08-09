"use client";

import React from "react";
import { ModalDialog } from "@/components/ui/ModalDialog";

type Props = { open: boolean; busy: boolean; onReload: () => void; onCopy: () => void; onClose: () => void };

export function GroupConflictDialog({ open, busy, onReload, onCopy, onClose }: Props) {
  if (!open) return null;
  return <ModalDialog title="This page changed in the group" titleId="group-conflict-title" closeLabel="Close conflict dialog" onClose={onClose}>
    <div className="mt-5 space-y-4"><p className="max-w-prose text-sm leading-6 text-muted">Another key holder saved this page first. Your draft remains in the editor.</p><div className="flex flex-col gap-2 sm:flex-row"><button type="button" disabled={busy} onClick={onReload} className="rounded border border-border bg-surface px-4 py-2 font-bold text-ink disabled:opacity-50">Reload shared version</button><button type="button" disabled={busy} onClick={onCopy} className="rounded bg-accent px-4 py-2 font-bold text-white disabled:opacity-50">Copy my draft to a new page</button></div></div>
  </ModalDialog>;
}
