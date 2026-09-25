"use client";

import React, { type KeyboardEvent, useCallback, useRef, useState } from "react";
import { ArchiveRestore, ClipboardPaste, FileText, Github } from "lucide-react";

import type { Folder } from "@/types/content";
import type { GitHubImportSession } from "@/types/github";
import { WorkspaceBackupError, type WorkspaceRestorePlan } from "@/types/backup";
import { fileNameToTitle, isMarkdownFile, MAX_MARKDOWN_FILE_BYTES, titleFromBody } from "@/lib/markdown";
import { FileImportPanel } from "@/components/mdez/import/FileImportPanel";
import { BackupImportPanel } from "@/components/mdez/import/BackupImportPanel";
import { GitHubImportPanel } from "@/components/mdez/import/GitHubImportPanel";
import { ImportDialogBusyProvider, ImportDialogShell } from "@/components/mdez/import/ImportDialogShell";
import { PasteImportPanel } from "@/components/mdez/import/PasteImportPanel";

type ImportItem = { title: string; body: string };
type ImportSource = "paste" | "files" | "github" | "backup";
type BusyAction = "local" | "preview" | "github" | "backup-preview" | "backup-restore" | null;

type ImportDialogProps = {
  folders: Folder[];
  selectedFolderId: string | null;
  onClose: () => void;
  onImport: (items: ImportItem[], folderId: string | null) => Promise<void>;
  onRequestGitHubPreview: (url: string) => Promise<GitHubImportSession>;
  onImportGitHub: (session: GitHubImportSession) => Promise<void>;
  onRequestBackupPreview: (file: File) => Promise<WorkspaceRestorePlan>;
  onRestoreBackup: (plan: WorkspaceRestorePlan) => Promise<void>;
};

const sourceOptions: { value: ImportSource; label: string; icon: typeof ClipboardPaste }[] = [
  { value: "paste", label: "Paste text", icon: ClipboardPaste },
  { value: "files", label: "Choose files", icon: FileText },
  { value: "github", label: "GitHub repository", icon: Github },
  { value: "backup", label: "Restore backup", icon: ArchiveRestore }
];

