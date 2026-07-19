import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendBookingNotification } from "@/lib/whatsapp-otp";

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? d : d.slice(-10);
}

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d).replace(/\s+/g, " ");
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      game: { select: { name: true } },
      user: { select: { name: true, phone: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Resolve phone and name (registered user or guest)
  const phone = booking.user?.phone ?? booking.guestPhone ?? null;
  const name = booking.user?.name ?? booking.guestName ?? "Guest";

  if (!phone) {
    return NextResponse.json({ error: "No phone number available for this booking" }, { status: 400 });
  }

  const start = new Date(booking.startDateTime);
  const end = new Date(booking.endDateTime);

  const finalAmt = Number(booking.negotiatedAmount ?? booking.finalAmount ?? 0);

  let paymentLine: string;
  if (booking.paymentStatus === "PAID") {
    paymentLine = `Fully Paid – Rs ${finalAmt.toLocaleString("en-IN")}`;
  } else if (booking.paymentStatus === "PARTIAL") {
    paymentLine = `Partially Paid – Rs ${finalAmt.toLocaleString("en-IN")} total (balance due at venue)`;
  } else {
    paymentLine = `Rs ${finalAmt.toLocaleString("en-IN")} due at venue`;
  }

  const result = await sendBookingNotification({
    phone: formatPhone(phone),
    name,
    gameName: booking.game?.name ?? "Game",
    date: formatDate(start),
    timeRange: formatTimeRange(start, end),
    paymentLine,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Failed to send notification" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

//some text to redeploy