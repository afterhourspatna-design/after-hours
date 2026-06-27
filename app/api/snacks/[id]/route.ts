import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Only allow editing UNPAID snacks, unless admin
    if (existing.paymentStatus === "PAID" && role !== "ADMIN") {
      return NextResponse.json({ error: "Cannot edit paid snacks" }, { status: 400 });
    }

    const body = await req.json();
    const { userId, guestName, guestPhone, amount, paymentStatus } = body;

    const updated = await prisma.snackOrder.update({
      where: { id },
      data: {
        userId: userId !== undefined ? userId : existing.userId,
        guestName: guestName !== undefined ? guestName : existing.guestName,
        guestPhone: guestPhone !== undefined ? guestPhone : existing.guestPhone,
        amount: amount !== undefined ? amount : existing.amount,
        paymentStatus: paymentStatus !== undefined ? paymentStatus : existing.paymentStatus,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session?.user?.name ?? undefined,
        action: "UPDATE_SNACK_ORDER",
        entityType: "SnackOrder",
        entityId: id,
        meta: { changes: body },
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating snack:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: "Cannot delete paid snacks" }, { status: 400 });
    }

    await prisma.snackOrder.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session?.user?.name ?? undefined,
        action: "DELETE_SNACK_ORDER",
        entityType: "SnackOrder",
        entityId: id,
        meta: { orderDetails: existing },
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting snack:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
