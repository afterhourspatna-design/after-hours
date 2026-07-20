import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
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
      whereClause.creditBalances = { some: { balance: { gt: 0 } } };
    }

    const users = await prisma.appUser.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        phone: true,
        creditBalances: {
          include: { applicableGames: { select: { id: true, name: true, tag: true } } }
        },
        prepaidTransactions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            description: true,
            createdAt: true,
            moneyGiven: true,
            creditsReceived: true,
            paymentId: true,
            bookingId: true,
            booking: {
              select: {
                startDateTime: true,
                durationMinutes: true,
              }
            }
          }
        }
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

    const { userId, moneyGiven, creditsReceived, description, isAllGames, gameIds, paymentMethod, cashAmount, onlineAmount, expiryDays, customExpiryDate } = await req.json();

    if (!userId || typeof creditsReceived !== "number" || typeof moneyGiven !== "number") {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const user = await prisma.appUser.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Calculate expiry date
    let expiresAt: Date | null = null;
    if (expiryDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
    } else if (customExpiryDate) {
      expiresAt = new Date(customExpiryDate);
    }

    const updatedUser = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find if a credit balance wallet already exists for this exact game configuration
      // This is tricky because gameIds is an array. To keep it simple, we can either
      // add a new UserCreditBalance record every time, or try to merge.
      // Easiest is to add a new record if we can't find an exact match, or just always add a new record.
      // Wait, let's just find an existing one that matches isAllGames and the exact same games.
      
      let creditBalance;
      
      if (isAllGames) {
        creditBalance = await tx.userCreditBalance.findFirst({
          where: { userId, isAllGames: true, expiresAt: null }
        });
      } else if (gameIds && gameIds.length > 0) {
        // Just find one that has exactly these games? Let's just create a new one if it's complex,
        // or find the first one that has ANY of these games and append?
        // Actually, it's safer to just always create a new wallet for specific purchases unless we do exact matching.
        // Let's create a new one to keep it simple and accurate.
        creditBalance = await tx.userCreditBalance.create({
          data: {
            userId,
            balance: 0,
            isAllGames: false,
            expiresAt,
            applicableGames: {
              connect: gameIds.map((id: string) => ({ id }))
            }
          }
        });
      }

      if (!creditBalance && isAllGames) {
        creditBalance = await tx.userCreditBalance.create({
          data: {
            userId,
            balance: 0,
            isAllGames: true,
            expiresAt
          }
        });
      }

      if (!creditBalance) {
        throw new Error("Could not determine credit balance configuration");
      }

      // Update the balance and expiry
      const updatedBalance = await tx.userCreditBalance.update({
        where: { id: creditBalance.id },
        data: {
          balance: { increment: creditsReceived },
          expiresAt: expiresAt || creditBalance.expiresAt
        }
      });

      // Create payment record if money was given
      let paymentId: string | null = null;
      if (moneyGiven > 0 && paymentMethod) {
        const payment = await tx.payment.create({
          data: {
            paymentMethod,
            negotiatedAmount: moneyGiven,
            cashAmount: cashAmount ?? 0,
            onlineAmount: onlineAmount ?? 0,
          }
        });
        paymentId = payment.id;
      }

      // Create transaction record
      await tx.prepaidTransaction.create({
        data: {
          userId,
          creditBalanceId: creditBalance.id,
          moneyGiven,
          creditsReceived,
          amount: creditsReceived, // for backwards compat / general tracking
          description: description || "Credits Added manually",
          paymentId
        }
      });

      return tx.appUser.findUnique({
        where: { id: userId },
        include: { creditBalances: { include: { applicableGames: true } } }
      });
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("POST /api/prepaid-balances Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
