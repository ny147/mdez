import { NextResponse } from "next/server";

const PREVIEW_UNAVAILABLE_MESSAGE =
  "Sharing is unavailable in this preview. Your local library still works.";

export function middleware() {
  if (process.env.VERCEL_ENV === "preview") {
    return NextResponse.json(
      { error: PREVIEW_UNAVAILABLE_MESSAGE },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/quick-shares/:path*",
    "/api/key-groups/:path*",
    "/api/cron/quick-shares",
    "/api/cron/key-groups"
  ]
};
