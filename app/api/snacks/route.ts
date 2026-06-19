import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
    const [snacks, total] = await Promise.all([
      prisma.snackOrder.findMany({
        where,
        include: {
          user: { select: { name: true, phone: true } },
          items: {
            orderBy: { createdAt: "desc" },
            include: { addedBy: { select: { name: true } } }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.snackOrder.count({ where }),
    ]);

    return NextResponse.json({ snacks, total, page, limit });
  } catch (error) {
    console.error("Error fetching snacks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
