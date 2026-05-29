import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    // Default to CUSTOMER if not authenticated (e.g. anonymous visitor/guest)
    const role = (session?.user as any)?.role || "CUSTOMER";

    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        allowedRoles: {
          has: role as any,
        },
      },
      select: {
        id: true,
        code: true,
        discountType: true,
        discountValue: true,
        minBookingAmount: true,
        maxDiscountAmount: true,
        allowedRoles: true,
      },
      orderBy: {
        code: "asc",
      },
    });

    return NextResponse.json(coupons);
  } catch (error: any) {
    console.error("Error fetching available coupons:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
