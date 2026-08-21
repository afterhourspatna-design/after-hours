import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { relevanceScore, orderByIds } from "@/lib/search-rank";

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6).optional().nullable(),
  notes: z.string().optional().nullable(),
  role: z.enum(["CUSTOMER", "STAFF", "ADMIN"]).default("CUSTOMER"),
  isPhoneVerified: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q");
  const roleFilter = searchParams.get("role") || "CUSTOMER";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const where: any = { role: roleFilter };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  // No search term: keep the original date ordering.
  if (!q) {
    const [users, total] = await Promise.all([
      prisma.appUser.findMany({
        where,
        select: { id: true, name: true, phone: true, email: true, notes: true, isActive: true, createdAt: true, role: true, referredByPhone: true, creditBalances: { include: { applicableGames: { select: { id: true, name: true, tag: true } } } }, referredBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appUser.count({ where }),
    ]);
    return NextResponse.json({ users, total, page, limit });
  }

  // Search term present: rank results by relevance in the database.
  const matched = await prisma.appUser.findMany({ where, select: { id: true } });
  const total = matched.length;
  if (total === 0) {
    return NextResponse.json({ users: [], total: 0, page, limit });
  }

  const matchedIds = matched.map((m) => m.id);
  const ranked = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT u.id FROM "app_users" u
      WHERE u.id IN (${Prisma.join(matchedIds.map((id) => Prisma.sql`${id}`), ", ")})
      ORDER BY
        ${relevanceScore(q, [
          { table: "u", column: "name" },
          { table: "u", column: "phone" },
          { table: "u", column: "email" },
        ])},
        u."createdAt" DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `
  );

  if (ranked.length === 0) {
    return NextResponse.json({ users: [], total, page, limit });
  }

  const rankedIds = ranked.map((r) => r.id);
  const fullUsers = await prisma.appUser.findMany({
    where: { id: { in: rankedIds } },
    select: { id: true, name: true, phone: true, email: true, notes: true, isActive: true, createdAt: true, role: true, referredByPhone: true, creditBalances: { include: { applicableGames: { select: { id: true, name: true, tag: true } } } }, referredBy: { select: { name: true } } },
  });
  const users = orderByIds(fullUsers, rankedIds);

  return NextResponse.json({ users, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actorRole = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(actorRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.appUser.findUnique({ where: { phone: parsed.data.phone } });
  if (existing) return NextResponse.json({ error: "A user with this phone number already exists", existing }, { status: 409 });

  const email = parsed.data.email ? parsed.data.email.trim().toLowerCase() : null;
  if (email) {
    const existingEmail = await prisma.appUser.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
  }

  const passwordHash = parsed.data.password 
    ? await bcrypt.hash(parsed.data.password, 12) 
    : null;

  const user = await prisma.appUser.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email,
      notes: parsed.data.notes ?? null,
      passwordHash,
      role: actorRole === "ADMIN" ? parsed.data.role : "CUSTOMER",
      isPhoneVerified: parsed.data.isPhoneVerified,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
