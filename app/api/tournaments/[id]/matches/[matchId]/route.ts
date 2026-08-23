import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const matchUpdateSchema = z.object({
  scoreP1: z.number().int().min(0),
  scoreP2: z.number().int().min(0),
  winnerId: z.string().min(1, "Winner is required"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: tournamentId, matchId } = await params;
  const body = await req.json();
  const parsed = matchUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { scoreP1, scoreP2, winnerId } = parsed.data;

  const currentMatch = await prisma.tournamentMatch.findUnique({
    where: { id: matchId }
  });

  if (!currentMatch || currentMatch.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Update current match
  const updatedMatch = await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: {
      scoreP1,
      scoreP2,
      winnerId,
      status: "COMPLETED",
      completedAt: new Date(),
    },
    include: {
      player1: { include: { user: { select: { name: true } } } },
      player2: { include: { user: { select: { name: true } } } },
      winner: { include: { user: { select: { name: true } } } },
    }
  });

  // Advance winner to next match if applicable
  if (currentMatch.nextMatchId) {
    const nextMatch = await prisma.tournamentMatch.findUnique({
      where: { id: currentMatch.nextMatchId }
    });

    if (nextMatch) {
      // Determine if winner becomes Player 1 or Player 2 in next match
      // If matchNumber is odd -> Player 1, if even -> Player 2
      const isPlayer1Position = currentMatch.matchNumber % 2 !== 0;

      await prisma.tournamentMatch.update({
        where: { id: currentMatch.nextMatchId },
        data: isPlayer1Position ? { player1Id: winnerId } : { player2Id: winnerId }
      });
    }
  } else {
    // This was the Grand Final! Mark tournament as COMPLETED
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "COMPLETED" }
    });
  }

  return NextResponse.json(updatedMatch);
}
