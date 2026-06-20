-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentId" TEXT NOT NULL,
    "bookingId" TEXT,
    "snackOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- Data Migration: Preserve existing Payment connections!
-- We insert a payment allocation for every booking and snack order that currently has a paymentId.
INSERT INTO "payment_allocations" ("id", "amount", "paymentId", "bookingId")
SELECT 
  gen_random_uuid(),
  "finalAmount",
  "paymentId",
  "id"
FROM "bookings"
WHERE "paymentId" IS NOT NULL;

INSERT INTO "payment_allocations" ("id", "amount", "paymentId", "snackOrderId")
SELECT 
  gen_random_uuid(),
  "amount",
  "paymentId",
  "id"
FROM "snack_orders"
WHERE "paymentId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "snack_orders" DROP CONSTRAINT "snack_orders_paymentId_fkey";

-- DropIndex
DROP INDEX "snack_orders_paymentId_idx";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "cashAmount",
DROP COLUMN "onlineAmount",
DROP COLUMN "paymentId",
DROP COLUMN "paymentMethod";

-- AlterTable
ALTER TABLE "snack_orders" DROP COLUMN "paymentId";

-- CreateIndex
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocations_bookingId_idx" ON "payment_allocations"("bookingId");

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_snackOrderId_fkey" FOREIGN KEY ("snackOrderId") REFERENCES "snack_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
