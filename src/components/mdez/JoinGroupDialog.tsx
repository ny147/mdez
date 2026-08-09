"use client";

import React, { useState } from "react";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { isValidGroupKey } from "@/lib/key-group";
import { joinKeyGroup } from "@/lib/key-group-client";
import { cacheGroupSnapshot, rememberGroup } from "@/lib/key-group-repository";

type Props = { open: boolean; onClose: () => void; onJoined: (groupId: string) => void };
export function JoinGroupDialog({ open, onClose, onJoined }: Props) {
  const [key, setKey] = useState(""); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (!open) return null;
  async function join() {
    const candidate = key.trim(); setError("");
    if (!isValidGroupKey(candidate)) { setError("Group key is invalid"); return; }
    setBusy(true);
    try { const snapshot = await joinKeyGroup(candidate); const now = new Date().toISOString(); await rememberGroup({ groupId: snapshot.group.id, name: snapshot.group.name, key: candidate, joinedAt: now, lastOpenedAt: now }); await cacheGroupSnapshot(snapshot); onJoined(snapshot.group.id); }
    catch { setError("Group key is invalid"); }
    finally { setBusy(false); }
  }
  return <ModalDialog title="Join Key Group" titleId="join-key-group-title" closeLabel="Close group joining" onClose={onClose}>
    <div className="mt-5 space-y-4"><label className="block text-sm font-bold">Group key<input data-autofocus aria-label="Group key" type={show ? "text" : "password"} value={key} onChange={(event) => setKey(event.target.value)} className="mt-2 w-full rounded border border-border bg-surface px-3 py-2 font-mono" /></label><button type="button" onClick={() => setShow((value) => !value)} className="text-sm font-bold text-accent">{show ? "Hide key" : "Show key"}</button>{error ? <p role="alert" className="text-sm font-bold text-accent-files">{error}</p> : null}<button type="button" disabled={busy} onClick={() => void join()} className="rounded bg-accent px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Joining group..." : "Join group"}</button></div>
  </ModalDialog>;
}
