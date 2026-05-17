import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkAvailability } from "@/lib/booking-helpers";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { addMinutes } from "date-fns";
import { z } from "zod";

const updateSchema = z.object({
  bookingStatus: z.nativeEnum(BookingStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  notes: z.string().optional().nullable(),
  startDateTime: z.string().datetime().optional(),
  durationMinutes: z.number().min(15).optional(),
  resourceUnitId: z.string().optional().nullable(),
  finalAmount: z.number().optional(),
  source: z.string().optional(),
  action: z.enum(["CHECK_IN", "CHECK_OUT"]).optional(),
});

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      game: true,
      resourceUnit: true,
      user: { select: { id: true, name: true, phone: true, email: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;
  const updateData: any = { ...data };
  delete updateData.action;

  if (data.action === "CHECK_IN") {
    updateData.startDateTime = new Date();
  } else if (data.action === "CHECK_OUT") {
    updateData.endDateTime = new Date();
    updateData.durationMinutes = Math.max(15, Math.ceil((updateData.endDateTime.getTime() - existing.startDateTime.getTime()) / 60000));
    updateData.bookingStatus = BookingStatus.COMPLETED;
  } else if (data.startDateTime && data.durationMinutes) {
    const newStart = new Date(data.startDateTime);
    const newEnd = addMinutes(newStart, data.durationMinutes);
    const unitId = data.resourceUnitId ?? existing.resourceUnitId;
    if (unitId) {
      const { available, conflictingBooking } = await checkAvailability({
        resourceUnitId: unitId,
        startDateTime: newStart,
        endDateTime: newEnd,
        excludeBookingId: id,
      });
      if (!available) {
        return NextResponse.json({
          error: "Unit is already booked for this time",
          conflict: conflictingBooking,
        }, { status: 409 });
      }
    }
    updateData.endDateTime = newEnd;
  }

  if (role === "STAFF" && !data.action) {
    const allowedStaffStatuses: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.CANCELLED];
    if (data.bookingStatus && !allowedStaffStatuses.includes(data.bookingStatus as BookingStatus)) {
      return NextResponse.json({ error: "Staff can only confirm or cancel bookings" }, { status: 403 });
    }
    delete updateData.startDateTime;
    delete updateData.durationMinutes;
    delete updateData.endDateTime;
    delete updateData.resourceUnitId;
    delete updateData.finalAmount;
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: updateData,
    include: {
      game: { select: { name: true, tag: true } },
      resourceUnit: { select: { unitName: true } },
      user: { select: { name: true, phone: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: (session.user as any).id,
      actorName: session.user.name ?? undefined,
      action: "UPDATE_BOOKING",
      entityType: "Booking",
      entityId: booking.id,
      meta: { changes: data },
    },
  });

  return NextResponse.json(booking);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  await prisma.booking.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
