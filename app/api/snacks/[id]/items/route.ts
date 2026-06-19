import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.snackOrder.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.paymentStatus === "PAID" && role !== "ADMIN") {
      return NextResponse.json({ error: "Cannot edit paid snacks" }, { status: 400 });
    }

    const { amount, notes } = await req.json();

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Add item and increment order total
    const userIdFromSession = (session.user as any).id;
    const validUser = await prisma.appUser.findUnique({ where: { id: userIdFromSession } });

    const updated = await prisma.snackOrder.update({
      where: { id },
      data: {
        amount: { increment: Number(amount) },
        items: {
          create: {
            amount: Number(amount),
            notes: notes || "Added items",
            addedById: validUser ? userIdFromSession : null
          }
        }
      },
      include: {
        items: {
          orderBy: { createdAt: "desc" },
          include: { addedBy: { select: { name: true } } }
        }
      }
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error("Error adding snack item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
