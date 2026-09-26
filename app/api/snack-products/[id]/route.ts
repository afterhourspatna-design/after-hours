import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH: rename, reprice, or activate/deactivate a menu item. ADMIN only.
// Repricing only changes the *default* going forward — it does not touch
// unitPrice/amount on items already sold (see lib/snacks.ts).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.snackProduct.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: { name?: string; price?: number; isActive?: boolean } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      const dupe = await prisma.snackProduct.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
      });
      if (dupe) return NextResponse.json({ error: `"${dupe.name}" is already on the menu` }, { status: 409 });
      data.name = name;
    }

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!price || price <= 0) return NextResponse.json({ error: "A valid price is required" }, { status: 400 });
      data.price = price;
    }

    if (body.isActive !== undefined) {
      data.isActive = !!body.isActive;
    }

    const updated = await prisma.snackProduct.update({ where: { id }, data });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "UPDATE_SNACK_PRODUCT",
        entityType: "SnackProduct",
        entityId: id,
        meta: { changes: data },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH snack product error:", error);
    return NextResponse.json({ error: "Failed to update snack product" }, { status: 500 });
  }
}
