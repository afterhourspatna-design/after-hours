import { NextResponse } from "next/server";

const DISABLED_MESSAGE = "Self-service sign-up isn't available. Please contact an admin or staff member to create your account.";

/** Self-service signup has been disabled; this route is kept only so old
 * clients get a clear error instead of a 404. */
export async function POST() {
  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 403 });
}
