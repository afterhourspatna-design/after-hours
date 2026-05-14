import { NextRequest, NextResponse } from "next/server";
import { expireStaleHolds } from "@/lib/booking-helpers";

// Called by Vercel Cron or polled from client
export async function POST(req: NextRequest) {
  // Simple secret check to avoid public triggering
  const secret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await expireStaleHolds();
  return NextResponse.json({ expired: count, timestamp: new Date().toISOString() });
}

// Also allow GET for easy manual trigger in dev
export async function GET() {
  const count = await expireStaleHolds();
  return NextResponse.json({ expired: count, timestamp: new Date().toISOString() });
}
