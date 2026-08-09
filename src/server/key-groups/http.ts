import { NextResponse } from "next/server";

import { isValidGroupKey } from "@/lib/key-group";
import { KeyGroupError } from "./store";

const noStore = { "cache-control": "no-store" };

export function requireGroupKey(request: Request): string {
  const key = request.headers.get("x-mdez-group-key")?.trim() ?? "";
  if (!isValidGroupKey(key)) throw new KeyGroupError("INVALID_KEY", "Group key is invalid");
  return key;
}

export function validEntityId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) || /^[a-z][a-z0-9_-]{0,127}$/i.test(value);
}

export function groupJson(value: unknown, status = 200): NextResponse {
  return NextResponse.json(value, { status, headers: noStore });
}

export function groupError(error: unknown, fallback: string): NextResponse {
  const known = error as { code?: string; message?: string; conflict?: unknown; retryAfterSeconds?: number };
  if (known.retryAfterSeconds !== undefined) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...noStore, "retry-after": String(known.retryAfterSeconds) } });
  if (known.code === "CONFLICT") return groupJson({ error: "VERSION_CONFLICT", conflict: known.conflict }, 409);
  if (known.code === "INVALID_KEY") return groupJson({ error: "Group key is invalid" }, 401);
  if (known.code === "DELETED") return groupJson({ error: "Group is deleted" }, 410);
  if (known.code === "NOT_FOUND") return groupJson({ error: "Not found" }, 404);
  if (known.code === "LIMIT_EXCEEDED") return groupJson({ error: known.message ?? "Group limit exceeded" }, 413);
  if (known instanceof SyntaxError) return groupJson({ error: "A valid JSON body is required" }, 400);
  return groupJson({ error: fallback }, 500);
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SyntaxError("A valid JSON body is required");
  return value as Record<string, unknown>;
}
