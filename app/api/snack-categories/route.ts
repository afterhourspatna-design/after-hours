import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: list categories — used for the picker/manage-menu dropdowns.
// ADMIN + STAFF, same as snack-products.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";

  try {
    const categories = await prisma.snackCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error: any) {
    console.error("GET snack categories error:", error);
    return NextResponse.json({ error: "Failed to fetch snack categories" }, { status: 500 });
  }
}

// POST: add a category. ADMIN only, same as snack-products management.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const existing = await prisma.snackCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (existing) {
      return NextResponse.json({ error: `"${existing.name}" already exists` }, { status: 409 });
    }

    const category = await prisma.snackCategory.create({ data: { name } });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "CREATE_SNACK_CATEGORY",
        entityType: "SnackCategory",
        entityId: category.id,
        meta: { name: category.name },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error("POST snack categories error:", error);
    return NextResponse.json({ error: "Failed to create snack category" }, { status: 500 });
  }
}
