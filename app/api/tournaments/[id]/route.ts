import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "UPCOMING", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  prizePool: z.number().optional(),
  prize1st: z.string().optional().nullable(),
  prize2nd: z.string().optional().nullable(),
  prize3rd: z.string().optional().nullable(),
  rules: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      game: { select: { id: true, name: true, tag: true } },
      participants: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
          payment: true,
        },
        orderBy: { seedNumber: "asc" },
      },
      matches: {
        include: {
          player1: {
            include: { user: { select: { name: true, phone: true } } }
          },
          player2: {
            include: { user: { select: { name: true, phone: true } } }
          },
          winner: {
            include: { user: { select: { name: true, phone: true } } }
          },
        },
        orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
      },
    },
  });

  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  return NextResponse.json(tournament);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.tournament.update({
    where: { id },
    data: parsed.data as any,
    include: {
      game: { select: { id: true, name: true, tag: true } }
    }
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.tournament.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
