-- RenameEnum (ExpensePaymentMode -> FundSource; shared by expenses, opening balances, and transfers)
ALTER TYPE "ExpensePaymentMode" RENAME TO "FundSource";

-- CreateTable
CREATE TABLE "daily_opening_balances" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" "FundSource" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "setById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_transactions" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fromSource" "FundSource" NOT NULL,
    "toSource" "FundSource" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fund_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_opening_balances_date_idx" ON "daily_opening_balances"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_opening_balances_date_source_key" ON "daily_opening_balances"("date", "source");

-- CreateIndex
CREATE INDEX "fund_transactions_date_idx" ON "fund_transactions"("date");

-- CreateIndex
CREATE INDEX "fund_transactions_fromSource_idx" ON "fund_transactions"("fromSource");

-- CreateIndex
CREATE INDEX "fund_transactions_toSource_idx" ON "fund_transactions"("toSource");

-- AddForeignKey
ALTER TABLE "daily_opening_balances" ADD CONSTRAINT "daily_opening_balances_setById_fkey" FOREIGN KEY ("setById") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_transactions" ADD CONSTRAINT "fund_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
