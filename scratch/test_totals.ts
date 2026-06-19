import { PrismaClient, BookingStatus } from '@prisma/client';
import { subDays, eachDayOfInterval } from 'date-fns';

const prisma = new PrismaClient();

function getISTStartOfDay(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === "year")!.value, 10);
  const month = parseInt(parts.find(p => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === "day")!.value, 10);

  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
}

function formatInIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === "year")!.value;
  const month = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

async function main() {
  const days = 30;
  const now = new Date();
  const todayStartIST = getISTStartOfDay(now);
  const since = subDays(todayStartIST, days - 1);

  const bookings = await prisma.booking.findMany({
    where: {
      startDateTime: { gte: since },
      bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    select: { 
      id: true,
      startDateTime: true, 
      finalAmount: true, 
      negotiatedAmount: true, 
      paymentStatus: true, 
      paymentMethod: true,
      cashAmount: true,
      onlineAmount: true,
    },
  });

  const standaloneSnacks = await prisma.snackOrder.findMany({
    where: {
      createdAt: { gte: since },
    },
    select: { 
      createdAt: true, 
      amount: true,
      paymentStatus: true,
      payment: {
        select: {
          paymentMethod: true,
          cashAmount: true,
          onlineAmount: true
        }
      }
    }
  });

  const dayMap: Record<string, { game: number; snacks: number }> = {};
  const interval = eachDayOfInterval({ start: since, end: now });
  for (const day of interval) {
    dayMap[formatInIST(day)] = { game: 0, snacks: 0 };
  }
  
  let netFromBookings = 0;
  let netFromSnacks = 0;
  
  let cashFromBookings = 0;
  let cashFromSnacks = 0;
  
  let onlineFromBookings = 0;
  let onlineFromSnacks = 0;

  for (const b of bookings) {
    const key = formatInIST(b.startDateTime);
    if (!(key in dayMap)) continue;

    if (b.paymentStatus === "PAID") {
      const netAmt = Number(b.negotiatedAmount ?? b.finalAmount);
      dayMap[key].game += netAmt;
      netFromBookings += netAmt;
      
      if (b.paymentMethod === "CASH") cashFromBookings += netAmt;
      else if (b.paymentMethod === "ONLINE") onlineFromBookings += netAmt;
      else if (b.paymentMethod === "MIXED") {
        cashFromBookings += Number(b.cashAmount || 0);
        onlineFromBookings += Number(b.onlineAmount || 0);
      } else {
        // Fallback?
      }
    }
  }

  for (const s of standaloneSnacks) {
    const key = formatInIST(s.createdAt);
    if (!(key in dayMap)) continue;

    dayMap[key].snacks += Number(s.amount);
    
    if (s.paymentStatus === "PAID" || Number(s.amount) > 0) {
      netFromSnacks += Number(s.amount);
      if (s.payment?.paymentMethod === "CASH") cashFromSnacks += Number(s.amount);
      else if (s.payment?.paymentMethod === "ONLINE") onlineFromSnacks += Number(s.amount);
      else if (s.payment?.paymentMethod === "MIXED") {
        cashFromSnacks += Number(s.payment.cashAmount || 0);
        onlineFromSnacks += Number(s.payment.onlineAmount || 0);
      } else {
        cashFromSnacks += Number(s.amount);
      }
    }
  }

  console.log({
    netFromBookings,
    netFromSnacks,
    totalNet: netFromBookings + netFromSnacks,
    cashTotal: cashFromBookings + cashFromSnacks,
    onlineTotal: onlineFromBookings + onlineFromSnacks,
    sumCashOnline: cashFromBookings + cashFromSnacks + onlineFromBookings + onlineFromSnacks
  });
}
main();
