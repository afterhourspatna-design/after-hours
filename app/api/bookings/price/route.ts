import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { calculateBookingPrice } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  gameId: z.string(),
  durationMinutes: z.number().min(5),
  startDateTime: z.string().datetime(),
  userId: z.string().optional().nullable(),
  excludeBookingId: z.string().optional().nullable(),
  accessoriesCount: z.number().int().min(0).optional(),
  couponCode: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const parsed = schema.safeParse({
    gameId: searchParams.get("gameId"),
    durationMinutes: parseInt(searchParams.get("durationMinutes") ?? "60"),
    startDateTime: searchParams.get("startDateTime"),
    userId: searchParams.get("userId"),
    excludeBookingId: searchParams.get("excludeBookingId"),
    accessoriesCount: parseInt(searchParams.get("accessoriesCount") ?? "0"),
    couponCode: searchParams.get("couponCode"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const { gameId, durationMinutes, startDateTime, userId, excludeBookingId, accessoriesCount, couponCode } = parsed.data;
  const userRole = (session.user as any).role;

  const pricing = await calculateBookingPrice({
    gameId,
    durationMinutes,
    startDateTime: new Date(startDateTime),
    userId: userId ?? null,
    excludeBookingId: excludeBookingId ?? undefined,
    accessoriesCount: accessoriesCount ?? 0,
    couponCode: couponCode ?? undefined,
    userRole,
  });

  // Also return game info
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { 
      name: true, 
      basePrice: true, 
      minTimeMinutes: true, 
      maxTimeMinutes: true,
      hasAccessories: true,
      defaultAccessories: true,
      maxAccessories: true,
      accessoryPrice: true,
    },
  });

  return NextResponse.json({ ...pricing, game });
}
