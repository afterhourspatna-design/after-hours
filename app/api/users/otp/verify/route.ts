import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyMsg91Otp } from "@/lib/whatsapp-otp";
import { z } from "zod";

const verifySchema = z.object({
  phone: z.string().length(10, "Phone number must be exactly 10 digits"),
  code: z.string().min(4, "OTP must be at least 4 digits"),
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
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { phone, code } = parsed.data;

    // MSG91 verifies the OTP on their side — no DB lookup needed
    const result = await verifyMsg91Otp(phone, code);
    if (!result.verified) {
      return NextResponse.json(
        { verified: false, error: result.error ?? "Incorrect or expired OTP" },
        { status: 400 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error: any) {
    console.error("Error in /api/users/otp/verify:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
