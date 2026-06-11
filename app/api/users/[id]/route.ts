import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(7).optional(),
  email: z.preprocess(
    (val) => (typeof val === "string" ? val.trim().toLowerCase() : val),
    z.string().email().optional().nullable()
  ),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = await prisma.appUser.findUnique({
    where: { id },
    include: {
      bookings: {
        include: { game: { select: { name: true } } },
        orderBy: { startDateTime: "desc" },
        take: 10,
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  if (parsed.data.email) {
    const existingEmail = await prisma.appUser.findFirst({
      where: {
        email: parsed.data.email,
        id: { not: id },
      },
    });
    if (existingEmail) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
  }

  const user = await prisma.appUser.update({ where: { id }, data: parsed.data });
  return NextResponse.json(user);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  await prisma.appUser.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
