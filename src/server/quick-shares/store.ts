export type QuickShareRecord = {
  publicId: string;
  managementTokenDigest: Buffer;
  title: string;
  markdown: string;
  sizeBytes: number;
  createdAt: Date;
  expiresAt: Date | null;
};

export interface QuickShareStore {
  insert(record: QuickShareRecord): Promise<QuickShareRecord>;
  findByPublicId(publicId: string): Promise<QuickShareRecord | null>;
  deleteByPublicIdAndDigest(
    publicId: string,
    digest: Buffer
  ): Promise<"deleted" | "not_found" | "forbidden">;
  purgeExpired(now: Date): Promise<number>;
}

export class QuickShareError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "EXPIRED" | "FORBIDDEN",
    message: string
  ) {
    super(message);
  }
}
