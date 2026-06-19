import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    where: { bookingStatus: { in: ['CONFIRMED', 'COMPLETED'] } },
    select: { paymentStatus: true, finalAmount: true, negotiatedAmount: true, discountAmount: true, couponDiscount: true, basePrice: true, cashAmount: true, onlineAmount: true, paymentMethod: true }
  });
  
  let gross = 0;
  let dis = 0;
  let net = 0;
  let c = 0;
  let o = 0;
  for (const b of bookings) {
    if (b.paymentStatus === 'PAID') {
      const netAmt = Number(b.negotiatedAmount ?? b.finalAmount);
      const standardDiscounts = Number(b.discountAmount) + Number(b.couponDiscount);
      const trueGross = Number(b.finalAmount) + standardDiscounts;
      const manualDiscount = b.negotiatedAmount !== null ? Number(b.finalAmount) - Number(b.negotiatedAmount) : 0;
      gross += trueGross;
      dis += standardDiscounts + manualDiscount;
      net += netAmt;
      
      if (b.paymentMethod === "CASH") c += netAmt;
      else if (b.paymentMethod === "ONLINE") o += netAmt;
      else if (b.paymentMethod === "MIXED") {
        c += Number(b.cashAmount || 0);
        o += Number(b.onlineAmount || 0);
      }
    }
  }
  console.log({ gross, dis, net, c, o, diff: gross - dis - net });
}
main();
