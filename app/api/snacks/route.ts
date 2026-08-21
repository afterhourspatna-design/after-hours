import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { relevanceScore, orderByIds } from "@/lib/search-rank";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, guestName, guestPhone, amount, paymentStatus, notes } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const userIdFromSession = (session.user as any).id;
  const validUser = await prisma.appUser.findUnique({ where: { id: userIdFromSession } });

  const snackOrder = await prisma.snackOrder.create({
    data: {
      userId: userId || null,
      guestName: guestName || null,
      guestPhone: guestPhone || null,
      amount,
      paymentStatus: paymentStatus || "UNPAID",
      items: {
        create: {
          amount,
          notes: notes || "Initial Amount",
          addedById: validUser ? userIdFromSession : null,
        }
      }
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userIdFromSession,
      actorName: session?.user?.name ?? undefined,
      action: "CREATE_SNACK_ORDER",
      entityType: "SnackOrder",
      entityId: snackOrder.id,
      meta: { changes: { amount, notes, paymentStatus } },
    }
  });

  return NextResponse.json(snackOrder, { status: 201 });
}

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
  const paymentStatus = searchParams.get("paymentStatus");
  const search = searchParams.get("q");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: any = {};
  if (paymentStatus) where.paymentStatus = paymentStatus;
  
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  if (search) {
    where.OR = [
      { guestName: { contains: search, mode: "insensitive" } },
      { guestPhone: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { phone: { contains: search, mode: "insensitive" } } },
    ];
  }

  try {
    const snackInclude: Prisma.SnackOrderInclude = {
      user: { select: { name: true, phone: true } },
      items: {
        orderBy: { createdAt: "desc" },
        include: { addedBy: { select: { name: true } } }
      }
    };

    if (!search) {
      const [snacks, total] = await Promise.all([
        prisma.snackOrder.findMany({ where, include: snackInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
        prisma.snackOrder.count({ where }),
      ]);
      return NextResponse.json({ snacks, total, page, limit });
    }

    // Search term present: rank by relevance in the database.
    const matched = await prisma.snackOrder.findMany({ where, select: { id: true } });
    const total = matched.length;
    if (total === 0) {
      return NextResponse.json({ snacks: [], total: 0, page, limit });
    }

    const matchedIds = matched.map((m) => m.id);
    const ranked = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT s.id FROM "snack_orders" s
      LEFT JOIN "app_users" u ON s."userId" = u.id
      WHERE s.id IN (${Prisma.join(matchedIds.map((id) => Prisma.sql`${id}`), ", ")})
      ORDER BY
        ${relevanceScore(search, [
          { table: "u", column: "name" },
          { table: "s", column: "guestName" },
          { table: "u", column: "phone" },
          { table: "s", column: "guestPhone" },
        ])},
        s."createdAt" DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `);

    if (ranked.length === 0) {
      return NextResponse.json({ snacks: [], total, page, limit });
    }

    const rankedIds = ranked.map((r) => r.id);
    const snacksFull = await prisma.snackOrder.findMany({ where: { id: { in: rankedIds } }, include: snackInclude });
    const snacks = orderByIds(snacksFull, rankedIds);

    return NextResponse.json({ snacks, total, page, limit });
  } catch (error) {
    console.error("Error fetching snacks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
