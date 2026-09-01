"use client";

import React, { useState } from "react";
import { ArchiveRestore } from "lucide-react";

import { previewWorkspaceBackup } from "@/lib/workspace-backup";
import type { ParsedWorkspaceBackup, WorkspaceBackupPreview } from "@/types/backup";

type BackupImportPanelProps = {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onRestore: (parsed: ParsedWorkspaceBackup) => Promise<{ folderCount: number; documentCount: number }>;
  onRestored: (result: { folderCount: number; documentCount: number }) => void;
};

export function BackupImportPanel({ disabled, onBusyChange, onRestore, onRestored }: BackupImportPanelProps) {
  const [preview, setPreview] = useState<WorkspaceBackupPreview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function updateBusy(next: boolean) {
    setBusy(next);
    onBusyChange(next);
  }

  async function chooseFile(file: File | undefined) {
    if (!file || busy || disabled) return;
    updateBusy(true);
    setMessage("");
    setPreview(null);
    try {
      setPreview(await previewWorkspaceBackup(file));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mdez could not inspect this backup.");
    } finally {
      updateBusy(false);
    }
  }

  async function restore() {
    if (!preview || busy || disabled) return;
    updateBusy(true);
    setMessage("");
    try {
      onRestored(await onRestore(preview.parsed));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mdez could not restore this backup. Your existing pages were not changed.");
    } finally {
      updateBusy(false);
    }
  }

  return (
    <section id="import-panel-backup" role="tabpanel" aria-labelledby="import-source-backup" className="mt-5 grid gap-4">
      <label className="grid min-h-28 cursor-pointer place-items-center gap-2 rounded-md border border-dashed border-border bg-panel p-5 text-center font-bold text-ink">
        <ArchiveRestore aria-hidden="true" className="h-6 w-6 text-accent" />
        Choose Mdez workspace backup
        <span className="text-xs font-semibold text-muted">Select a file ending in .mdez.zip. Nothing is changed until you confirm.</span>
        <input aria-label="Choose Mdez workspace backup" type="file" accept=".mdez.zip,application/zip" disabled={disabled || busy} onChange={(event) => void chooseFile(event.currentTarget.files?.[0])} className="sr-only" />
      </label>

      {preview ? (
        <div className="rounded-md border border-border bg-surface p-4">
          <h3 className="font-display text-lg font-black text-ink">{preview.workspaceName}</h3>
          <p className="mt-1 text-sm font-semibold text-muted">Exported {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(preview.exportedAt))}</p>
          <p className="mt-3 text-sm font-bold text-ink">{`${preview.folderCount} ${preview.folderCount === 1 ? "book" : "books"} · ${preview.documentCount} ${preview.documentCount === 1 ? "page" : "pages"}`}</p>
          {preview.warnings.map((warning) => <p key={warning} className="mt-2 text-sm font-semibold text-muted">{warning}</p>)}
          <button type="button" disabled={busy || disabled} onClick={() => void restore()} className="primary-button mt-4 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Restoring…" : "Restore to Local Library"}
          </button>
        </div>
      ) : null}

      {message ? <p role="alert" className="rounded border border-accent-files/40 bg-panel px-4 py-3 text-sm font-bold text-ink">{message}</p> : null}
    </section>
  );
}
