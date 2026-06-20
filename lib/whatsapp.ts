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
  
  const dateStr = formatDate(startDateTime);
  const timeStr = formatTimeRange(startDateTime, durationMinutes);
  
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
