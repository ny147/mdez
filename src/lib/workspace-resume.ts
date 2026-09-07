import { db, type MdezDatabase, type WorkspaceResume } from "@/lib/db";

const queues = new WeakMap<MdezDatabase, Map<string, Promise<void>>>();

export function getWorkspaceResume(
  workspaceId: string,
  database: MdezDatabase = db
): Promise<WorkspaceResume | undefined> {
  return database.workspaceResume.get(workspaceId);
}

export function recordWorkspaceOpened(
  workspaceId: string,
  documentId: string,
  database: MdezDatabase = db
): Promise<void> {
  let databaseQueues = queues.get(database);
  if (!databaseQueues) {
    databaseQueues = new Map();
    queues.set(database, databaseQueues);
  }

  const previous = databaseQueues.get(workspaceId) ?? Promise.resolve();
  const write = previous.catch(() => undefined).then(async () => {
    await database.workspaceResume.put({ workspaceId, documentId, openedAt: new Date().toISOString() });
  });
  databaseQueues.set(workspaceId, write);
  void write.finally(() => {
    if (databaseQueues?.get(workspaceId) === write) databaseQueues.delete(workspaceId);
  }).catch(() => undefined);
  return write;
}
