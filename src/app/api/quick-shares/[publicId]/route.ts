import { NextResponse } from "next/server";

import { requestAddress } from "@/server/request-address";
import { deleteShare, readShare } from "@/server/quick-shares/runtime";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "cache-control": "no-store" };

type RouteContext = { params: Promise<{ publicId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { publicId } = await context.params;
  try {
    const payload = await readShare(publicId, requestAddress(request.headers));
    return NextResponse.json(payload, { headers: noStoreHeaders });
  } catch (error) {
    const known = error as { code?: string; message?: string; retryAfterSeconds?: number };
    if (known.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Shared page not found" }, {
        status: 404,
        headers: noStoreHeaders
      });
    }
    if (known.code === "EXPIRED") {
      return NextResponse.json({ error: "This shared page has expired" }, {
        status: 410,
        headers: noStoreHeaders
      });
    }
    if (known.code === "RATE_LIMITED") {
      return NextResponse.json({ error: "Too many requests" }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "retry-after": String(known.retryAfterSeconds ?? 60)
        }
      });
    }
    return NextResponse.json({ error: "Could not load shared page" }, {
      status: 500,
      headers: noStoreHeaders
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { publicId } = await context.params;
  const token = request.headers.get("x-mdez-management-token") ?? "";
  try {
    await deleteShare(publicId, token);
    return new Response(null, { status: 204 });
  } catch (error) {
    const known = error as { code?: string };
    if (known.code === "FORBIDDEN") {
      return NextResponse.json({ error: "Management token is invalid" }, { status: 403 });
    }
    if (known.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Shared page not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not delete shared page" }, { status: 500 });
  }
}
