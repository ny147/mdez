"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ClipboardPaste, FileText, Github, X } from "lucide-react";

import type { Folder } from "@/types/content";
import type { GitHubImportSession } from "@/types/github";
import { fileNameToTitle, isMarkdownFile, MAX_MARKDOWN_FILE_BYTES, titleFromBody } from "@/lib/markdown";
import { IconButton } from "@/components/ui/IconButton";

type ImportItem = { title: string; body: string };
type ImportSource = "paste" | "files" | "github";

type ImportDialogProps = {
  folders: Folder[];
  selectedFolderId: string | null;
  onClose: () => void;
  onImport: (items: ImportItem[], folderId: string | null) => Promise<void>;
  onRequestGitHubPreview: (url: string) => Promise<GitHubImportSession>;
  onImportGitHub: (session: GitHubImportSession) => Promise<void>;
};

const sourceOptions: { value: ImportSource; label: string; icon: typeof ClipboardPaste }[] = [
  { value: "paste", label: "Paste", icon: ClipboardPaste },
  { value: "files", label: "Markdown files", icon: FileText },
  { value: "github", label: "Public GitHub", icon: Github }
];

export function ImportDialog({
  folders,
  selectedFolderId,
  onClose,
  onImport,
  onRequestGitHubPreview,
  onImportGitHub
}: ImportDialogProps) {
  const [source, setSource] = useState<ImportSource>("paste");
  const [pasteBody, setPasteBody] = useState("");
  const [targetFolderId, setTargetFolderId] = useState<string | null>(selectedFolderId);
  const [githubUrl, setGitHubUrl] = useState("");
  const [githubPreview, setGitHubPreview] = useState<GitHubImportSession | null>(null);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<"local" | "preview" | "github" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const githubRef = useRef<HTMLInputElement>(null);
  const busy = busyAction !== null;

  useEffect(() => {
    const previousElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    pasteRef.current?.focus();

    return () => {
      previousElement?.focus();
    };
  }, []);

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
      () => dialogRef.current?.querySelector<HTMLButtonElement>("#import-source-" + nextSource)?.focus(),
      0
    );
  }


  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      closeDialog();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter((element) => !element.hasAttribute("aria-hidden") && !element.closest("[hidden]"));

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  async function submitPaste() {
    if (busy) {
      return;
    }

    if (pasteBody.trim() === "") {
      setMessage("Paste markdown content before importing.");
      return;
    }

    setBusyAction("local");
    setMessage("");

    try {
      await onImport([{ title: titleFromBody(pasteBody), body: pasteBody }], targetFolderId);
      onClose();
    } catch {
      setMessage("Mdez could not import markdown.");
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
        setMessage("Choose a .md file.");
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
        setMessage("Mdez could not read " + file.name + ".");
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
      setMessage("Mdez could not import markdown.");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onKeyDown={handleDialogKeyDown}
        className="library-panel max-h-full w-full max-w-2xl overflow-y-auto rounded-md p-4 text-ink sm:p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="field-label">Import markdown</p>
            <h2 id="import-title" className="mt-1 font-display text-2xl font-black text-ink sm:text-3xl">
              Bring notes into Mdez
            </h2>
          </div>
          <IconButton label="Close import dialog" onClick={closeDialog} disabled={busy}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-md border border-border bg-panel p-1" role="tablist" aria-label="Import source">
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

        {source !== "github" ? (
          <label className="mt-5 grid gap-2 text-sm font-bold text-ink" htmlFor="import-target-folder">
            Target book
            <select
              id="import-target-folder"
              value={targetFolderId ?? ""}
              onChange={(event) => setTargetFolderId(event.currentTarget.value === "" ? null : event.currentTarget.value)}
              disabled={busy}
              className="workspace-input px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Shelf root</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div
          id="import-panel-paste"
          role="tabpanel"
          aria-labelledby="import-source-paste"
          hidden={source !== "paste"}
          className="mt-5"
        >
          <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="import-paste">
            Paste markdown
            <textarea
              ref={pasteRef}
              id="import-paste"
              value={pasteBody}
              onChange={(event) => setPasteBody(event.currentTarget.value)}
              disabled={busy}
              className="workspace-input min-h-48 resize-y p-4 font-mono text-sm leading-6 placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="# Meeting notes"
            />
          </label>
        </div>

        <div
          id="import-panel-files"
          role="tabpanel"
          aria-labelledby="import-source-files"
          hidden={source !== "files"}
          className="mt-5"
        >
          <label
            data-drop-state={isDragging ? "active" : "idle"}
            className={"flex cursor-pointer flex-col items-center justify-center gap-3 rounded border border-dashed border-border bg-panel px-4 py-8 text-center transition hover:border-accent hover:bg-surface-2 " + (isDragging ? "border-accent bg-surface-2" : "")}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void importFiles(event.dataTransfer.files);
            }}
          >
            <span className="text-sm font-black text-accent-read">Drop Markdown files here</span>
            <span className="primary-button px-4 py-2">
              Choose .md files
            </span>
            <input
              className="sr-only"
              type="file"
              aria-label="Choose markdown files"
              accept=".md,.markdown,text/markdown"
              multiple
              disabled={busy}
              onChange={(event) => {
                if (event.currentTarget.files) {
                  void importFiles(event.currentTarget.files);
                }

                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        <div
          id="import-panel-github"
          role="tabpanel"
          aria-labelledby="import-source-github"
          hidden={source !== "github"}
          className={source === "github" ? "mt-5 grid gap-4" : "hidden"}
        >
          <div>
            <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="github-repository-url">
              Public repository URL
              <input
                ref={githubRef}
                id="github-repository-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={githubUrl}
                onChange={(event) => {
                  setGitHubUrl(event.currentTarget.value);
                  setGitHubPreview(null);
                  setMessage("");
                }}
                disabled={busy}
                className="workspace-input px-4 py-3 text-sm placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="https://github.com/owner/repository"
              />
            </label>
            <p className="mt-2 text-sm leading-6 text-muted">
              Public repositories only. Mdez imports the default branch.
            </p>
            <details className="mt-2 text-sm text-muted">
              <summary className="cursor-pointer font-bold text-accent-read">
                Import details and limits
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                <li>Markdown only; attachments and hidden configuration are ignored.</li>
                <li>Up to 1,000 files, 5 MB each, and 50 MB extracted.</li>
                <li>Archives are limited to 25 MB and 15 seconds.</li>
              </ul>
            </details>
          </div>

          {githubPreview ? (
            <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="github-preview-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="github-preview-title" className="font-display text-xl font-black text-ink">
                    {githubPreview.repository.repository}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    {githubPreview.repository.owner}/{githubPreview.repository.repository}
                  </p>
                </div>
                <span className="rounded border border-border bg-panel px-2 py-1 font-mono text-xs font-bold text-accent-read">
                  {githubPreview.branch}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
                <span className="rounded bg-panel px-3 py-2 text-ink">
                  {githubPreview.markdownCount} Markdown {githubPreview.markdownCount === 1 ? "file" : "files"}
                </span>
                <span className="rounded bg-panel px-3 py-2 text-muted">
                  {githubPreview.ignoredCount} ignored {githubPreview.ignoredCount === 1 ? "file" : "files"}
                </span>
              </div>
              <ul className="mt-4 max-h-36 overflow-y-auto border-t border-border pt-3 text-sm" aria-label="Repository book structure">
                {githubPreview.folders.map((folder) => (
                  <li key={folder.path} className="py-1 font-bold text-ink">{folder.path}</li>
                ))}
                {githubPreview.documents.map((document) => (
                  <li key={document.path} className="py-1 pl-3 text-muted">{document.path}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {message ? (
          <p className="mt-4 rounded border border-accent-files/40 bg-panel px-4 py-3 text-sm font-bold text-ink">
            {message}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closeDialog}
            disabled={busy}
            className="secondary-button px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          {source === "paste" ? (
            <button
              type="button"
              onClick={() => void submitPaste()}
              disabled={busy}
              className="primary-button px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "local" ? "Importing..." : "Import Paste"}
            </button>
          ) : null}

          {source === "github" ? (
            githubPreview ? (
              <button
                type="button"
                onClick={() => void importGitHubRepository()}
                disabled={busy}
                className="primary-button px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyAction === "github" ? "Importing repository..." : "Import repository"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void previewGitHubRepository()}
                disabled={busy || githubUrl.trim() === ""}
                className="primary-button px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyAction === "preview" ? "Checking repository..." : "Preview repository"}
              </button>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
