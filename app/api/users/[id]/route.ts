import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resolveReferrer } from "@/lib/referral";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(7).optional(),
  email: z.preprocess(
    (val) => {
      if (typeof val !== "string") return val;
      const trimmed = val.trim().toLowerCase();
      return trimmed === "" ? null : trimmed;
    },
    z.string().email().optional().nullable()
  ),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  referredBy: z.string().optional().nullable(),
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
      creditBalances: { include: { applicableGames: { select: { id: true, name: true, tag: true } } } },
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

  const { referredBy, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };

  if (referredBy !== undefined) {
    const target = await prisma.appUser.findUnique({ where: { id }, select: { role: true } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (target.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can have a referrer" }, { status: 400 });
    }
    if (!referredBy || !referredBy.trim()) {
      data.referredById = null;
      data.referredByPhone = null;
    } else {
      try {
        const referrer = await resolveReferrer(referredBy);
        data.referredById = referrer?.id ?? null;
        data.referredByPhone = referrer?.phone ?? null;
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }
  }

  const user = await prisma.appUser.update({ where: { id }, data });
  return NextResponse.json(user);
}
