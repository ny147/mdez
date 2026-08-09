"use client";

import React, { useMemo, useState } from "react";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { buildLocalGroupCreation } from "@/lib/key-group-snapshot";
import { generateGroupKey, validateLocalGroupCreation } from "@/lib/key-group";
import { createKeyGroup } from "@/lib/key-group-client";
import { cacheGroupSnapshot, rememberGroup } from "@/lib/key-group-repository";
import type { Document, Folder } from "@/types/content";

type Props = { open: boolean; folders: Folder[]; documents: Document[]; onClose: () => void; onCreated: (groupId: string) => void; generateKey?: () => string };

export function CreateGroupDialog({ open, folders, documents, onClose, onCreated, generateKey: makeKey = generateGroupKey }: Props) {
  const [name, setName] = useState(""); const [createdKey, setCreatedKey] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const bytes = useMemo(() => documents.reduce((sum, document) => sum + new TextEncoder().encode(document.body).byteLength, 0), [documents]);
  if (!open) return null;
  async function create() {
    setBusy(true); setError("");
    try {
      const input = validateLocalGroupCreation(buildLocalGroupCreation(name, makeKey(), folders, documents));
      const snapshot = await createKeyGroup(input); const now = new Date().toISOString();
      await rememberGroup({ groupId: snapshot.group.id, name: snapshot.group.name, key: input.key, joinedAt: now, lastOpenedAt: now });
      await cacheGroupSnapshot(snapshot); setCreatedKey(input.key); onCreated(snapshot.group.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create group"); }
    finally { setBusy(false); }
  }
  function download() { const url = URL.createObjectURL(new Blob([createdKey + "\n"], { type: "text/plain" })); const link = document.createElement("a"); link.href = url; link.download = `${name.trim() || "mdez-group"}-key.txt`; link.click(); URL.revokeObjectURL(url); }
  return <ModalDialog title="Create Key Group" titleId="create-key-group-title" closeLabel="Close group creation" onClose={onClose}>
    <div className="mt-5 space-y-4">
      <label className="block text-sm font-bold">Group name<input data-autofocus aria-label="Group name" value={name} onChange={(event) => setName(event.target.value)} disabled={Boolean(createdKey)} className="mt-2 w-full rounded border border-border bg-surface px-3 py-2" /></label>
      <p className="text-sm text-muted">{folders.length} books, {documents.length} pages, {bytes.toLocaleString()} UTF-8 bytes</p>
      <div className="space-y-2 rounded border border-border bg-panel p-3 text-sm leading-6"><p>This copies Local Library once; the two libraries will not stay in sync.</p><p>Anyone with this key has full management access.</p><p>A lost key cannot be recovered.</p></div>
      {error ? <p role="alert" className="text-sm font-bold text-accent-files">{error}</p> : null}
      {createdKey ? <div className="space-y-3"><label className="block text-sm font-bold">Group key<input aria-label="Group key" readOnly value={createdKey} className="mt-2 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm" /></label><div className="flex gap-2"><button type="button" onClick={() => navigator.clipboard.writeText(createdKey)} className="rounded bg-accent px-4 py-2 font-bold text-white">Copy key</button><button type="button" onClick={download} className="rounded border border-border bg-surface px-4 py-2 font-bold">Download .txt</button></div></div> : <button type="button" disabled={busy || !name.trim()} onClick={() => void create()} className="rounded bg-accent px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Creating group..." : "Create and copy Local Library"}</button>}
    </div>
  </ModalDialog>;
}
