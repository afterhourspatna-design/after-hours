import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, itemId } = await params;

  try {
    const order = await prisma.snackOrder.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (order.paymentStatus === "PAID" && role !== "ADMIN") {
      return NextResponse.json({ error: "Cannot edit paid snacks" }, { status: 400 });
    }

    const item = await prisma.snackOrderItem.findUnique({ where: { id: itemId } });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    if (item.snackOrderId !== id) {
      return NextResponse.json({ error: "Item does not belong to this order" }, { status: 400 });
    }

    const body = await req.json();
    const oldQuantity = item.quantity ?? 1;
    const oldUnitPrice = item.unitPrice != null ? Number(item.unitPrice) : Number(item.amount) / oldQuantity;

    const quantity = body.quantity !== undefined ? Number(body.quantity) : oldQuantity;
    const unitPrice = body.unitPrice !== undefined ? Number(body.unitPrice) : oldUnitPrice;
    const notes = body.notes !== undefined ? (body.notes ? String(body.notes) : null) : item.notes;

    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({ error: "Quantity must be at least 1 (delete the item to remove it)" }, { status: 400 });
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const newAmount = Number((unitPrice * quantity).toFixed(2));
    const diff = Number((newAmount - Number(item.amount)).toFixed(2));
    const newOrderTotal = Number((Number(order.amount) + diff).toFixed(2));

    // Never let the tab drop below what has already been paid against it.
    const paidAgg = await prisma.paymentAllocation.aggregate({
      where: { snackOrderId: id },
      _sum: { amount: true },
    });
    const paid = Number(paidAgg._sum.amount ?? 0);
    if (newOrderTotal < paid - 0.009) {
      return NextResponse.json(
        { error: `Tab total can't go below the ₹${paid.toFixed(2)} already paid on it` },
        { status: 400 }
      );
    }

    let paymentStatus = order.paymentStatus;
    if (paid > 0) {
      paymentStatus = newOrderTotal - paid <= 0.009 ? "PAID" : "PARTIAL";
    }

    await prisma.$transaction([
      prisma.snackOrderItem.update({
        where: { id: itemId },
        data: { quantity, unitPrice, amount: newAmount, notes },
      }),
      prisma.snackOrder.update({
        where: { id },
        data: { amount: newOrderTotal, paymentStatus },
      }),
      prisma.auditLog.create({
        data: {
          actorId: (session.user as any).id,
          actorName: session?.user?.name ?? undefined,
          action: "EDIT_SNACK_ITEM",
          entityType: "SnackOrder",
          entityId: id,
          meta: {
            itemId,
            before: { quantity: oldQuantity, unitPrice: oldUnitPrice, amount: Number(item.amount), notes: item.notes },
            after: { quantity, unitPrice, amount: newAmount, notes },
          },
        },
      }),
    ]);

    const updated = await prisma.snackOrder.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, phone: true } },
        items: {
          orderBy: { createdAt: "desc" },
          include: { addedBy: { select: { name: true } }, product: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error editing snack item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    // Never let the tab drop below what has already been paid against it.
    const paidAgg = await prisma.paymentAllocation.aggregate({
      where: { snackOrderId: id },
      _sum: { amount: true },
    });
    const paid = Number(paidAgg._sum.amount ?? 0);
    const newOrderTotal = Number((Number(existingOrder.amount) - Number(item.amount)).toFixed(2));
    if (newOrderTotal < paid - 0.009) {
      return NextResponse.json(
        { error: `Tab total can't go below the ₹${paid.toFixed(2)} already paid on it` },
        { status: 400 }
      );
    }
    let paymentStatus = existingOrder.paymentStatus;
    if (paid > 0) {
      paymentStatus = newOrderTotal - paid <= 0.009 ? "PAID" : "PARTIAL";
    }

    // Delete item and decrement order total in a transaction
    await prisma.$transaction([
      prisma.snackOrderItem.delete({ where: { id: itemId } }),
      prisma.snackOrder.update({
        where: { id },
        data: {
          amount: { decrement: item.amount },
          paymentStatus,
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
        user: { select: { name: true, phone: true } },
        items: {
          orderBy: { createdAt: "desc" },
          include: { addedBy: { select: { name: true } }, product: { select: { name: true } } }
        }
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error deleting snack item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
