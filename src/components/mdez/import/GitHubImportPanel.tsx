"use client";

import { forwardRef } from "react";

import type { GitHubImportSession } from "@/types/github";

export type GitHubImportPanelProps = {
  url: string;
  preview: GitHubImportSession | null;
  message: string;
  busyAction: "preview" | "github" | null;
  onUrlChange: (url: string) => void;
  onPreview: () => void;
  onImport: () => void;
};

export const GitHubImportPanel = forwardRef<HTMLInputElement, GitHubImportPanelProps>(
  function GitHubImportPanel(
    { url, preview, message, busyAction, onUrlChange, onPreview, onImport },
    ref
  ) {
    const busy = busyAction !== null;

    return (
      <form
        id="import-panel-github"
        role="tabpanel"
        aria-labelledby="import-source-github"
        className="mt-5 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (preview) {
            onImport();
          } else {
            onPreview();
          }
        }}
      >
        <div>
          <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="github-repository-url">
            Public repository URL
            <input
              ref={ref}
              id="github-repository-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(event) => onUrlChange(event.currentTarget.value)}
              disabled={busy}
              className="workspace-input px-4 py-3 text-sm placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="https://github.com/owner/repository"
            />
          </label>
          <p className="mt-2 text-sm leading-6 text-muted">
            Public repositories only. Mdez imports the default branch.
          </p>
          <details className="mt-2 text-sm text-muted">
            <summary className="cursor-pointer font-bold text-accent-read">Import details and limits</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
              <li>Markdown only; attachments and hidden configuration are ignored.</li>
              <li>Up to 1,000 files, 5 MB each, and 50 MB extracted.</li>
              <li>Archives are limited to 25 MB and 15 seconds.</li>
            </ul>
          </details>
        </div>

        {preview ? (
          <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="github-preview-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="github-preview-title" className="font-display text-xl font-black text-ink">
                  {preview.repository.repository}
                </h3>
                <p className="mt-1 text-sm font-semibold text-muted">
                  {preview.repository.owner}/{preview.repository.repository}
                </p>
              </div>
              <span className="rounded border border-border bg-panel px-2 py-1 font-mono text-xs font-bold text-accent-read">
                {preview.branch}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
              <span className="rounded bg-panel px-3 py-2 text-ink">
                {preview.markdownCount} Markdown {preview.markdownCount === 1 ? "file" : "files"}
              </span>
              <span className="rounded bg-panel px-3 py-2 text-muted">
                {preview.ignoredCount} ignored {preview.ignoredCount === 1 ? "file" : "files"}
              </span>
            </div>
            <ul className="mt-4 max-h-36 overflow-y-auto border-t border-border pt-3 text-sm" aria-label="Repository book structure">
              {preview.folders.map((folder) => (
                <li key={folder.path} className="py-1 font-bold text-ink">{folder.path}</li>
              ))}
              {preview.documents.map((document) => (
                <li key={document.path} className="py-1 pl-3 text-muted">{document.path}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {message ? (
          <p className="rounded border border-accent-files/40 bg-panel px-4 py-3 text-sm font-bold text-ink">
            {message}
          </p>
        ) : null}
      </form>
    );
  }
);
