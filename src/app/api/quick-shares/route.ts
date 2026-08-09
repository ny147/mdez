import { NextResponse } from "next/server";

import { requestAddress } from "@/server/request-address";
import { createShare } from "@/server/quick-shares/runtime";

const validationMessages = new Set([
  "A share payload is required",
  "Title must contain 1 to 300 characters",
  "Markdown must be text",
  "Choose a valid expiry"
]);

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON body is required" }, { status: 400 });
  }

  try {
    const result = await createShare(input, {
      origin: new URL(request.url).origin,
      address: requestAddress(request.headers)
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const known = error as { code?: string; message?: string; retryAfterSeconds?: number };
    if (known.code === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "retry-after": String(known.retryAfterSeconds ?? 60) } }
      );
    }
    if (known.message === "Markdown must be 5 MiB or smaller") {
      return NextResponse.json({ error: known.message }, { status: 413 });
    }
    if (known.message && validationMessages.has(known.message)) {
      return NextResponse.json({ error: known.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not create shared page" }, { status: 500 });
  }
}
