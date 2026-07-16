"use client";

import { forwardRef } from "react";

export type PasteImportPanelProps = {
  body: string;
  message: string;
  busy: boolean;
  onBodyChange: (body: string) => void;
  onSubmit: () => void;
};

export const PasteImportPanel = forwardRef<HTMLTextAreaElement, PasteImportPanelProps>(
  function PasteImportPanel({ body, message, busy, onBodyChange, onSubmit }, ref) {
    return (
      <form
        id="import-panel-paste"
        role="tabpanel"
        aria-labelledby="import-source-paste"
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="import-paste">
          Paste markdown
          <textarea
            ref={ref}
            id="import-paste"
            value={body}
            onChange={(event) => onBodyChange(event.currentTarget.value)}
            disabled={busy}
            className="workspace-input min-h-48 resize-y p-4 font-mono text-sm leading-6 placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="# Meeting notes"
          />
        </label>
        {message ? (
          <p className="mt-4 rounded border border-accent-files/40 bg-panel px-4 py-3 text-sm font-bold text-ink">
            {message}
          </p>
        ) : null}
      </form>
    );
  }
);
