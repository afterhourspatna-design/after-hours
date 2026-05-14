import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "No password set for this account" }, { status: 400 });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.appUser.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      actorName: session.user.name ?? undefined,
      action: "CHANGE_PASSWORD",
      entityType: "AppUser",
      entityId: userId,
    },
  });

  return NextResponse.json({ success: true });
}
