import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FundSource } from "@prisma/client";
import { toDateOnly } from "@/lib/settlement";

/** Sets the manually-reconciled ACTUAL closing balance for a source on a given
 * date (e.g. a physical till count or bank statement figure). This becomes
 * the opening balance for the following date. To seed the ledger, set this
 * for the date before your intended start date (e.g. actual closing of
 * 31-Aug to establish the opening of 1-Sep). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { date, source, amount, notes } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "A valid date (YYYY-MM-DD) is required" }, { status: 400 });
    }
    if (!source || !Object.values(FundSource).includes(source)) {
      return NextResponse.json({ error: "Invalid fund source" }, { status: 400 });
    }
    const amountNum = Number(amount);
    if (isNaN(amountNum)) {
      return NextResponse.json({ error: "Amount must be a number" }, { status: 400 });
    }

    const dateOnly = toDateOnly(date);

    const balance = await prisma.dailyActualBalance.upsert({
      where: { date_source: { date: dateOnly, source } },
      update: { amount: amountNum, notes: notes?.trim() || null, setById: (session.user as any).id },
      create: { date: dateOnly, source, amount: amountNum, notes: notes?.trim() || null, setById: (session.user as any).id },
    });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "SET_ACTUAL_BALANCE",
        entityType: "DailyActualBalance",
        entityId: balance.id,
        meta: { date, source, amount: amountNum },
      },
    });

    return NextResponse.json(balance, { status: 201 });
  } catch (error: any) {
    console.error("POST actual balance error:", error);
    return NextResponse.json({ error: "Failed to set actual balance" }, { status: 500 });
  }
}
