import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createTournamentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  gameId: z.string().min(1, "Game is required"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  entryFee: z.number().min(0).default(0),
  prizePool: z.number().min(0).default(0),
  prize1st: z.string().optional().nullable(),
  prize2nd: z.string().optional().nullable(),
  prize3rd: z.string().optional().nullable(),
  maxParticipants: z.number().int().min(2).max(512).default(32),
  format: z.enum(["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "ROUND_ROBIN"]).default("SINGLE_ELIMINATION"),
  rules: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const gameId = searchParams.get("gameId");

  const where: any = {};
  if (status) where.status = status;
  if (gameId) where.gameId = gameId;

  const tournaments = await prisma.tournament.findMany({
    where,
    include: {
      game: { select: { id: true, name: true, tag: true } },
      _count: { select: { participants: true, matches: true } },
      participants: {
        include: {
          user: { select: { id: true, name: true, phone: true } }
        },
        orderBy: { seedNumber: "asc" }
      }
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json(tournaments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const actorId = (session.user as any).id;

  const tournament = await prisma.tournament.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      gameId: data.gameId,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      entryFee: data.entryFee,
      prizePool: data.prizePool,
      prize1st: data.prize1st ?? null,
      prize2nd: data.prize2nd ?? null,
      prize3rd: data.prize3rd ?? null,
      maxParticipants: data.maxParticipants,
      format: data.format as any,
      rules: data.rules ?? null,
      bannerUrl: data.bannerUrl ?? null,
      createdById: actorId,
    },
    include: {
      game: { select: { id: true, name: true, tag: true } },
    }
  });

  return NextResponse.json(tournament, { status: 201 });
}
