import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const bootstrapSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(7, "Phone number is required"),
  email: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.string().email().optional().nullable()
  ),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function GET() {
  const adminCount = await prisma.appUser.count({ where: { role: "ADMIN" } });
  return NextResponse.json({ setupComplete: adminCount > 0 });
}

export async function POST(req: NextRequest) {
  const adminCount = await prisma.appUser.count({ where: { role: "ADMIN" } });
  if (adminCount > 0) {
    return NextResponse.json({ error: "Setup already complete. Please log in instead." }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bootstrapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, phone, email, password } = parsed.data;

  const existingPhone = await prisma.appUser.findUnique({ where: { phone } });
  if (existingPhone) {
    return NextResponse.json({ error: "A user with this phone number already exists" }, { status: 409 });
  }
  if (email) {
    const existingEmail = await prisma.appUser.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.appUser.create({
    data: { name, phone, email, passwordHash, role: "ADMIN", mustChangePassword: false },
  });

  return NextResponse.json({ message: "Admin account created successfully", userId: user.id }, { status: 201 });
}
