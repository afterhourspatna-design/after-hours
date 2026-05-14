import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const gameId = searchParams.get("gameId");

  const units = await prisma.resourceUnit.findMany({
    where: { ...(gameId ? { gameId } : {}), isActive: true },
    include: { game: { select: { name: true, tag: true } } },
    orderBy: { unitName: "asc" },
  });
  return NextResponse.json(units);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const unit = await prisma.resourceUnit.create({ data: body });
  return NextResponse.json(unit, { status: 201 });
}
