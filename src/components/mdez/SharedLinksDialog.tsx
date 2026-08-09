"use client";

import { Copy, ExternalLink, Link2, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { ModalDialog } from "@/components/ui/ModalDialog";
import { deleteQuickShare } from "@/lib/quick-share-client";
import type { StoredSharedLink } from "@/lib/db";
import { forgetSharedLink, listSharedLinks } from "@/lib/shared-link-repository";

type SharedLinksDialogProps = { open: boolean; onClose: () => void };
type PendingDeletion = { publicId: string; title: string } | null;

function expirationLabel(expiresAt: string | null) {
  if (!expiresAt) return "Never expires";
  const expiry = new Date(expiresAt);
  if (expiry.getTime() <= Date.now()) return "Expired";
  return `Expires ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(expiry)}`;
}

export function SharedLinksDialog({ open, onClose }: SharedLinksDialogProps) {
  const [links, setLinks] = useState<StoredSharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setMessage("");
    setPendingDeletion(null);
    void listSharedLinks()
      .then((stored) => {
        if (active) setLinks(stored);
      })
      .catch(() => {
        if (active) setMessage("Could not load shared links from this browser.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  async function copyLink(link: StoredSharedLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      setMessage(`Copied ${link.title} public link.`);
    } catch {
      setMessage("Copy failed. Open the link and copy it from the address bar.");
    }
  }

  async function confirmDelete() {
    if (!pendingDeletion || deleting) return;
    const link = links.find((item) => item.publicId === pendingDeletion.publicId);
    if (!link) return;
    setDeleting(true);
    setMessage("");
    try {
      await deleteQuickShare(link.publicId, link.managementToken);
      await forgetSharedLink(link.publicId);
      setLinks((current) => current.filter((item) => item.publicId !== link.publicId));
      setPendingDeletion(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete shared page");
      setPendingDeletion(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ModalDialog
      title="Shared links"
      titleId="shared-links-title"
      label="Quick Share"
      closeLabel="Close Shared links dialog"
      onClose={onClose}
    >
      <div className="mt-5">
        <p className="max-w-prose text-sm font-semibold leading-6 text-muted">
          Only links created in this browser can be deleted early.
        </p>
        {message ? <p role="alert" className="mt-4 rounded border border-border bg-panel p-3 text-sm font-bold text-ink">{message}</p> : null}
        {pendingDeletion ? (
          <div className="mt-5 rounded border border-border bg-panel p-4">
            <h3 className="font-display text-lg font-black text-ink">Delete {pendingDeletion.title}?</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              The public URL will stop working immediately.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDeletion(null)}
                className="secondary-button min-h-11 px-4 py-2 text-sm font-extrabold"
              >
                Keep link
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="primary-button min-h-11 px-4 py-2 disabled:opacity-55"
              >
                {deleting ? "Deleting link..." : "Delete link"}
              </button>
            </div>
          </div>
        ) : loading ? (
          <p role="status" className="mt-5 text-sm font-semibold text-muted">Loading shared links...</p>
        ) : links.length === 0 ? (
          <div className="mt-5 flex items-start gap-3 border-t border-border pt-5">
            <Link2 aria-hidden="true" className="mt-0.5 h-5 w-5 text-accent" />
            <div>
              <h3 className="font-display text-lg font-black text-ink">No shared links yet</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-muted">
                Open a page and use Quick Share to create a view-only snapshot.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-border border-y border-border" aria-label="Creator shared links">
            {links.map((link) => (
              <li key={link.publicId} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-black text-ink">{link.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-muted">{expirationLabel(link.expiresAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary-button min-h-11 px-3 py-2 text-sm font-extrabold"
                  >
                    <ExternalLink aria-hidden="true" className="h-4 w-4" /> Open
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyLink(link)}
                    aria-label={`Copy ${link.title} shared link`}
                    className="secondary-button min-h-11 px-3 py-2 text-sm font-extrabold"
                  >
                    <Copy aria-hidden="true" className="h-4 w-4" /> Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeletion({ publicId: link.publicId, title: link.title })}
                    aria-label={`Delete ${link.title} shared link`}
                    className="secondary-button min-h-11 px-3 py-2 text-sm font-extrabold"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!pendingDeletion ? (
          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <button type="button" onClick={onClose} className="secondary-button min-h-11 px-5 py-2 text-sm font-extrabold">
              Close
            </button>
          </div>
        ) : null}
      </div>
    </ModalDialog>
  );
}
