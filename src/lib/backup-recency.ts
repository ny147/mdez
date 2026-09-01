export type BackupRecency = { preparedAt: string };
type WorkspaceIdentity = { kind: "local" | "group"; id: string | null };

export function backupRecencyKey(workspace: WorkspaceIdentity) {
  return workspace.kind === "local"
    ? "mdez:backup-recency:v1:local"
    : `mdez:backup-recency:v1:group:${workspace.id ?? "unknown"}`;
}

export function readBackupRecency(workspace: WorkspaceIdentity): BackupRecency | null {
  try {
    const raw = localStorage.getItem(backupRecencyKey(workspace));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !("preparedAt" in parsed) || typeof parsed.preparedAt !== "string") return null;
    const timestamp = Date.parse(parsed.preparedAt);
    if (Number.isNaN(timestamp) || timestamp > Date.now()) return null;
    return { preparedAt: new Date(timestamp).toISOString() };
  } catch {
    return null;
  }
}

export function writeBackupRecency(workspace: WorkspaceIdentity, preparedAt: string) {
  try {
    const timestamp = Date.parse(preparedAt);
    if (Number.isNaN(timestamp) || timestamp > Date.now()) return;
    localStorage.setItem(backupRecencyKey(workspace), JSON.stringify({ preparedAt: new Date(timestamp).toISOString() }));
  } catch {
    // Backup completion remains valid even when local preference storage is unavailable.
  }
}
