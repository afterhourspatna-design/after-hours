import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FundSource } from "@prisma/client";

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
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    const body = await req.json();
    const { date, paymentMode, categoryId, amount, notes } = body;

    if (paymentMode && !Object.values(FundSource).includes(paymentMode)) {
      return NextResponse.json({ error: "Invalid payment mode" }, { status: 400 });
    }

    if (categoryId) {
      const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
      if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    let amountNum: number | undefined = undefined;
    if (amount !== undefined) {
      amountNum = Number(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      }
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        paymentMode: paymentMode ?? undefined,
        categoryId: categoryId ?? undefined,
        amount: amountNum,
        notes: notes !== undefined ? (notes?.trim() || null) : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "UPDATE_EXPENSE",
        entityType: "Expense",
        entityId: id,
        meta: { changes: body },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT expense error:", error);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
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
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    await prisma.expense.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "DELETE_EXPENSE",
        entityType: "Expense",
        entityId: id,
        meta: { amount: expense.amount.toString() },
      },
    });

    return NextResponse.json({ message: "Expense deleted successfully" });
  } catch (error: any) {
    console.error("DELETE expense error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
