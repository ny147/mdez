import { db, type StoredSharedLink } from "@/lib/db";
import { isShareExpired } from "@/lib/share-expiration";

export function rememberSharedLink(link: StoredSharedLink): Promise<string> {
  return db.sharedLinks.put(link);
}

export async function listSharedLinks(): Promise<StoredSharedLink[]> {
  const links = await db.sharedLinks.orderBy("createdAt").reverse().toArray();
  const now = Date.now();
  return links.filter((link) => !isShareExpired(link.expiresAt, now));
}

export function forgetSharedLink(publicId: string): Promise<void> {
  return db.sharedLinks.delete(publicId);
}
