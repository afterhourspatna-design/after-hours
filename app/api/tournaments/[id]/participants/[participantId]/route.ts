import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: tournamentId, participantId } = await params;
  const body = await req.json();

  const participant = await prisma.tournamentParticipant.findUnique({
    where: { id: participantId },
  });

  if (!participant || participant.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const updated = await prisma.tournamentParticipant.update({
    where: { id: participantId },
    data: {
      playerName: body.playerName ?? undefined,
      playerPhone: body.playerPhone ?? undefined,
      seedNumber: body.seedNumber != null ? Number(body.seedNumber) : undefined,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: tournamentId, participantId } = await params;

  const participant = await prisma.tournamentParticipant.findUnique({
    where: { id: participantId },
  });

  if (!participant || participant.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  // Remove participant
  await prisma.tournamentParticipant.delete({
    where: { id: participantId },
  });

  return NextResponse.json({ success: true });
}
