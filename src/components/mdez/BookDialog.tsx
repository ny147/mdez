"use client";

import React, { useState, type FormEvent } from "react";

import { ModalDialog } from "@/components/ui/ModalDialog";
import { MAX_BOOK_NAME_LENGTH, normalizeBookName, validateBookName } from "@/lib/book-names";
import type { Folder } from "@/types/content";

export type BookDialogIntent =
  | { mode: "create"; parentId: string | null; parentName: string | null }
  | { mode: "rename"; folderId: string; parentId: string | null; currentName: string };

type BookDialogProps = {
  intent: BookDialogIntent;
  folders: Folder[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<unknown> | unknown;
};

export function BookDialog({ intent, folders, busy, onClose, onSubmit }: BookDialogProps) {
  const [name, setName] = useState(intent.mode === "rename" ? intent.currentName : "");
  const [message, setMessage] = useState<string | null>(null);
  const title = intent.mode === "create" ? "Create a book" : "Rename book";
  const submitLabel = intent.mode === "create" ? "Create book" : "Save name";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationMessage = validateBookName(
      name,
      folders,
      intent.parentId,
      intent.mode === "rename" ? intent.folderId : undefined
    );
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    setMessage(null);
    try {
      await onSubmit(normalizeBookName(name));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mdez could not save this book. Try again.");
    }
  }

  return (
    <ModalDialog title={title} titleId="book-dialog-title" closeLabel="Close book dialog" onClose={onClose} dismissDisabled={busy}>
      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5 pt-5">
        <div>
          <label htmlFor="book-name" className="field-label">Book name</label>
          <input
            id="book-name"
            data-autofocus
            value={name}
            maxLength={MAX_BOOK_NAME_LENGTH + 1}
            disabled={busy}
            aria-invalid={Boolean(message)}
            aria-describedby={message ? "book-name-error" : "book-name-help"}
            onChange={(event) => { setName(event.target.value); setMessage(null); }}
            className="mt-2 w-full rounded border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {message ? <p id="book-name-error" role="alert" className="mt-2 text-sm font-semibold text-danger">{message}</p> : <p id="book-name-help" className="mt-2 text-sm text-muted">Use a clear name that is unique in this location.</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="secondary-button px-4 py-2">Cancel</button>
          <button type="submit" disabled={busy} className="primary-button px-4 py-2">{busy ? "Saving…" : submitLabel}</button>
        </div>
      </form>
    </ModalDialog>
  );
}
