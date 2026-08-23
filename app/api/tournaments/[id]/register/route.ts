import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const registerSchema = z.object({
  userId: z.string().optional().nullable(),
  playerName: z.string().optional().nullable(),
  playerPhone: z.string().optional().nullable(),
  playerEmail: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "ONLINE", "CREDITS", "FREE"]).default("FREE"),
  paidAmount: z.number().min(0).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tournamentId } = await params;
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { _count: { select: { participants: true } } }
  });

  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  if (tournament._count.participants >= tournament.maxParticipants) {
    return NextResponse.json({ error: "Tournament capacity reached" }, { status: 400 });
  }

  // Resolve user
  let resolvedUserId = data.userId ?? null;
  let resolvedName = data.playerName ?? null;
  let resolvedPhone = data.playerPhone ?? null;

  if (!resolvedUserId && resolvedPhone) {
    let existingUser = await prisma.appUser.findUnique({ where: { phone: resolvedPhone } });
    if (!existingUser) {
      existingUser = await prisma.appUser.create({
        data: {
          name: resolvedName || "Tournament Player",
          phone: resolvedPhone,
          email: data.playerEmail || null,
          role: "CUSTOMER",
        }
      });
    }
    resolvedUserId = existingUser.id;
    resolvedName = existingUser.name;
  } else if (resolvedUserId && (!resolvedName || !resolvedPhone)) {
    const usr = await prisma.appUser.findUnique({ where: { id: resolvedUserId } });
    if (usr) {
      resolvedName = usr.name;
      resolvedPhone = usr.phone;
    }
  }

  // Check if already registered
  if (resolvedUserId) {
    const existingEntry = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: resolvedUserId } }
    });
    if (existingEntry) {
      return NextResponse.json({ error: "Player already registered in this tournament" }, { status: 409 });
    }
  }

  // Handle entry fee payment if required
  let paymentId: string | null = null;
  const entryFeeNum = Number(tournament.entryFee);
  const paidAmt = data.paidAmount ?? entryFeeNum;

  if (entryFeeNum > 0 && data.paymentMethod !== "FREE" && paidAmt > 0) {
    const payment = await prisma.payment.create({
      data: {
        paymentMethod: data.paymentMethod,
        negotiatedAmount: paidAmt,
        cashAmount: data.paymentMethod === "CASH" ? paidAmt : 0,
        onlineAmount: data.paymentMethod === "ONLINE" ? paidAmt : 0,
        userId: resolvedUserId,
        customerNames: resolvedName || "Tournament Entry",
      }
    });
    paymentId = payment.id;
  }

  const nextSeed = tournament._count.participants + 1;

  const participant = await prisma.tournamentParticipant.create({
    data: {
      tournamentId,
      userId: resolvedUserId,
      playerName: resolvedName,
      playerPhone: resolvedPhone,
      playerEmail: data.playerEmail ?? null,
      seedNumber: nextSeed,
      paymentId,
      isPaid: entryFeeNum === 0 || paidAmt >= entryFeeNum,
    },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      payment: true,
    }
  });

  return NextResponse.json(participant, { status: 201 });
}
