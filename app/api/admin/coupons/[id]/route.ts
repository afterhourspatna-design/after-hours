import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

    const body = await req.json();
    const { code, discountType, discountValue, minBookingAmount, maxDiscountAmount, allowedRoles, isActive } = body;

    const cleanedCode = code ? code.trim().toUpperCase() : undefined;

    if (cleanedCode && cleanedCode !== existing.code) {
      const codeConflict = await prisma.coupon.findUnique({
        where: { code: cleanedCode }
      });
      if (codeConflict) {
        return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
      }
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data: {
        code: cleanedCode,
        discountType,
        discountValue: discountValue !== undefined ? Number(discountValue) : undefined,
        minBookingAmount: minBookingAmount !== undefined ? Number(minBookingAmount) : undefined,
        maxDiscountAmount: maxDiscountAmount !== undefined ? (maxDiscountAmount !== null ? Number(maxDiscountAmount) : null) : undefined,
        allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : undefined,
        isActive: isActive !== undefined ? !!isActive : undefined,
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "UPDATE_COUPON",
        entityType: "Coupon",
        entityId: id,
        meta: { changes: body }
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT coupon error:", error);
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

    const bookingsCount = await prisma.booking.count({ where: { couponId: id } });
    
    if (bookingsCount > 0) {
      // Deactivate instead of deleting
      await prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: "Coupon has existing redemptions, so it was deactivated instead of deleted" });
    }

    await prisma.coupon.delete({ where: { id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "DELETE_COUPON",
        entityType: "Coupon",
        entityId: id,
        meta: { code: coupon.code }
      }
    });

    return NextResponse.json({ message: "Coupon deleted successfully" });
  } catch (error: any) {
    console.error("DELETE coupon error:", error);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}
