import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH: rename or activate/deactivate a category. ADMIN only.
// Deactivating never touches products already assigned to it — they just
// stop offering it as a choice for new/edited products going forward.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.snackCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: { name?: string; isActive?: boolean } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      const dupe = await prisma.snackCategory.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
      });
      if (dupe) return NextResponse.json({ error: `"${dupe.name}" already exists` }, { status: 409 });
      data.name = name;
    }

    if (body.isActive !== undefined) {
      data.isActive = !!body.isActive;
    }

    const updated = await prisma.snackCategory.update({ where: { id }, data });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "UPDATE_SNACK_CATEGORY",
        entityType: "SnackCategory",
        entityId: id,
        meta: { changes: data },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH snack category error:", error);
    return NextResponse.json({ error: "Failed to update snack category" }, { status: 500 });
  }
}
