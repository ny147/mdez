import { NextResponse } from "next/server";
import { purgeGroups } from "@/server/key-groups/runtime";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await purgeGroups()); }
  catch { return NextResponse.json({ error: "Cleanup failed" }, { status: 500 }); }
}
