import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { relevanceScore, orderByIds } from "@/lib/search-rank";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const search = searchParams.get("q");
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");

  const where: any = {};

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { paymentMethod: { contains: search, mode: "insensitive" } },
      { customerNames: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const paymentInclude = {
      allocations: {
        include: {
          booking: { select: { id: true, finalAmount: true, guestName: true, guestPhone: true, startDateTime: true, endDateTime: true, negotiatedAmount: true, game: { select: { name: true } }, user: { select: { name: true, phone: true } }, couponId: true } },
          snackOrder: { select: { id: true, amount: true, guestName: true, guestPhone: true, user: { select: { name: true, phone: true } } } }
        }
      },
      prepaidTransactions: {
        select: { id: true, amount: true, description: true }
      }
    };

    if (!search) {
      const [payments, total] = await Promise.all([
        prisma.payment.findMany({ where, include: paymentInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
        prisma.payment.count({ where }),
      ]);
      return NextResponse.json({ payments, total, page, limit });
    }

    // Search term present: rank by relevance in the database.
    const matched = await prisma.payment.findMany({ where, select: { id: true } });
    const total = matched.length;
    if (total === 0) {
      return NextResponse.json({ payments: [], total: 0, page, limit });
    }

    const matchedIds = matched.map((m) => m.id);
    const ranked = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT p.id FROM "payments" p
      WHERE p.id IN (${Prisma.join(matchedIds.map((id) => Prisma.sql`${id}`), ", ")})
      ORDER BY
        ${relevanceScore(search, [
          { table: "p", column: "id" },
          { table: "p", column: "paymentMethod" },
          { table: "p", column: "customerNames" },
        ])},
        p."createdAt" DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `);

    if (ranked.length === 0) {
      return NextResponse.json({ payments: [], total, page, limit });
    }

    const rankedIds = ranked.map((r) => r.id);
    const paymentsFull = await prisma.payment.findMany({ where: { id: { in: rankedIds } }, include: paymentInclude });
    const payments = orderByIds(paymentsFull, rankedIds);

    return NextResponse.json({ payments, total, page, limit });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
