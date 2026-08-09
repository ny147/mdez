import type { CreateQuickShareInput, QuickShareExpiry } from "@/types/quick-share";

const durations: Record<Exclude<QuickShareExpiry, "never">, number> = {
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};

export function expiryDate(expiry: QuickShareExpiry, now = new Date()): Date | null {
  return expiry === "never" ? null : new Date(now.getTime() + durations[expiry]);
}

export function validateQuickShareInput(value: unknown): CreateQuickShareInput {
  if (!value || typeof value !== "object") throw new Error("A share payload is required");
  const input = value as Partial<CreateQuickShareInput>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 300) throw new Error("Title must contain 1 to 300 characters");
  if (typeof input.markdown !== "string") throw new Error("Markdown must be text");
  if (new TextEncoder().encode(input.markdown).byteLength > 5 * 1024 * 1024) {
    throw new Error("Markdown must be 5 MiB or smaller");
  }
  if (!(["1h", "1d", "7d", "30d", "never"] as const).includes(input.expiry as QuickShareExpiry)) {
    throw new Error("Choose a valid expiry");
  }
  return { title, markdown: input.markdown, expiry: input.expiry as QuickShareExpiry };
}
