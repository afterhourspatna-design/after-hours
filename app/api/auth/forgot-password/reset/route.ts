import { NextResponse } from "next/server";

const DISABLED_MESSAGE = "Self-service password reset isn't available. Please contact an admin or staff member to reset your password.";

/** Self-service password reset has been disabled; this route is kept only so
 * old clients get a clear error instead of a 404. */
export async function POST() {
  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 403 });
}
