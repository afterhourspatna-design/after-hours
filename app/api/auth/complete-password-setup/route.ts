import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Sets a new password with no current-password check — only usable while
 * mustChangePassword is true, i.e. right after logging in with a temp/reset
 * password. Reaching this endpoint already proves they know that password
 * (it's how the session was created), so re-entering it would be redundant.
 * The ordinary self-service change-password flow (/api/auth/change-password)
 * still requires the current password, unaffected by this.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  if (!(session.user as any).mustChangePassword) {
    return NextResponse.json({ error: "No password setup pending for this account" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Validation failed" }, { status: 400 });
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.appUser.update({
    where: { id: userId },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      actorName: session.user.name ?? undefined,
      action: "COMPLETE_PASSWORD_SETUP",
      entityType: "AppUser",
      entityId: userId,
    },
  });

  return NextResponse.json({ success: true });
}
