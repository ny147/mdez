"use client";

import { Archive, ChevronDown, ShieldCheck } from "lucide-react";

import { formatRelativeTime } from "@/lib/workspace-copy";

type StorageTrustProps = {
  workspaceKind: "local" | "group";
  lastBackupAt: string | null;
  busy: boolean;
  onBackup: () => void;
};

export function StorageTrust({ workspaceKind, lastBackupAt, busy, onBackup }: StorageTrustProps) {
  const age = lastBackupAt ? Date.now() - Date.parse(lastBackupAt) : null;
  const stale = age !== null && Number.isFinite(age) && age > 7 * 24 * 60 * 60 * 1000;
  const recency = lastBackupAt ? `Last workspace backup ${formatRelativeTime(lastBackupAt)}` : "No workspace backup yet";

  return (
    <aside className="storage-trust" aria-label="Workspace storage and backup">
      <div className="storage-trust-summary">
        <ShieldCheck aria-hidden="true" className="h-5 w-5 text-accent-read" />
        <div className="min-w-0">
          <p className="font-bold text-ink">{workspaceKind === "local" ? "Stored in this browser" : "Shared workspace · access key saved in this browser"}</p>
          <p className="text-sm font-semibold text-muted">{recency}{stale ? " · Backup recommended" : ""}</p>
        </div>
        <button type="button" disabled={busy} onClick={onBackup} className="secondary-button px-3 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-55">
          <Archive aria-hidden="true" className="h-4 w-4" />{busy ? "Preparing…" : "Back up now"}
        </button>
      </div>
      <details className="storage-trust-details">
        <summary><span>How Mdez stores and shares pages</span><ChevronDown aria-hidden="true" className="h-4 w-4" /></summary>
        <p>Local Library pages are stored in this browser. Clearing site data can remove them. A workspace backup downloads a restorable copy. Key Group pages are stored by the group service and are available to anyone with its access key. Shared Links publish selected pages to anyone with the link.</p>
      </details>
    </aside>
  );
}
