import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FundSource } from "@prisma/client";
import { toDateOnly } from "@/lib/settlement";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.fundTransaction.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const body = await req.json();
    const { date, fromSource, toSource, amount, notes } = body;

    const nextFrom = fromSource ?? existing.fromSource;
    const nextTo = toSource ?? existing.toSource;

    if (fromSource && !Object.values(FundSource).includes(fromSource)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    if (toSource && !Object.values(FundSource).includes(toSource)) {
      return NextResponse.json({ error: "Invalid destination" }, { status: 400 });
    }
    if (nextFrom === nextTo) {
      return NextResponse.json({ error: "Source and destination must be different" }, { status: 400 });
    }

    let amountNum: number | undefined = undefined;
    if (amount !== undefined) {
      amountNum = Number(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      }
    }

    const updated = await prisma.fundTransaction.update({
      where: { id },
      data: {
        date: date ? toDateOnly(date) : undefined,
        fromSource: fromSource ?? undefined,
        toSource: toSource ?? undefined,
        amount: amountNum,
        notes: notes !== undefined ? (notes?.trim() || null) : undefined,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "UPDATE_FUND_TRANSACTION",
        entityType: "FundTransaction",
        entityId: id,
        meta: { changes: body },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT fund transaction error:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const transaction = await prisma.fundTransaction.findUnique({ where: { id } });
    if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    await prisma.fundTransaction.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "DELETE_FUND_TRANSACTION",
        entityType: "FundTransaction",
        entityId: id,
        meta: { amount: transaction.amount.toString(), fromSource: transaction.fromSource, toSource: transaction.toSource },
      },
    });

    return NextResponse.json({ message: "Transaction deleted successfully" });
  } catch (error: any) {
    console.error("DELETE fund transaction error:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
