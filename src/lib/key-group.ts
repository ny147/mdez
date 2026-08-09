import { GROUP_LIMITS, type LocalGroupCreation, type LocalGroupImport } from "@/types/key-group";

export { buildLocalGroupCreation } from "@/lib/key-group-snapshot";

const GROUP_KEY_PATTERN = /^mdez-group-[A-Za-z0-9_-]{22}$/;
const encoder = new TextEncoder();

export function generateGroupKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `mdez-group-${encoded}`;
}

export function isValidGroupKey(value: string): boolean {
  return GROUP_KEY_PATTERN.test(value);
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function text(value: unknown, message: string, maximum: number): string {
  if (typeof value !== "string") throw new Error(message);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error(message);
  return normalized;
}

function nullableId(value: unknown, message: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value) throw new Error(message);
  return value;
}

function order(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("Order must be a non-negative integer");
  }
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("Creation and update timestamps must be valid dates");
  }
  return value;
}

function assertAcyclic(folders: LocalGroupImport["folders"]): void {
  const parents = new Map(folders.map((folder) => [folder.clientId, folder.parentClientId]));
  for (const folder of folders) {
    const visited = new Set<string>();
    let current: string | null = folder.clientId;
    while (current) {
      if (visited.has(current)) throw new Error("Folder hierarchy must not contain a cycle");
      visited.add(current);
      current = parents.get(current) ?? null;
    }
  }
}

export function validateLocalGroupCreation(value: unknown): LocalGroupCreation {
  const root = record(value, "A group creation payload is required");
  if (typeof root.key !== "string" || !isValidGroupKey(root.key)) throw new Error("Group key is invalid");
  const source = record(root.import, "A Local Library import is required");
  const name = text(source.name, "Group name must contain 1 to 100 characters", 100);
  if (!Array.isArray(source.folders) || !Array.isArray(source.documents)) {
    throw new Error("Folders and documents must be arrays");
  }

  const folderIds = new Set<string>();
  const folders = source.folders.map((candidate) => {
    const folder = record(candidate, "Each folder must be an object");
    const clientId = text(folder.clientId, "Folder IDs must be non-empty", 300);
    if (folderIds.has(clientId)) throw new Error("Folder IDs must be unique");
    folderIds.add(clientId);
    return {
      clientId,
      parentClientId: nullableId(folder.parentClientId, "Folder parent IDs must be strings or null"),
      name: text(folder.name, "Folder names must contain 1 to 300 characters", 300),
      order: order(folder.order),
      createdAt: timestamp(folder.createdAt),
      updatedAt: timestamp(folder.updatedAt),
    };
  });

  for (const folder of folders) {
    if (folder.parentClientId !== null && !folderIds.has(folder.parentClientId)) {
      throw new Error("Every folder parent must exist in the import");
    }
  }
  assertAcyclic(folders);

  if (source.documents.length > GROUP_LIMITS.pages) {
    throw new Error("A group can contain at most 1,000 pages");
  }
  const documentIds = new Set<string>();
  let totalBytes = 0;
  const documents = source.documents.map((candidate) => {
    const document = record(candidate, "Each document must be an object");
    const clientId = text(document.clientId, "Document IDs must be non-empty", 300);
    if (documentIds.has(clientId)) throw new Error("Document IDs must be unique");
    documentIds.add(clientId);
    const folderClientId = nullableId(document.folderClientId, "Document folder IDs must be strings or null");
    if (folderClientId !== null && !folderIds.has(folderClientId)) {
      throw new Error("Every document folder must exist in the import");
    }
    if (typeof document.body !== "string") throw new Error("Document Markdown must be text");
    const bodyBytes = encoder.encode(document.body).byteLength;
    if (bodyBytes > GROUP_LIMITS.pageBytes) throw new Error("Each group page must be 5 MiB or less");
    totalBytes += bodyBytes;
    return {
      clientId,
      folderClientId,
      title: text(document.title, "Document titles must contain 1 to 300 characters", 300),
      body: document.body,
      order: order(document.order),
      createdAt: timestamp(document.createdAt),
      updatedAt: timestamp(document.updatedAt),
    };
  });
  if (totalBytes > GROUP_LIMITS.totalBytes) throw new Error("Group Markdown must total 50 MiB or less");

  return { key: root.key, import: { name, folders, documents } };
}
