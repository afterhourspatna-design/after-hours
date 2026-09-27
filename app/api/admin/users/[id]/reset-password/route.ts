import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateTempPassword } from "@/lib/password-generator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const user = await prisma.appUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const generatedPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(generatedPassword, 12);

  await prisma.appUser.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: (session.user as any).id,
      actorName: session.user.name ?? undefined,
      action: "RESET_PASSWORD",
      entityType: "AppUser",
      entityId: id,
    },
  });

  return NextResponse.json({ generatedPassword });
}
