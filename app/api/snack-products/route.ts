import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: list/search the snack menu — used by the product picker (typeahead)
// and the manage-menu screen. ADMIN + STAFF, since anyone adding a snack
// needs to search the catalog.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("q")?.trim();
  const includeInactive = searchParams.get("includeInactive") === "1";

  try {
    const products = await prisma.snackProduct.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(products);
  } catch (error: any) {
    console.error("GET snack products error:", error);
    return NextResponse.json({ error: "Failed to fetch snack products" }, { status: 500 });
  }
}

// POST: explicit "add to menu" from the manage-menu screen — ADMIN only.
// (A product also gets created implicitly, for any role, when a staff
// member types a new item name while adding a snack — see lib/snacks.ts.
// This endpoint is the deliberate management action, so it errors on a
// duplicate name rather than silently reusing the existing product.)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const name = (body.name ?? "").trim();
    const price = Number(body.price);

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!price || price <= 0) return NextResponse.json({ error: "A valid price is required" }, { status: 400 });

    const existing = await prisma.snackProduct.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (existing) {
      return NextResponse.json({ error: `"${existing.name}" is already on the menu` }, { status: 409 });
    }

    const product = await prisma.snackProduct.create({ data: { name, price } });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "CREATE_SNACK_PRODUCT",
        entityType: "SnackProduct",
        entityId: product.id,
        meta: { name: product.name, price },
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error("POST snack products error:", error);
    return NextResponse.json({ error: "Failed to create snack product" }, { status: 500 });
  }
}
