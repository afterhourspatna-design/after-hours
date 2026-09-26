import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSnackProduct } from "@/lib/snacks";

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

    const body = await req.json();
    const { productId, productName, notes } = body;
    const unitPrice = Number(body.unitPrice);
    const quantity = Number(body.quantity) || 1;

    if (!unitPrice || unitPrice <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }
    if (quantity <= 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    let product;
    try {
      product = await resolveSnackProduct({ productId, productName, unitPrice });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Invalid product" }, { status: 400 });
    }

    const amount = Number((unitPrice * quantity).toFixed(2));

    // Add item and increment order total
    const userIdFromSession = (session.user as any).id;
    const validUser = await prisma.appUser.findUnique({ where: { id: userIdFromSession } });

    const updated = await prisma.snackOrder.update({
      where: { id },
      data: {
        amount: { increment: amount },
        items: {
          create: {
            amount,
            notes: notes || null,
            productId: product.id,
            quantity,
            unitPrice,
            addedById: validUser ? userIdFromSession : null
          }
        }
      },
      include: {
        user: { select: { name: true, phone: true } },
        items: {
          orderBy: { createdAt: "desc" },
          include: { addedBy: { select: { name: true } }, product: { select: { name: true } } }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        actorId: userIdFromSession,
        actorName: session?.user?.name ?? undefined,
        action: "ADD_SNACK_ITEM",
        entityType: "SnackOrder",
        entityId: id,
        meta: { addedAmount: amount, product: product.name, quantity, unitPrice, notes },
      }
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error("Error adding snack item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
