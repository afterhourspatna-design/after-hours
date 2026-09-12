import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FundSource } from "@prisma/client";
import { toDateOnly } from "@/lib/settlement";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const dateStr = req.nextUrl.searchParams.get("date");
    const where: any = {};
    if (dateStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      where.date = toDateOnly(dateStr);
    }

    const transactions = await prisma.fundTransaction.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (error: any) {
    console.error("GET fund transactions error:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { date, fromSource, toSource, amount, notes } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "A valid date (YYYY-MM-DD) is required" }, { status: 400 });
    }
    if (!fromSource || !toSource || !Object.values(FundSource).includes(fromSource) || !Object.values(FundSource).includes(toSource)) {
      return NextResponse.json({ error: "Invalid fund source" }, { status: 400 });
    }
    if (fromSource === toSource) {
      return NextResponse.json({ error: "Source and destination must be different" }, { status: 400 });
    }
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const transaction = await prisma.fundTransaction.create({
      data: {
        date: toDateOnly(date),
        fromSource,
        toSource,
        amount: amountNum,
        notes: notes?.trim() || null,
        createdById: (session.user as any).id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "CREATE_FUND_TRANSACTION",
        entityType: "FundTransaction",
        entityId: transaction.id,
        meta: { date, fromSource, toSource, amount: amountNum },
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error: any) {
    console.error("POST fund transactions error:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
