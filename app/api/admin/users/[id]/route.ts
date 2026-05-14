import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;

  try {
    // Check if user exists
    const user = await prisma.appUser.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Prevent deleting self
    if (user.id === (session.user as any).id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    // Instead of hard delete, we could deactivate, but user asked for "remove"
    // To be safe with referential integrity (bookings), we'll check if they have bookings
    const bookingsCount = await prisma.booking.count({ where: { userId: id } });
    
    if (bookingsCount > 0) {
      // If they have bookings, just deactivate them
      await prisma.appUser.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: "User has bookings, so they were deactivated instead of deleted" });
    }

    await prisma.appUser.delete({ where: { id } });
    return NextResponse.json({ message: "User removed successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  const body = await req.json();

  try {
    const user = await prisma.appUser.update({
      where: { id },
      data: {
        role: body.role,
        isActive: body.isActive,
      },
    });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
