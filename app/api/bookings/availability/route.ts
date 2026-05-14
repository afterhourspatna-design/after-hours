import { NextRequest, NextResponse } from "next/server";
import { checkAvailability } from "@/lib/booking-helpers";
import { auth } from "@/auth";
import { z } from "zod";
import { addMinutes } from "date-fns";

const schema = z.object({
  resourceUnitId: z.string(),
  startDateTime: z.string().datetime(),
  durationMinutes: z.number().min(15),
  excludeBookingId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const parsed = schema.safeParse({
    resourceUnitId: searchParams.get("resourceUnitId"),
    startDateTime: searchParams.get("startDateTime"),
    durationMinutes: parseInt(searchParams.get("durationMinutes") ?? "60"),
    excludeBookingId: searchParams.get("excludeBookingId") ?? undefined,
  });

  if (!parsed.success) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  const { resourceUnitId, startDateTime, durationMinutes, excludeBookingId } = parsed.data;
  const start = new Date(startDateTime);
  const end = addMinutes(start, durationMinutes);

  const result = await checkAvailability({ resourceUnitId, startDateTime: start, endDateTime: end, excludeBookingId });
  return NextResponse.json(result);
}
