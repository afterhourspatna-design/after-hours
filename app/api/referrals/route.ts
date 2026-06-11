import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const referrers = await prisma.appUser.findMany({
      where: {
        refereeUsers: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        referralRewardsClaimed: true,
        refereeUsers: {
          select: {
            id: true,
            name: true,
            phone: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const formatted = referrers.map((r) => {
      const totalReferrals = r.refereeUsers.length;
      const unclaimedReferrals = totalReferrals - r.referralRewardsClaimed * 3;
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        referralRewardsClaimed: r.referralRewardsClaimed,
        totalReferrals,
        unclaimedReferrals: Math.max(0, unclaimedReferrals),
        refereeUsers: r.refereeUsers,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET referrals error:", error);
    return NextResponse.json({ error: "Failed to fetch referrals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { referrerId } = body;

    if (!referrerId) {
      return NextResponse.json({ error: "Referrer ID is required" }, { status: 400 });
    }

    const referrer = await prisma.appUser.findUnique({
      where: { id: referrerId },
      include: { refereeUsers: true },
    });

    if (!referrer) {
      return NextResponse.json({ error: "Referrer user not found" }, { status: 404 });
    }

    const totalReferrals = referrer.refereeUsers.length;
    const unclaimedReferrals = totalReferrals - referrer.referralRewardsClaimed * 3;

    if (unclaimedReferrals < 3) {
      return NextResponse.json({ error: "Not enough unclaimed referrals to avail a reward" }, { status: 400 });
    }

    const updatedUser = await prisma.appUser.update({
      where: { id: referrerId },
      data: {
        referralRewardsClaimed: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Reward availed successfully",
      claimedCount: updatedUser.referralRewardsClaimed,
    });
  } catch (error: any) {
    console.error("POST referrals error:", error);
    return NextResponse.json({ error: "Failed to avail reward" }, { status: 500 });
  }
}
