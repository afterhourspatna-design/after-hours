import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json(coupons);
  } catch (error: any) {
    console.error("GET coupons error:", error);
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { code, discountType, discountValue, minBookingAmount, maxDiscountAmount, allowedRoles, isActive } = body;

    if (!code || !discountType || discountValue === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanedCode = code.trim().toUpperCase();

    // Check if code is already taken
    const existing = await prisma.coupon.findUnique({
      where: { code: cleanedCode }
    });

    if (existing) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
    }

    // Verify allowedRoles is valid array of Role
    const roles: Role[] = Array.isArray(allowedRoles) && allowedRoles.length > 0 
      ? allowedRoles 
      : [Role.ADMIN, Role.STAFF, Role.CUSTOMER];

    const coupon = await prisma.coupon.create({
      data: {
        code: cleanedCode,
        discountType,
        discountValue: Number(discountValue),
        minBookingAmount: minBookingAmount ? Number(minBookingAmount) : 0,
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        allowedRoles: roles,
        isActive: isActive !== undefined ? !!isActive : true,
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "CREATE_COUPON",
        entityType: "Coupon",
        entityId: coupon.id,
        meta: { code: coupon.code }
      }
    });

    return NextResponse.json(coupon, { status: 201 });
  } catch (error: any) {
    console.error("POST coupons error:", error);
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}
