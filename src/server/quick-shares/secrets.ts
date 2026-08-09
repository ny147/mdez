import "server-only";
import { createHmac, randomBytes } from "node:crypto";

export function createOpaqueSecret(): string {
  return randomBytes(16).toString("base64url");
}

export function digestManagementToken(token: string): Buffer {
  const pepper = process.env.MANAGEMENT_TOKEN_PEPPER;
  if (!pepper || Buffer.byteLength(pepper) < 32) {
    throw new Error("MANAGEMENT_TOKEN_PEPPER must contain at least 32 bytes");
  }
  return createHmac("sha256", pepper).update(token, "utf8").digest();
}
