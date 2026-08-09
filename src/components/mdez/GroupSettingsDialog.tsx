"use client";

import React, { useEffect, useState } from "react";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type { GroupSummary } from "@/types/key-group";

type Props = { open: boolean; group: GroupSummary; busy: boolean; onClose: () => void; onRename: (name: string) => void; onLeave: () => void; onDelete: () => void; onRestore: () => void };
export function GroupSettingsDialog({ open, group, busy, onClose, onRename, onLeave, onDelete, onRestore }: Props) {
  const [name, setName] = useState(group.name); useEffect(() => setName(group.name), [group.name]); if (!open) return null;
  return <ModalDialog title="Group settings" titleId="group-settings-title" closeLabel="Close group settings" onClose={onClose}>
    <div className="mt-5 space-y-5">
      {group.deletedAt ? <div className="rounded border border-border bg-panel p-3 text-sm leading-6"><p>This group was deleted on {new Date(group.deletedAt).toLocaleString()}.</p><p>Permanent purge: {group.purgeAfter ? new Date(group.purgeAfter).toLocaleString() : "pending"}.</p><button type="button" disabled={busy} onClick={onRestore} className="mt-3 rounded bg-accent px-4 py-2 font-bold text-white">Restore group</button></div> : <><label className="block text-sm font-bold">Group name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded border border-border bg-surface px-3 py-2" /></label><button type="button" disabled={busy || !name.trim() || name.trim() === group.name} onClick={() => onRename(name.trim())} className="rounded border border-border bg-surface px-4 py-2 font-bold disabled:opacity-50">Rename group</button><div className="rounded border border-border bg-panel p-3 text-sm leading-6"><p>Deleting the group stops editing for every key holder.</p><button type="button" disabled={busy} onClick={onDelete} className="mt-3 rounded bg-accent-files px-4 py-2 font-bold text-white">Delete group for everyone</button></div></>}
      <div className="border-t border-border pt-4"><p className="mb-3 text-sm text-muted">Leaving removes this browser&apos;s remembered key and cached copy. The shared group remains available to other key holders.</p><button type="button" disabled={busy} onClick={onLeave} className="rounded border border-border bg-surface px-4 py-2 font-bold">Leave group on this browser</button></div>
    </div>
  </ModalDialog>;
}
