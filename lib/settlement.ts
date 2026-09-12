import { prisma } from "@/lib/prisma";
import { FundSource } from "@prisma/client";

export const FUND_SOURCES: FundSource[] = ["COUNTER", "HOUSE", "BANK"];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Parses a "YYYY-MM-DD" string into a UTC-midnight Date — the canonical
 * representation for admin-entered calendar dates (expenses, transfers,
 * actual balances) throughout the settlement ledger. */
export function toDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Maps a calendar-date marker (as produced by toDateOnly) to the actual UTC
 * instant range covering that IST business day — used to bucket Payment
 * timestamps (an auto-recorded wall-clock time) into the same calendar-date
 * key that expenses/transfers/actual-balances are explicitly entered under. */
function istDayBounds(dateOnly: Date) {
  const y = dateOnly.getUTCFullYear();
  const m = dateOnly.getUTCMonth();
  const d = dateOnly.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS),
    end: new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS),
  };
}

/** Revenue mapping: cash collections land in COUNTER, online/UPI collections
 * land in BANK. HOUSE has no direct revenue channel (it only moves via
 * transfers), so it always returns 0. */
async function getRevenue(source: FundSource, from: Date | null, to: Date): Promise<number> {
  if (source === "HOUSE") return 0;

  const createdAtFilter: any = { lte: istDayBounds(to).end };
  if (from) createdAtFilter.gte = istDayBounds(from).start;

  const agg = await prisma.payment.aggregate({
    where: { createdAt: createdAtFilter },
    _sum: { cashAmount: true, onlineAmount: true },
  });

  return source === "COUNTER" ? Number(agg._sum.cashAmount ?? 0) : Number(agg._sum.onlineAmount ?? 0);
}

interface DayEffects {
  revenue: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
}

async function getDayEffects(source: FundSource, from: Date | null, to: Date): Promise<DayEffects> {
  const dateFilter: any = { lte: to };
  if (from) dateFilter.gte = from;

  const [expenseAgg, inAgg, outAgg, revenue] = await Promise.all([
    prisma.expense.aggregate({ where: { paymentMode: source, date: dateFilter }, _sum: { amount: true } }),
    prisma.fundTransaction.aggregate({ where: { toSource: source, date: dateFilter }, _sum: { amount: true } }),
    prisma.fundTransaction.aggregate({ where: { fromSource: source, date: dateFilter }, _sum: { amount: true } }),
    getRevenue(source, from, to),
  ]);

  return {
    revenue,
    expenses: Number(expenseAgg._sum.amount ?? 0),
    transfersIn: Number(inAgg._sum.amount ?? 0),
    transfersOut: Number(outAgg._sum.amount ?? 0),
  };
}

function netOf(e: DayEffects): number {
  return e.revenue - e.expenses + e.transfersIn - e.transfersOut;
}

export interface SourceBreakdown {
  source: FundSource;
  opening: number;
  openingAnchorDate: string | null;
  revenue: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
  calculatedClosing: number;
  actualClosing: number | null;
  difference: number | null;
}

/**
 * Opening(date) = the latest manually-entered ACTUAL closing balance strictly
 * before `date`, rolled forward by every subsequent day's CALCULATED net
 * effect (revenue - expenses +- transfers) up to the day before `date` —
 * because only days with no actual entry fall back to the calculated figure.
 * With no actual entry ever set, opening defaults to 0 from the beginning.
 *
 * CalculatedClosing(date) = opening + today's net effect — the "expected" balance.
 * ActualClosing(date) = whatever the admin has manually reconciled for `date`
 * itself (if anything) — this is what becomes tomorrow's opening.
 * Difference = actual - calculated, surfaced only when an actual exists.
 */
export async function getSourceBreakdown(date: Date, source: FundSource): Promise<SourceBreakdown> {
  const anchor = await prisma.dailyActualBalance.findFirst({
    where: { source, date: { lt: date } },
    orderBy: { date: "desc" },
  });

  const anchorAmount = anchor ? Number(anchor.amount) : 0;
  const anchorDate = anchor?.date ?? null;

  const rangeFrom = anchorDate ? addDaysUTC(anchorDate, 1) : null;
  const rangeTo = addDaysUTC(date, -1);

  let opening = anchorAmount;
  if (!rangeFrom || rangeFrom.getTime() <= rangeTo.getTime()) {
    const before = await getDayEffects(source, rangeFrom, rangeTo);
    opening = anchorAmount + netOf(before);
  }

  const today = await getDayEffects(source, date, date);
  const calculatedClosing = opening + netOf(today);

  const actualRow = await prisma.dailyActualBalance.findUnique({ where: { date_source: { date, source } } });
  const actualClosing = actualRow ? Number(actualRow.amount) : null;
  const difference = actualClosing !== null ? actualClosing - calculatedClosing : null;

  return {
    source,
    opening,
    openingAnchorDate: anchorDate ? anchorDate.toISOString().slice(0, 10) : null,
    revenue: today.revenue,
    expenses: today.expenses,
    transfersIn: today.transfersIn,
    transfersOut: today.transfersOut,
    calculatedClosing,
    actualClosing,
    difference,
  };
}

export async function getDailySettlementSummary(date: Date): Promise<SourceBreakdown[]> {
  return Promise.all(FUND_SOURCES.map((s) => getSourceBreakdown(date, s)));
}
