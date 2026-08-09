import type { CreateQuickShareInput, CreateQuickShareResult } from "@/types/quick-share";

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return new Error(body.error);
  } catch {
    // The fallback below is safe for non-JSON or malformed error responses.
  }
  return new Error(fallback);
}

export async function createQuickShare(
  input: CreateQuickShareInput
): Promise<CreateQuickShareResult> {
  const response = await fetch("/api/quick-shares", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw await responseError(response, "Could not create shared page");
  return response.json() as Promise<CreateQuickShareResult>;
}

export async function deleteQuickShare(
  publicId: string,
  managementToken: string
): Promise<void> {
  const response = await fetch(`/api/quick-shares/${encodeURIComponent(publicId)}`, {
    method: "DELETE",
    headers: { "x-mdez-management-token": managementToken }
  });
  if (response.status === 204) return;
  throw await responseError(response, "Could not delete shared page");
}
