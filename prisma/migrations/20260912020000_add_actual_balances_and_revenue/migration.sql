-- RenameTable (DailyOpeningBalance -> DailyActualBalance: now represents a
-- manually-reconciled ACTUAL closing balance for a date, which becomes the
-- following date's opening, distinct from the system's calculated closing)
ALTER TABLE "daily_opening_balances" RENAME TO "daily_actual_balances";

ALTER TABLE "daily_actual_balances" RENAME CONSTRAINT "daily_opening_balances_pkey" TO "daily_actual_balances_pkey";
ALTER TABLE "daily_actual_balances" RENAME CONSTRAINT "daily_opening_balances_setById_fkey" TO "daily_actual_balances_setById_fkey";

ALTER INDEX "daily_opening_balances_date_idx" RENAME TO "daily_actual_balances_date_idx";
ALTER INDEX "daily_opening_balances_date_source_key" RENAME TO "daily_actual_balances_date_source_key";
