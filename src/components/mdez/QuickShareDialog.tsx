"use client";

import { Check, Copy, Link2 } from "lucide-react";
import React, { type FormEvent, useEffect, useState } from "react";

import { ModalDialog } from "@/components/ui/ModalDialog";
import { createQuickShare } from "@/lib/quick-share-client";
import { rememberSharedLink } from "@/lib/shared-link-repository";
import type { Document as MdezDocument } from "@/types/content";
import type {
  CreateQuickShareResult,
  QuickShareExpiry
} from "@/types/quick-share";

type QuickShareDialogProps = {
  document: Pick<MdezDocument, "title" | "body">;
  open: boolean;
  onClose: () => void;
};

type QuickShareDialogState =
  | { status: "idle"; expiry: QuickShareExpiry }
  | { status: "creating"; expiry: QuickShareExpiry }
  | { status: "created"; result: CreateQuickShareResult }
  | { status: "error"; expiry: QuickShareExpiry; message: string };

const expiryOptions: { value: QuickShareExpiry; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "never", label: "Never" }
];

function expiryLabel(expiresAt: string | null) {
  if (!expiresAt) return "Never expires";
  return `Expires ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(expiresAt))}`;
}

export function QuickShareDialog({ document, open, onClose }: QuickShareDialogProps) {
  const [state, setState] = useState<QuickShareDialogState>({ status: "idle", expiry: "7d" });
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    if (open) {
      setState({ status: "idle", expiry: "7d" });
      setCopyStatus("");
    }
  }, [open]);

  if (!open) return null;

  const expiry = state.status === "created" ? null : state.expiry;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state.status === "creating" || state.status === "created") return;
    const selectedExpiry = state.expiry;
    setState({ status: "creating", expiry: selectedExpiry });
    try {
      const result = await createQuickShare({
        title: document.title,
        markdown: document.body,
        expiry: selectedExpiry
      });
      await rememberSharedLink({
        publicId: result.publicId,
        url: result.url,
        title: result.title,
        managementToken: result.managementToken,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt
      });
      setState({ status: "created", result });
    } catch (error) {
      setState({
        status: "error",
        expiry: selectedExpiry,
        message: error instanceof Error ? error.message : "Could not create shared page"
      });
    }
  }

  async function copyPublicUrl() {
    if (state.status !== "created") return;
    try {
      await navigator.clipboard.writeText(state.result.url);
      setCopyStatus("Copied public link");
    } catch {
      setCopyStatus("Copy failed. Select and copy the URL instead.");
    }
  }

  return (
    <ModalDialog
      title="Create view-only link"
      titleId="quick-share-title"
      label="Quick Share"
      closeLabel="Close Quick Share dialog"
      onClose={onClose}
    >
      {state.status === "created" ? (
        <div className="mt-5 grid gap-5">
          <div className="flex items-center gap-3 text-sm font-bold text-accent-read">
            <Check aria-hidden="true" className="h-5 w-5" />
            Snapshot link created
          </div>
          <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="quick-share-url">
            Public URL
            <input
              id="quick-share-url"
              readOnly
              value={state.result.url}
              className="workspace-input min-h-11 w-full px-3 py-2 font-mono text-sm"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-muted">{expiryLabel(state.result.expiresAt)}</p>
            <button
              type="button"
              onClick={() => void copyPublicUrl()}
              className="secondary-button min-h-11 px-4 py-2 text-sm font-extrabold"
              aria-label="Copy public link"
            >
              <Copy aria-hidden="true" className="h-4 w-4" /> Copy public link
            </button>
          </div>
          {copyStatus ? <p role="status" className="text-sm font-semibold text-muted">{copyStatus}</p> : null}
          <div className="grid gap-2 border-t border-border pt-4 text-sm font-semibold leading-6 text-muted">
            <p>Changes to this page will not update this link.</p>
            <p>Clearing browser data removes your ability to delete this link early.</p>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="primary-button min-h-11 px-5 py-2">
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-5">
          <div className="flex gap-3 rounded border border-border bg-panel p-4 text-sm font-semibold leading-6 text-ink">
            <Link2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <p>Anyone with this link can read this snapshot.</p>
          </div>
          <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="quick-share-expiry">
            Link expiration
            <select
              id="quick-share-expiry"
              data-autofocus
              value={expiry ?? "7d"}
              disabled={state.status === "creating"}
              onChange={(event) => setState({
                status: "idle",
                expiry: event.currentTarget.value as QuickShareExpiry
              })}
              className="workspace-input min-h-11 px-3 py-2"
            >
              {expiryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {state.status === "error" ? (
            <p role="alert" className="rounded border border-border bg-panel p-3 text-sm font-bold text-ink">
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button min-h-11 px-5 py-2 text-sm font-extrabold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={state.status === "creating"}
              className="primary-button min-h-11 px-5 py-2 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {state.status === "creating" ? "Creating link..." : "Create view-only link"}
            </button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}
