import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  computeEndDate,
  getStreakProgress,
  reconcileStreakStatus,
} from "@/lib/streak";

// ── GET: list streak challenges (optionally for a single user) ──
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const userId = req.nextUrl.searchParams.get("userId") || undefined;

    const challenges = await prisma.streakChallenge.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        issuedBy: { select: { id: true, name: true } },
      },
    });

    // Reconcile expired windows lazily, and attach live progress
    const reconciled = await Promise.all(
      challenges.map(async (c) => {
        const status = await reconcileStreakStatus(c);
        const progress =
          status === "ACTIVE"
            ? await getStreakProgress({
                userId: c.userId,
                startDate: c.startDate,
                endDate: c.endDate,
              })
            : null;
        return {
          ...c,
          status,
          progress,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate.toISOString(),
          issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json(reconciled);
  } catch (error: any) {
    console.error("GET streak error:", error);
    return NextResponse.json({ error: "Failed to fetch streak challenges" }, { status: 500 });
  }
}

// ── POST: start a 30-day challenge for a customer ──
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, startDate } = body;

    if (!userId) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }
    if (!startDate || isNaN(Date.parse(startDate))) {
      return NextResponse.json({ error: "A valid start date is required" }, { status: 400 });
    }

    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Guard: no two active challenges for the same customer
    const existingActive = await prisma.streakChallenge.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (existingActive) {
      return NextResponse.json(
        { error: "This customer already has an active streak challenge" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = computeEndDate(start);

    const challenge = await prisma.streakChallenge.create({
      data: {
        userId,
        startDate: start,
        endDate: end,
        status: "ACTIVE",
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json({
      success: true,
      challenge: {
        ...challenge,
        startDate: challenge.startDate.toISOString(),
        endDate: challenge.endDate.toISOString(),
        createdAt: challenge.createdAt.toISOString(),
        updatedAt: challenge.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("POST streak error:", error);
    return NextResponse.json({ error: "Failed to start streak challenge" }, { status: 500 });
  }
}

// ── PATCH: issue the gift for an eligible, active challenge ──
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { challengeId } = body;

    if (!challengeId) {
      return NextResponse.json({ error: "Challenge ID is required" }, { status: 400 });
    }

    const challenge = await prisma.streakChallenge.findUnique({
      where: { id: challengeId },
    });
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    const status = await reconcileStreakStatus(challenge);
    if (status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Cannot issue gift: challenge is ${status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Re-check eligibility at issue time (don't trust the client)
    const progress = await getStreakProgress({
      userId: challenge.userId,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
    });
    if (!progress.isEligible) {
      return NextResponse.json(
        {
          error: `Customer needs ${progress.remaining} more qualifying day(s) to reach the streak goal`,
          progress,
        },
        { status: 400 }
      );
    }

    const issuedById = (session.user as any).id;

    await prisma.$transaction([
      prisma.streakChallenge.update({
        where: { id: challengeId },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
          issuedById,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: issuedById,
          actorName: session?.user?.name ?? undefined,
          action: "ISSUE_STREAK_GIFT",
          entityType: "StreakChallenge",
          entityId: challengeId,
          meta: {
            userId: challenge.userId,
            qualifyingDays: progress.qualifyingDays,
            windowStart: challenge.startDate.toISOString(),
            windowEnd: challenge.endDate.toISOString(),
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Streak gift issued successfully",
      qualifyingDays: progress.qualifyingDays,
    });
  } catch (error: any) {
    console.error("PATCH streak error:", error);
    return NextResponse.json({ error: "Failed to issue streak gift" }, { status: 500 });
  }
}
