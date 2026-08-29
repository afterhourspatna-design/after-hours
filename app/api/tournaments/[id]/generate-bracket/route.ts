import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  const body = await req.json().catch(() => ({}));
  const customPairings: { p1Id: string; p2Id?: string }[] | null = body?.customPairings || null;

  // Order or shuffle participants
  let participants = [...tournament.participants];
  if (!customPairings) {
    // Fisher-Yates shuffle for randomized pairings
    for (let i = participants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [participants[i], participants[j]] = [participants[j], participants[i]];
    }
  }

  // Delete existing matches for this tournament
  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } });

  let activePlayers: any[] = [];
  if (customPairings && Array.isArray(customPairings) && customPairings.length > 0) {
    // Map custom pairings
    for (const pair of customPairings) {
      const p1 = participants.find(p => p.id === pair.p1Id);
      const p2 = pair.p2Id ? participants.find(p => p.id === pair.p2Id) : null;
      if (p1) activePlayers.push(p1);
      if (p2) activePlayers.push(p2);
    }
    // Include any unassigned participants at the end
    const assignedIds = new Set(activePlayers.map(p => p.id));
    const unassigned = participants.filter(p => !assignedIds.has(p.id));
    activePlayers.push(...unassigned);
  } else {
    activePlayers = [...participants];
  }

  let roundNumber = 1;
  const roundMatchMap: Map<number, any[]> = new Map();

  while (activePlayers.length > 1) {
    const matchesInRound = [];
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
