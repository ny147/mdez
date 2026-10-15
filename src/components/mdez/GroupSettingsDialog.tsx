"use client";

import React, { useEffect, useState } from "react";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type { GroupSummary } from "@/types/key-group";

type Props = { open: boolean; group: GroupSummary; groupKey?: string; busy: boolean; onClose: () => void; onRename: (name: string) => void; onLeave: () => void; onDelete: () => void; onRestore: () => void };
export function GroupSettingsDialog({ open, group, groupKey, busy, onClose, onRename, onLeave, onDelete, onRestore }: Props) {
  const [name, setName] = useState(group.name);
  const [showKey, setShowKey] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  useEffect(() => setName(group.name), [group.name]);
  useEffect(() => { setShowKey(false); setCopyStatus("idle"); }, [open, group.id, groupKey]);

  async function copyKey() {
    if (!groupKey) return;
    try { await navigator.clipboard.writeText(groupKey); setCopyStatus("copied"); }
    catch { setCopyStatus("error"); }
  }

  if (!open) return null;
  return <ModalDialog title="Group settings" titleId="group-settings-title" closeLabel="Close group settings" onClose={onClose}>
    <div className="mt-5 space-y-5">
      {groupKey ? <div className="space-y-3">
        <label className="block text-sm font-bold">Group key<input readOnly type={showKey ? "text" : "password"} value={groupKey} autoComplete="off" spellCheck={false} className="mt-2 w-full min-w-0 rounded border border-border bg-surface px-3 py-2 font-mono text-base" /></label>
        <p className="text-sm text-muted">Anyone with this key can join and manage the group. Share it only with people you trust.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={showKey} onClick={() => setShowKey((value) => !value)} className="min-h-11 rounded border border-border bg-surface px-4 py-2 font-bold">{showKey ? "Hide key" : "Show key"}</button>
          <button type="button" onClick={() => void copyKey()} className="min-h-11 rounded border border-border bg-surface px-4 py-2 font-bold">Copy key</button>
        </div>
        {copyStatus === "copied" ? <p role="status" className="text-sm text-muted">Key copied</p> : null}
        {copyStatus === "error" ? <p role="alert" className="text-sm text-accent-files">Could not copy. Show the key and copy it manually.</p> : null}
      </div> : null}
      {group.deletedAt ? <div className="rounded border border-border bg-panel p-3 text-sm leading-6"><p>This group was deleted on {new Date(group.deletedAt).toLocaleString()}.</p><p>Permanent purge: {group.purgeAfter ? new Date(group.purgeAfter).toLocaleString() : "pending"}.</p><button type="button" disabled={busy} onClick={onRestore} className="mt-3 rounded bg-accent px-4 py-2 font-bold text-accent-on">Restore group</button></div> : <><label className="block text-sm font-bold">Group name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded border border-border bg-surface px-3 py-2" /></label><button type="button" disabled={busy || !name.trim() || name.trim() === group.name} onClick={() => onRename(name.trim())} className="rounded border border-border bg-surface px-4 py-2 font-bold disabled:opacity-50">Rename group</button><div className="rounded border border-border bg-panel p-3 text-sm leading-6"><p>Deleting the group stops editing for every key holder.</p><button type="button" disabled={busy} onClick={onDelete} className="mt-3 rounded bg-accent-files px-4 py-2 font-bold text-accent-on">Delete group for everyone</button></div></>}
      <div className="border-t border-border pt-4"><p className="mb-3 text-sm text-muted">Leaving removes this browser&apos;s remembered key and cached copy. The shared group remains available to other key holders.</p><button type="button" disabled={busy} onClick={onLeave} className="rounded border border-border bg-surface px-4 py-2 font-bold">Leave group on this browser</button></div>
    </div>
  </ModalDialog>;
}
