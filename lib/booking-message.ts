import { formatTimeRange } from "./utils";

export interface BookingMessageData {
  guestName: string;
  guestPhone: string;
  gameName: string;
  unitName?: string | null;
  startDateTime: string | Date;
  durationMinutes: number;
  paymentStatus: string;
  finalAmount: number;
  totalPaid: number;
}

function formatRupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatMobile(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone;
}

export function generateBookingConfirmationMessage(data: BookingMessageData): string {
  const { guestName, guestPhone, gameName, unitName, startDateTime, durationMinutes, paymentStatus, finalAmount, totalPaid } = data;

  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const formatterDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });
  const dateStr = formatterDate.format(start);
  const timeStr = formatTimeRange(start, end);

  const paymentLines: string[] = [];
  if (paymentStatus === "PAID") {
    paymentLines.push(`💳 *Payment Status:* Fully Paid`);
  } else if (totalPaid > 0) {
    paymentLines.push(`💳 *Payment Status:* Partially Paid`);
  } else {
    paymentLines.push(`💳 *Payment Status:* Unpaid`);
  }

  paymentLines.push(`💰 *Total Amount:* ${formatRupees(finalAmount)}`);

  if (paymentStatus === "PAID") {
    paymentLines.push(`✅ *Paid:* ${formatRupees(finalAmount)}`);
  } else if (totalPaid > 0) {
    const due = finalAmount - totalPaid;
    paymentLines.push(`✅ *Paid:* ${formatRupees(totalPaid)}`);
    paymentLines.push(`🔴 *Balance Due:* ${formatRupees(due)} — Payable at the venue`);
  } else {
    paymentLines.push(`🔴 *Balance Due:* ${formatRupees(finalAmount)} — Payable at the venue`);
  }

  const mobileLine = guestPhone ? `📱 *Mobile:* ${formatMobile(guestPhone)}\n\n` : "";
  const couponNote = `\n\n_Note: Coupons are applied at the time of final payment._`;
  const gameLabel = unitName || gameName;

  const message = `🎮 *BOOKING CONFIRMED!*

Hi *${guestName || "Guest"}*! 👋
Your session at *AFTER HOURS* is confirmed. Get ready to play! 🔥

${mobileLine}🎯 *Game:* ${gameLabel}
📅 *Date:* ${dateStr}
⏰ *Time:* ${timeStr}

${paymentLines.join("\n")}${couponNote}

⏱️ Please arrive *5 minutes early* so we can get your session started on time.

See you at *AFTER HOURS*! 🎮🔥`;

  return message;
}
