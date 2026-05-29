import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔌 Connecting to database to update PS5 accessories...");
  
  const ps5 = await prisma.game.update({
    where: { tag: "ps5" },
    data: {
      hasAccessories: true,
      defaultAccessories: 2,
      maxAccessories: 4,
      accessoryPrice: 25.00,
    },
  });
  
  console.log("✅ PS5 accessories configuration successfully updated directly in database!", ps5);
}

main()
  .catch((e) => {
    console.error("❌ Failed to update PS5 accessories in database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
