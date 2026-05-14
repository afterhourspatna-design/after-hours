import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  tag: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional().nullable(),
  basePrice: z.number().positive(),
  minTimeMinutes: z.number().default(30),
  maxTimeMinutes: z.number().default(120),
  deposit: z.number().optional().nullable(),
  isActive: z.boolean().default(true),
  totalUnits: z.number().min(1).max(20).default(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const games = await prisma.game.findMany({
    include: {
      resourceUnits: { where: { isActive: true }, select: { id: true, unitName: true, isActive: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(games);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

  const { totalUnits, ...gameData } = parsed.data;

  // Check if tag already exists
  const existing = await prisma.game.findUnique({ where: { tag: parsed.data.tag } });
  if (existing) return NextResponse.json({ error: "A game with this tag already exists" }, { status: 409 });

  const game = await prisma.game.create({
    data: {
      ...gameData,
      totalUnits,
      resourceUnits: {
        create: Array.from({ length: totalUnits }).map((_, i) => ({
          unitName: `${parsed.data.name} Unit ${i + 1}`,
          isActive: true,
        })),
      },
    },
  });

  return NextResponse.json(game, { status: 201 });
}
