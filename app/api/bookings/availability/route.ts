import { NextRequest, NextResponse } from "next/server";
import { checkAvailability, suggestAvailableUnit } from "@/lib/booking-helpers";
import { auth } from "@/auth";
import { z } from "zod";
import { addMinutes } from "date-fns";

const schema = z.object({
  resourceUnitId: z.string().optional(),
  gameId: z.string().optional(),
  startDateTime: z.string().datetime(),
  durationMinutes: z.number().min(5),
  excludeBookingId: z.string().optional(),
}).refine(data => data.resourceUnitId || data.gameId, {
  message: "Either resourceUnitId or gameId must be provided",
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const parsed = schema.safeParse({
    resourceUnitId: searchParams.get("resourceUnitId") ?? undefined,
    gameId: searchParams.get("gameId") ?? undefined,
    startDateTime: searchParams.get("startDateTime"),
    durationMinutes: parseInt(searchParams.get("durationMinutes") ?? "60"),
    excludeBookingId: searchParams.get("excludeBookingId") ?? undefined,
  });

  if (!parsed.success) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  const { resourceUnitId, gameId, startDateTime, durationMinutes, excludeBookingId } = parsed.data;
  const start = new Date(startDateTime);
  const end = addMinutes(start, durationMinutes);

  if (resourceUnitId) {
    const result = await checkAvailability({ resourceUnitId, startDateTime: start, endDateTime: end, excludeBookingId });
    return NextResponse.json(result);
  } else if (gameId) {
    const suggested = await suggestAvailableUnit({ gameId, startDateTime: start, endDateTime: end, excludeBookingId });
    return NextResponse.json({ available: !!suggested });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
