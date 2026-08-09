import { db, type StoredSharedLink } from "@/lib/db";

export function rememberSharedLink(link: StoredSharedLink): Promise<string> {
  return db.sharedLinks.put(link);
}

export function listSharedLinks(): Promise<StoredSharedLink[]> {
  return db.sharedLinks.orderBy("createdAt").reverse().toArray();
}

export function forgetSharedLink(publicId: string): Promise<void> {
  return db.sharedLinks.delete(publicId);
}
