import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    const whereClause: any = {};

    if (q) {
      whereClause.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } }
      ];
    } else {
      whereClause.prepaidHours = { gt: 0 };
    }

    const users = await prisma.appUser.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        phone: true,
        prepaidHours: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/prepaid-balances Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId, amount, description } = await req.json();

    if (!userId || typeof amount !== "number") {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const user = await prisma.appUser.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updatedUser = await prisma.$transaction(async (tx) => {
      // Create transaction record
      await tx.prepaidTransaction.create({
        data: {
          userId,
          amount,
          description: description || (amount > 0 ? "Manual Add" : "Manual Deduct")
        }
      });

      // Update user balance
      return tx.appUser.update({
        where: { id: userId },
        data: {
          prepaidHours: {
            increment: amount
          }
        }
      });
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("POST /api/prepaid-balances Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
