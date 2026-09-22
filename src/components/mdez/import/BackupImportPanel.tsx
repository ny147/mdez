"use client";

import React, { forwardRef, type DragEvent } from "react";
import { ArchiveRestore, Upload } from "lucide-react";

import type { WorkspaceRestorePlan } from "@/types/backup";

type BackupBusyAction = "local" | "preview" | "github" | "backup-preview" | "backup-restore" | null;

type BackupImportPanelProps = {
  preview: WorkspaceRestorePlan | null;
  message: string;
  busyAction: BackupBusyAction;
  dragging: boolean;
  onFile: (file: File) => void;
  onDraggingChange: (dragging: boolean) => void;
};

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const BackupImportPanel = forwardRef<HTMLInputElement, BackupImportPanelProps>(function BackupImportPanel({
  preview,
  message,
  busyAction,
  dragging,
  onFile,
  onDraggingChange
}, ref) {
  const busy = busyAction !== null;

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    onDraggingChange(false);
    if (!busy && event.dataTransfer.files[0]) onFile(event.dataTransfer.files[0]);
  }

  return (
    <section id="import-panel-backup" role="tabpanel" aria-labelledby="import-source-backup" className="mt-5 grid gap-4">
      <div
        data-backup-drop-zone
        onDragEnter={(event) => { event.preventDefault(); if (!busy) onDraggingChange(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDraggingChange(false); }}
        onDrop={handleDrop}
        className={`grid justify-items-center gap-3 rounded-lg border border-dashed px-5 py-6 text-center transition ${dragging ? "border-accent bg-accent-soft" : "border-border bg-panel"}`}
      >
        <ArchiveRestore aria-hidden="true" className="h-7 w-7 text-accent" />
        <div>
          <p className="font-extrabold text-ink">Drop an Mdez backup here</p>
          <p className="mt-1 text-sm text-muted">Only complete <span className="font-mono">.mdez.zip</span> library backups are supported.</p>
        </div>
        <label className="secondary-button inline-flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 text-sm font-black has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
          <Upload aria-hidden="true" className="h-4 w-4" />
          Choose Mdez backup
          <input
            ref={ref}
            className="sr-only"
            type="file"
            aria-label="Choose Mdez backup"
            accept=".mdez.zip,application/zip"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {message ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-bold text-danger">{message}</p> : null}

      {preview ? (
        <div className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <div>
            <h3 className="text-base font-black text-ink">Backup ready to restore</h3>
            <p className="mt-1 text-sm text-muted">
              Exported <time dateTime={preview.parsed.manifest.exportedAt}>{new Date(preview.parsed.manifest.exportedAt).toLocaleString()}</time>
              {" · schema "}{preview.parsed.manifest.schemaVersion}{" · "}{formatBytes(preview.summary.totalMarkdownBytes)}
            </p>
          </div>
          <ul aria-label="Backup contents" className="flex flex-wrap gap-2 text-xs font-extrabold text-ink">
            <li className="rounded-full bg-panel px-3 py-1.5">{countLabel(preview.summary.bookCount, "book")}</li>
            <li className="rounded-full bg-panel px-3 py-1.5">{countLabel(preview.summary.emptyBookCount, "empty book")}</li>
            <li className="rounded-full bg-panel px-3 py-1.5">{countLabel(preview.summary.pageCount, "page")}</li>
            <li className="rounded-full bg-panel px-3 py-1.5">{countLabel(preview.summary.unsortedPageCount, "Unsorted page")}</li>
            <li className="rounded-full bg-panel px-3 py-1.5">{countLabel(preview.summary.bookmarkCount, "bookmark")}</li>
          </ul>
          {preview.books.some((book) => book.renamed) ? (
            <div>
              <h4 className="text-sm font-black text-ink">Book names that will change</h4>
              <ul className="mt-2 grid gap-1 text-sm text-muted">
                {preview.books.filter((book) => book.renamed).map((book) => <li key={book.id}>{book.name} → {book.restoredName}</li>)}
              </ul>
            </div>
          ) : null}
          {preview.sources.length > 0 ? (
            <div>
              <h4 className="text-sm font-black text-ink">GitHub refresh linkage</h4>
              <ul className="mt-2 grid gap-1 text-sm text-muted">
                {preview.sources.map((source) => (
                  <li key={source.id}>
                    {source.owner}/{source.repository} — {source.action === "retain" ? "refresh linkage retained" : "restored as a local copy without refresh linkage"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
});
