import { expiryDate, validateQuickShareInput } from "@/lib/quick-share";
import type { CreateQuickShareResult, QuickSharePayload } from "@/types/quick-share";
import { createOpaqueSecret, digestManagementToken } from "./secrets";
import { QuickShareError, type QuickShareStore } from "./store";

export async function createQuickShareService(
  input: unknown,
  deps: { store: QuickShareStore; now: () => Date; origin: string }
): Promise<CreateQuickShareResult> {
  const valid = validateQuickShareInput(input);
  const publicId = createOpaqueSecret();
  const managementToken = createOpaqueSecret();
  const createdAt = deps.now();
  const record = await deps.store.insert({
    publicId,
    managementTokenDigest: digestManagementToken(managementToken),
    title: valid.title,
    markdown: valid.markdown,
    sizeBytes: new TextEncoder().encode(valid.markdown).byteLength,
    createdAt,
    expiresAt: expiryDate(valid.expiry, createdAt)
  });
  return {
    publicId,
    managementToken,
    url: `${deps.origin}/share/${publicId}`,
    title: record.title,
    markdown: record.markdown,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null
  };
}

export async function readQuickShareService(
  publicId: string,
  deps: { store: QuickShareStore; now: () => Date }
): Promise<QuickSharePayload> {
  const row = await deps.store.findByPublicId(publicId);
  if (!row) throw new QuickShareError("NOT_FOUND", "Shared page not found");
  if (row.expiresAt && row.expiresAt <= deps.now()) {
    throw new QuickShareError("EXPIRED", "Shared page expired");
  }
  return {
    publicId: row.publicId,
    title: row.title,
    markdown: row.markdown,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null
  };
}

export async function deleteQuickShareService(
  publicId: string,
  token: string,
  deps: { store: QuickShareStore }
): Promise<void> {
  if (!token) throw new QuickShareError("FORBIDDEN", "Management token is invalid");
  const result = await deps.store.deleteByPublicIdAndDigest(
    publicId,
    digestManagementToken(token)
  );
  if (result === "not_found") throw new QuickShareError("NOT_FOUND", "Shared page not found");
  if (result === "forbidden") throw new QuickShareError("FORBIDDEN", "Management token is invalid");
}

export function purgeExpiredQuickShares(now: Date, store: QuickShareStore): Promise<number> {
  return store.purgeExpired(now);
}
