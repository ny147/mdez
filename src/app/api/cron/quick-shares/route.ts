import { NextResponse } from "next/server";

import { purgeShares } from "@/server/quick-shares/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await purgeShares());
  } catch {
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
