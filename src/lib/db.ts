import Dexie, { type EntityTable } from "dexie";
import type { Document, Folder } from "@/types/content";

export class MdezDatabase extends Dexie {
  folders!: EntityTable<Folder, "id">;
  documents!: EntityTable<Document, "id">;

  constructor() {
    super("mdez");

    this.version(1).stores({
      folders: "id, parentId, order, updatedAt",
      documents: "id, folderId, order, updatedAt"
    });
  }
}

export const db = new MdezDatabase();
