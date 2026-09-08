"use client";

import { ChevronDown, Plus, Users } from "lucide-react";
import React from "react";
import { useState } from "react";
import type { RememberedGroup } from "@/lib/db";

type Props = { activeGroupId: string | null; groups: RememberedGroup[]; onSelect: (groupId: string | null) => void; onCreate: () => void; onJoin: () => void };

export function WorkspaceSwitcher({ activeGroupId, groups, onSelect, onCreate, onJoin }: Props) {
  const [open, setOpen] = useState(false);
  const current = groups.find((group) => group.groupId === activeGroupId)?.name ?? "Local Library";
  const choose = (groupId: string | null) => { onSelect(groupId); setOpen(false); };
  return (
    <div className="workspace-switcher relative">
      <button type="button" aria-label={`Current workspace: ${current}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="workspace-switcher-trigger inline-flex h-9 max-w-56 items-center gap-2 rounded border border-border bg-surface px-3 text-sm font-bold text-ink shadow-soft hover:bg-panel">
        <Users aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" /><span className="truncate">{current}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
      </button>
      {open ? (
        <div className="floating-surface absolute left-0 top-11 z-40 w-64 space-y-1 p-2" aria-label="Workspaces">
          <button type="button" onClick={() => choose(null)} className="w-full rounded px-3 py-2 text-left text-sm font-semibold hover:bg-panel">Local Library</button>
          {groups.map((group) => <button key={group.groupId} type="button" onClick={() => choose(group.groupId)} className="w-full truncate rounded px-3 py-2 text-left text-sm font-semibold hover:bg-panel">{group.name}</button>)}
          <div className="my-2 border-t border-border" />
          <button type="button" onClick={() => { setOpen(false); onCreate(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold hover:bg-panel"><Plus aria-hidden="true" className="h-4 w-4" />Create group</button>
          <button type="button" onClick={() => { setOpen(false); onJoin(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold hover:bg-panel"><Users aria-hidden="true" className="h-4 w-4" />Join group</button>
        </div>
      ) : null}
    </div>
  );
}
