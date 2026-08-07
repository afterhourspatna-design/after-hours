/**
 * Safe production script to add PS4 game + unit to database.
 * - Checks if PS4 already exists (idempotent)
 * - Never deletes or modifies existing data
 * - Run after: vercel env pull .env.production
 *
 * Usage:
 *   DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d'=' -f2-)" npx tsx scripts/add-ps4-production.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking if PS4 already exists in production database...");

  const existing = await prisma.game.findUnique({
    where: { tag: "ps4" },
    include: { resourceUnits: true }
  });

  if (existing) {
    console.log("✅ PS4 already exists in production, skipping creation.");
    console.log(`   ID: ${existing.id}`);
    console.log(`   Name: ${existing.name}`);
    console.log(`   Tag: ${existing.tag}`);
    console.log(`   Units: ${existing.resourceUnits.length}`);
    existing.resourceUnits.forEach(u => console.log(`     - ${u.unitName} (${u.id})`));
    return;
  }

  console.log("➕ Creating PS4 game...");

  const ps4 = await prisma.game.create({
    data: {
      name: "PS4",
      tag: "ps4",
      description: "PlayStation 4 gaming station",
      basePrice: 100,
      minTimeMinutes: 30,
      maxTimeMinutes: 60,
      deposit: 500,
      isActive: true,
      totalUnits: 1,
      hasAccessories: true,
      defaultAccessories: 1,
      maxAccessories: 2,
      accessoryPrice: 20,
    },
  });

  console.log(`✅ PS4 game created: ${ps4.id}`);

  console.log("➕ Creating PS4 resource unit...");

  const unit = await prisma.resourceUnit.create({
    data: {
      gameId: ps4.id,
      unitName: "PS4 - Unit 1",
      isActive: true,
    },
  });

  console.log(`✅ PS4 unit created: ${unit.id}`);
  console.log("🎉 Done! PS4 is now in production database.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });