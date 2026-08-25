import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Clean Single-Elimination Knockout Generator
 * - Minimizes BYEs: Only awards BYEs when player count is odd (e.g. 10 players -> 5 matches, NO byes!).
 * - Every pair plays each other in Round 1 for maximum fun!
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: { orderBy: { seedNumber: "asc" } }
    }
  });

  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  const N = tournament.participants.length;
  if (N < 2) {
    return NextResponse.json({ error: "At least 2 registered participants are required to generate a bracket" }, { status: 400 });
  }

  // Shuffle participants for randomized pairings
  const participants = [...tournament.participants];
  for (let i = participants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [participants[i], participants[j]] = [participants[j], participants[i]];
  }

  // Delete existing matches for this tournament
  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } });

  // Compute number of rounds needed (e.g., 10 players -> 5 -> 3 -> 2 -> 1 = 4 rounds)
  // Or for 25 players -> 13 -> 7 -> 4 -> 2 -> 1
  let currentRoundCount = N;
  let roundNumber = 1;
  const roundMatchMap: Map<number, any[]> = new Map();

  let activePlayers = [...participants];

  while (activePlayers.length > 1) {
    const matchesInRound = [];
    const nextActivePlayers: any[] = [];
    const numMatches = Math.floor(activePlayers.length / 2);

    for (let i = 0; i < numMatches; i++) {
      const p1 = activePlayers[i * 2];
      const p2 = activePlayers[i * 2 + 1];

      const m = await prisma.tournamentMatch.create({
        data: {
          tournamentId,
          roundNumber,
          matchNumber: i + 1,
          player1Id: p1?.id ?? null,
          player2Id: p2?.id ?? null,
          status: "SCHEDULED",
        }
      });
      matchesInRound.push(m);
    }

    // Handle odd player (BYE) for this round if any
    if (activePlayers.length % 2 !== 0) {
      const byePlayer = activePlayers[activePlayers.length - 1];
      const mBye = await prisma.tournamentMatch.create({
        data: {
          tournamentId,
          roundNumber,
          matchNumber: numMatches + 1,
          player1Id: byePlayer.id,
          winnerId: byePlayer.id,
          status: "BYE",
          completedAt: new Date(),
        }
      });
      matchesInRound.push(mBye);
    }

    roundMatchMap.set(roundNumber, matchesInRound);

    // Prepare next round size
    const nextRoundSize = Math.ceil(activePlayers.length / 2);
    activePlayers = Array.from({ length: nextRoundSize }).map(() => ({ id: null })) as any;
    roundNumber++;
  }

  // Link nextMatchId across consecutive rounds
  const maxRounds = roundNumber - 1;
  for (let r = 1; r < maxRounds; r++) {
    const currentRound = roundMatchMap.get(r)!;
    const nextRound = roundMatchMap.get(r + 1)!;

    for (let i = 0; i < currentRound.length; i++) {
      const nextMatchIndex = Math.floor(i / 2);
      if (nextRound[nextMatchIndex]) {
        await prisma.tournamentMatch.update({
          where: { id: currentRound[i].id },
          data: { nextMatchId: nextRound[nextMatchIndex].id }
        });
      }
    }
  }

  // Update tournament status to IN_PROGRESS
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: "IN_PROGRESS" }
  });

  const finalMatches = await prisma.tournamentMatch.findMany({
    where: { tournamentId },
    include: {
      player1: { include: { user: { select: { name: true } } } },
      player2: { include: { user: { select: { name: true } } } },
      winner: { include: { user: { select: { name: true } } } },
    },
    orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }]
  });

  return NextResponse.json({ success: true, totalRounds: maxRounds, matches: finalMatches });
}
