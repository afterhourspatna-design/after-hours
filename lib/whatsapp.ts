import { formatCurrency, formatDate, formatTimeRange } from "./utils";

export interface WhatsAppBookingData {
  guestName: string;
  guestPhone: string;
  gameName: string;
  startDateTime: string | Date;
  durationMinutes: number;
  paymentStatus: string;
  finalAmount: number;
  totalPaid: number;
}

export function generateBookingConfirmationMessage(data: WhatsAppBookingData): string {
  const { guestName, guestPhone, gameName, startDateTime, durationMinutes, paymentStatus, finalAmount, totalPaid } = data;
  
  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  
  const formatterDate = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
  const dateStr = formatterDate.format(start);
  const timeStr = formatTimeRange(start, end);
  
  let paymentText = "";
  if (paymentStatus === "PAID") {
    paymentText = `✅ *Payment:* Fully Paid (${formatCurrency(finalAmount)})`;
  } else if (totalPaid > 0) {
    const due = finalAmount - totalPaid;
    paymentText = `⏳ *Payment:* Advance Paid (${formatCurrency(totalPaid)}) | Due: ${formatCurrency(due)}`;
  } else {
    paymentText = `❌ *Payment:* Unpaid (${formatCurrency(finalAmount)} due at venue)`;
  }

  const message = `🎮 *Booking Confirmed!* 🎮

Hi ${guestName || "Guest"}, get ready to play! 🚀
Your session is locked in at *After Hours*.

🕹️ *Game:* ${gameName}
📅 *Date:* ${dateStr}
⏰ *Time:* ${timeStr}

${paymentText}

Please arrive 5 minutes early to get settled in. See you soon! 👾`;

  return message;
}
