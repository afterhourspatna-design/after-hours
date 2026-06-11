import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const secret = searchParams.get("secret");

  if (secret !== "afterhours_migrate_2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.appUser.findMany({
      where: {
        email: {
          endsWith: "@afterhours.pk",
        },
      },
    });

    const updated = [];
    for (const user of users) {
      if (user.email) {
        const newEmail = user.email.replace("@afterhours.pk", "@afterhours.in");
        await prisma.appUser.update({
          where: { id: user.id },
          data: { email: newEmail },
        });
        updated.push({ name: user.name, from: user.email, to: newEmail });
      }
    }

    return NextResponse.json({ success: true, updatedCount: updated.length, updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
