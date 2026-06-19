import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existingOrders = await prisma.snackOrder.findMany({
    where: { amount: { gt: 0 } },
    include: { items: true }
  });

  let count = 0;

  for (const order of existingOrders) {
    if (order.items.length === 0) {
      await prisma.snackOrderItem.create({
        data: {
          snackOrderId: order.id,
          amount: order.amount,
          notes: "Initial Amount",
          createdAt: order.createdAt // preserving the original date!
        }
      });
      count++;
    }
  }

  console.log(`Backfilled ${count} existing snack orders with an initial history item.`);
}

main().catch(console.error);
