import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resendMsg91Otp } from "@/lib/whatsapp-otp";
import { z } from "zod";

const schema = z.object({
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
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await resendMsg91Otp(parsed.data.phone);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to resend OTP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "OTP resent via WhatsApp" });
  } catch (error: any) {
    console.error("Error in /api/users/otp/resend:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
