import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendMsg91Otp } from "@/lib/whatsapp-otp";
import { z } from "zod";

const sendSchema = z.object({
  phone: z.string().length(10, "Phone number must be exactly 10 digits"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorRole = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(actorRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { phone } = parsed.data;

    // Block if phone already registered
    const existingUser = await prisma.appUser.findUnique({ where: { phone } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this phone number already exists" },
        { status: 409 }
      );
    }

    // MSG91 handles OTP generation & delivery — no DB storage needed
    const result = await sendMsg91Otp(phone);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to send OTP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "OTP sent via WhatsApp" });
  } catch (error: any) {
    console.error("Error in /api/users/otp/send:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