export function ImportDialog({
  folders,
  selectedFolderId,
  onClose,
  onImport,
  onRequestGitHubPreview,
  onImportGitHub,
  onRequestBackupPreview,
  onRestoreBackup
}: ImportDialogProps) {
  const [source, setSource] = useState<ImportSource>("paste");
  const [pasteBody, setPasteBody] = useState("");
  const [targetFolderId, setTargetFolderId] = useState<string | null>(selectedFolderId);
  const [githubUrl, setGitHubUrl] = useState("");
  const [githubPreview, setGitHubPreview] = useState<GitHubImportSession | null>(null);
  const [backupPreview, setBackupPreview] = useState<WorkspaceRestorePlan | null>(null);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBackupDragging, setIsBackupDragging] = useState(false);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const githubRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const returnFocusElement = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );
  const busy = busyAction !== null;
  const returnFocus = useCallback(() => returnFocusElement.current?.focus(), []);

  function closeDialog() {
    if (!busy) {
      onClose();
    }
  }

  function selectSource(nextSource: ImportSource) {
    if (busy) {
      return;
    }

    setSource(nextSource);
    setMessage("");

    if (nextSource === "github") {
      window.setTimeout(() => githubRef.current?.focus(), 0);
    } else if (nextSource === "backup") {
      window.setTimeout(() => backupRef.current?.focus(), 0);
    } else if (nextSource === "paste") {
      window.setTimeout(() => pasteRef.current?.focus(), 0);
    }
  }

  function handleSourceTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentSource: ImportSource) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const currentIndex = sourceOptions.findIndex((option) => option.value === currentSource);
    let nextIndex = currentIndex;

    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = sourceOptions.length - 1;
    } else if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % sourceOptions.length;
    } else {
      nextIndex = (currentIndex - 1 + sourceOptions.length) % sourceOptions.length;
    }

    const nextSource = sourceOptions[nextIndex].value;
    selectSource(nextSource);
    window.setTimeout(
      () => document.getElementById("import-source-" + nextSource)?.focus(),
      0
    );
  }

  async function submitPaste() {
    if (busy) {
      return;
    }

    if (pasteBody.trim() === "") {
      setMessage("Paste Markdown before importing.");
      return;
    }

    setBusyAction("local");
    setMessage("");

    try {
      await onImport([{ title: titleFromBody(pasteBody), body: pasteBody }], targetFolderId);
      onClose();
    } catch {
      setMessage("We could not import the Markdown. Your existing pages were not changed.");
      setBusyAction(null);
    }
  }

  async function importFiles(files: FileList | File[]) {
    if (busy) {
      return;
    }

    setBusyAction("local");
    setMessage("");
    const items: ImportItem[] = [];

    for (const file of Array.from(files)) {
      if (!isMarkdownFile(file)) {
        setMessage("Choose Markdown files ending in .md or .markdown.");
        setBusyAction(null);
        return;
      }

      if (file.size > MAX_MARKDOWN_FILE_BYTES) {
        const warning = file.name + " is larger than 5 MB. Import it only if your browser has enough memory.";
        setMessage(warning);

        if (!window.confirm(warning)) {
          setBusyAction(null);
          return;
        }
      }

      try {
        const body = await file.text();
        items.push({ title: fileNameToTitle(file.name), body });
      } catch {
        setMessage(`We could not read ${file.name}. Choose the file again or try another file.`);
        setBusyAction(null);
        return;
      }
    }

    if (items.length === 0) {
      setBusyAction(null);
      return;
    }

    try {
      await onImport(items, targetFolderId);
      onClose();
    } catch {
      setMessage("We could not import the Markdown. Your existing pages were not changed.");
      setBusyAction(null);
    }
  }

  async function previewGitHubRepository() {
    if (busy) {
      return;
    }

    setBusyAction("preview");
    setMessage("");
    setGitHubPreview(null);

    try {
      const preview = await onRequestGitHubPreview(githubUrl);
      setGitHubPreview(preview);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mdez could not preview this repository.");
    } finally {
      setBusyAction(null);
    }
  }

  async function importGitHubRepository() {
    if (!githubPreview || busy) {
      return;
    }

    setBusyAction("github");
    setMessage("");

    try {
      await onImportGitHub(githubPreview);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mdez could not import this repository.");
      setBusyAction(null);
    }
  }

  async function previewBackup(file: File) {
    if (busy) return;
    setBusyAction("backup-preview");
    setMessage("");
    setBackupPreview(null);
    try {
      setBackupPreview(await onRequestBackupPreview(file));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mdez could not preview this backup. Your existing library was unchanged.");
    } finally {
      setBusyAction(null);
    }
  }

  async function restoreBackup() {
    if (!backupPreview || busy) return;
    setBusyAction("backup-restore");
    setMessage("");
    try {
      await onRestoreBackup(backupPreview);
      setBackupPreview(null);
      onClose();
    } catch (error) {
      if (error instanceof WorkspaceBackupError && error.code === "stale_preview") setBackupPreview(null);
      setMessage(error instanceof Error ? error.message : "Mdez could not restore this backup. Your existing library was unchanged.");
      setBusyAction(null);
    }
  }

  return (
    <ImportDialogBusyProvider busy={busy}>
      <ImportDialogShell
        labelledBy="import-title"
        initialFocusRef={pasteRef}
        returnFocus={returnFocus}
        onClose={closeDialog}
      >
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-md border border-border bg-panel p-1 sm:grid-cols-4" role="tablist" aria-label="Import source">
          {sourceOptions.map((option) => {
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                id={"import-source-" + option.value}
                type="button"
                role="tab"
                aria-selected={source === option.value}
                aria-controls={"import-panel-" + option.value}
                disabled={busy}
                tabIndex={source === option.value ? 0 : -1}
                onKeyDown={(event) => handleSourceTabKeyDown(event, option.value)}
                onClick={() => selectSource(option.value)}
                className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded px-2 py-2 text-xs font-extrabold text-muted transition hover:bg-surface hover:text-ink aria-selected:bg-surface aria-selected:text-accent aria-selected:shadow-soft disabled:cursor-not-allowed disabled:opacity-55 sm:text-sm"
              >
                <Icon aria-hidden="true" className="hidden h-4 w-4 shrink-0 sm:block" />
                <span className="text-center leading-tight sm:truncate">{option.label}</span>
              </button>
            );
          })}
        </div>

        {source !== "github" && source !== "backup" ? (
          <label className="mt-5 grid gap-2 text-sm font-bold text-ink" htmlFor="import-target-folder">
            Add pages to
            <select
              id="import-target-folder"
              value={targetFolderId ?? ""}
              onChange={(event) => setTargetFolderId(event.currentTarget.value === "" ? null : event.currentTarget.value)}
              disabled={busy}
              className="workspace-input px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">No book</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div hidden={source !== "paste"}>
          <PasteImportPanel
            ref={pasteRef}
            body={pasteBody}
            message={source === "paste" ? message : ""}
            busy={busy}
            onBodyChange={setPasteBody}
            onSubmit={() => void submitPaste()}
          />
        </div>

        <div hidden={source !== "files"}>
          <FileImportPanel
            dragging={isDragging}
            message={source === "files" ? message : ""}
            busy={busy}
            onFiles={(files) => void importFiles(files)}
            onDraggingChange={setIsDragging}
          />
        </div>

        <div hidden={source !== "github"}>
          <GitHubImportPanel
            ref={githubRef}
            url={githubUrl}
            preview={githubPreview}
            message={source === "github" ? message : ""}
            busyAction={busyAction === "preview" || busyAction === "github" ? busyAction : null}
            onUrlChange={(url) => {
              setGitHubUrl(url);
              setGitHubPreview(null);
              setMessage("");
            }}
            onPreview={() => void previewGitHubRepository()}
            onImport={() => void importGitHubRepository()}
          />
        </div>

        <div hidden={source !== "backup"}>
          <BackupImportPanel
            ref={backupRef}
            preview={backupPreview}
            message={source === "backup" ? message : ""}
            busyAction={busyAction}
            dragging={isBackupDragging}
            onFile={(file) => void previewBackup(file)}
            onDraggingChange={setIsBackupDragging}
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closeDialog}
            disabled={busy}
            className="secondary-button px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close import
          </button>

          {source === "paste" ? (
            <button
              type="button"
              onClick={() => void submitPaste()}
              disabled={busy}
              className="primary-button px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "local" ? "Importing Markdown..." : "Import pasted text"}
            </button>
          ) : null}

          {source === "github" ? (
            <button
              type="button"
              onClick={() => void (githubPreview ? importGitHubRepository() : previewGitHubRepository())}
              disabled={busy || (!githubPreview && githubUrl.trim() === "")}
              className="primary-button px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {githubPreview
                ? busyAction === "github" ? "Importing repository..." : "Import repository"
                : busyAction === "preview" ? "Checking repository..." : "Preview repository"}
            </button>
          ) : null}

          {source === "backup" ? (
            <button
              type="button"
              onClick={() => void restoreBackup()}
              disabled={busy || !backupPreview}
              className="primary-button px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "backup-preview" ? "Checking backup..." : busyAction === "backup-restore" ? "Restoring backup..." : "Restore backup"}
            </button>
          ) : null}
        </div>
      </ImportDialogShell>
    </ImportDialogBusyProvider>
  );
}
