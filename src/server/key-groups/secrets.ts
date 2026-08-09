import "server-only";
import { createHmac } from "node:crypto";

export function digestGroupKey(key: string): Buffer {
  const pepper = process.env.GROUP_KEY_PEPPER;
  if (!pepper || Buffer.byteLength(pepper) < 32) {
    throw new Error("GROUP_KEY_PEPPER must contain at least 32 bytes");
  }
  return createHmac("sha256", pepper).update(key, "utf8").digest();
}
