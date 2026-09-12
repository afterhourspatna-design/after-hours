import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FundSource } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = req.nextUrl;
    const categoryId = searchParams.get("categoryId");
    const paymentMode = searchParams.get("paymentMode");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (paymentMode && Object.values(FundSource).includes(paymentMode as FundSource)) {
      where.paymentMode = paymentMode;
    }
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(`${to}T23:59:59.999`);
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error: any) {
    console.error("GET expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { date, paymentMode, categoryId, amount, notes } = body;

    if (!date || !paymentMode || !categoryId || amount === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!Object.values(FundSource).includes(paymentMode)) {
      return NextResponse.json({ error: "Invalid payment mode" }, { status: 400 });
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const expense = await prisma.expense.create({
      data: {
        date: new Date(date),
        paymentMode,
        categoryId,
        amount: amountNum,
        notes: notes?.trim() || null,
        createdById: (session.user as any).id,
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
        action: "CREATE_EXPENSE",
        entityType: "Expense",
        entityId: expense.id,
        meta: { amount: amountNum, category: category.name, paymentMode },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    console.error("POST expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
