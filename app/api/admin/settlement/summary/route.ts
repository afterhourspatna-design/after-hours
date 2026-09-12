import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDailySettlementSummary, toDateOnly } from "@/lib/settlement";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "A valid date (YYYY-MM-DD) is required" }, { status: 400 });
    }

    const sources = await getDailySettlementSummary(toDateOnly(dateStr));
    return NextResponse.json({ date: dateStr, sources });
  } catch (error: any) {
    console.error("GET settlement summary error:", error);
    return NextResponse.json({ error: "Failed to compute settlement summary" }, { status: 500 });
  }
}
