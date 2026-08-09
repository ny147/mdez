import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { Sql } from "postgres";

import type { QuickShareRecord, QuickShareStore } from "./store";

type QuickShareRow = {
  public_id: string;
  management_token_digest: Buffer;
  title: string;
  markdown: string;
  size_bytes: number;
  created_at: Date;
  expires_at: Date | null;
};

function toRecord(row: QuickShareRow): QuickShareRecord {
  return {
    publicId: row.public_id,
    managementTokenDigest: Buffer.from(row.management_token_digest),
    title: row.title,
    markdown: row.markdown,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

export class PostgresQuickShareStore implements QuickShareStore {
  constructor(private readonly sql: Sql) {}

  async insert(record: QuickShareRecord): Promise<QuickShareRecord> {
    const rows = await this.sql<QuickShareRow[]>`
      insert into public.quick_shares (
        public_id,
        management_token_digest,
        title,
        markdown,
        size_bytes,
        created_at,
        expires_at
      ) values (
        ${record.publicId},
        ${record.managementTokenDigest},
        ${record.title},
        ${record.markdown},
        ${record.sizeBytes},
        ${record.createdAt},
        ${record.expiresAt}
      )
      returning public_id, management_token_digest, title, markdown, size_bytes, created_at, expires_at
    `;
    return toRecord(rows[0]);
  }

  async findByPublicId(publicId: string): Promise<QuickShareRecord | null> {
    const rows = await this.sql<QuickShareRow[]>`
      select public_id, management_token_digest, title, markdown, size_bytes, created_at, expires_at
      from public.quick_shares
      where public_id = ${publicId}
      limit 1
    `;
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async deleteByPublicIdAndDigest(
    publicId: string,
    digest: Buffer
  ): Promise<"deleted" | "not_found" | "forbidden"> {
    const rows = await this.sql<{ management_token_digest: Buffer }[]>`
      select management_token_digest
      from public.quick_shares
      where public_id = ${publicId}
      limit 1
    `;
    if (!rows[0]) return "not_found";

    const storedDigest = Buffer.from(rows[0].management_token_digest);
    if (storedDigest.byteLength !== digest.byteLength || !timingSafeEqual(storedDigest, digest)) {
      return "forbidden";
    }

    const deleted = await this.sql`
      delete from public.quick_shares
      where public_id = ${publicId}
    `;
    return deleted.count > 0 ? "deleted" : "not_found";
  }

  async purgeExpired(now: Date): Promise<number> {
    const deleted = await this.sql`
      delete from public.quick_shares
      where expires_at is not null and expires_at <= ${now}
    `;
    return deleted.count;
  }
}
