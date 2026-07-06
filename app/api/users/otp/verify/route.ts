import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const verifySchema = z.object({
  phone: z.string().length(10, "Phone number must be exactly 10 digits"),
  code: z.string().min(4, "OTP must be at least 4 digits"),
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
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { phone, code } = parsed.data;

    const record = await prisma.otpVerification.findUnique({
      where: { phone }
    });

    if (!record) {
      return NextResponse.json({ verified: false, error: "No verification code exists for this number" }, { status: 400 });
    }

    if (record.code !== code) {
      return NextResponse.json({ verified: false, error: "Incorrect OTP code. Please check and try again" }, { status: 400 });
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ verified: false, error: "Verification code has expired. Please request a new one" }, { status: 400 });
    }

    // Delete verification record on successful verification to prevent reuse
    await prisma.otpVerification.delete({
      where: { phone }
    });

    return NextResponse.json({ verified: true });
  } catch (error: any) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
