import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateOtp, sendWhatsAppOtp } from "@/lib/whatsapp-otp";
import { z } from "zod";

const sendSchema = z.object({
  phone: z.string().length(10, "Phone number must be exactly 10 digits"),
});

export async function POST(req: NextRequest) {
  // Authenticate session
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
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { phone } = parsed.data;

    // Check if the phone is already in use
    const existingUser = await prisma.appUser.findUnique({
      where: { phone }
    });
    if (existingUser) {
      return NextResponse.json({ error: "A user with this phone number already exists" }, { status: 409 });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Upsert verification code details in database
    await prisma.otpVerification.upsert({
      where: { phone },
      update: { code: otp, expiresAt },
      create: { phone, code: otp, expiresAt }
    });

    // Fire sending logic helper
    const sent = await sendWhatsAppOtp(phone, otp);
    if (!sent) {
      return NextResponse.json({ error: "Failed to dispatch WhatsApp OTP message" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "OTP sent successfully" });
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
