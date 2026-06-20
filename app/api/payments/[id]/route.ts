import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        allocations: {
          include: {
            booking: {
              include: {
                game: { select: { name: true } },
                user: { select: { name: true } }
              }
            },
            snackOrder: {
              include: {
                user: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error fetching payment details:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
