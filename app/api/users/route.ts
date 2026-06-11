import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6).optional().nullable(),
  notes: z.string().optional().nullable(),
  role: z.enum(["CUSTOMER", "STAFF", "ADMIN"]).default("CUSTOMER"),
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

  const [users, total] = await Promise.all([
    prisma.appUser.findMany({
      where,
      select: { id: true, name: true, phone: true, email: true, notes: true, isActive: true, createdAt: true, role: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.appUser.count({ where }),
  ]);

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
    },
  });

  return NextResponse.json(user, { status: 201 });
}
