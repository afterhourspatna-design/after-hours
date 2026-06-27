import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, itemId } = await params;

  try {
    const existingOrder = await prisma.snackOrder.findUnique({ where: { id } });
    if (!existingOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existingOrder.paymentStatus === "PAID" && role !== "ADMIN") {
      return NextResponse.json({ error: "Cannot edit paid snacks" }, { status: 400 });
    }

    const item = await prisma.snackOrderItem.findUnique({ where: { id: itemId } });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    if (item.snackOrderId !== id) {
      return NextResponse.json({ error: "Item does not belong to this order" }, { status: 400 });
    }

    // Delete item and decrement order total in a transaction
    await prisma.$transaction([
      prisma.snackOrderItem.delete({ where: { id: itemId } }),
      prisma.snackOrder.update({
        where: { id },
        data: {
          amount: { decrement: item.amount }
        }
      }),
      prisma.auditLog.create({
        data: {
          actorId: (session.user as any).id,
          actorName: session?.user?.name ?? undefined,
          action: "DELETE_SNACK_ITEM",
          entityType: "SnackOrder",
          entityId: id,
          meta: { deletedItem: item },
        }
      })
    ]);

    const updated = await prisma.snackOrder.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: "desc" },
          include: { addedBy: { select: { name: true } } }
        }
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error deleting snack item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
