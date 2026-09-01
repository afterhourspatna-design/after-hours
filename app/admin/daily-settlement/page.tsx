import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Landmark, Banknote, CreditCard, Wallet, ChevronLeft, ChevronRight,
  Gamepad2, Coffee, Zap, Trophy, ArrowRight, ShieldAlert, Calendar
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";

function getISTStartAndEnd(date: Date) {
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

  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
  return { start, end, year, month, day };
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

function parseISTDateString(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
  return { start, end, year, month, day };
}

export default async function DailySettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    redirect("/admin/dashboard");
  }

  const { date: targetDateStr } = await searchParams;
  const now = new Date();
  const todayISTStr = formatInIST(now);

  const selectedDateStr = targetDateStr && /^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)
    ? targetDateStr
    : todayISTStr;

  const { start: startDate, end: endDate } = parseISTDateString(selectedDateStr);

  // Date shifting links
  const targetDateObj = new Date(Date.UTC(
    parseInt(selectedDateStr.split("-")[0]),
    parseInt(selectedDateStr.split("-")[1]) - 1,
    parseInt(selectedDateStr.split("-")[2]),
    12, 0, 0
  ));
  const prevDateObj = new Date(targetDateObj.getTime() - 24 * 60 * 60 * 1000);
  const nextDateObj = new Date(targetDateObj.getTime() + 24 * 60 * 60 * 1000);

  const prevDateStr = formatInIST(prevDateObj);
  const nextDateStr = formatInIST(nextDateObj);

  const isToday = selectedDateStr === todayISTStr;

  // Query all payment transactions created on the selected day
  const payments = await prisma.payment.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      user: { select: { name: true, phone: true } },
      allocations: {
        include: {
          booking: {
            select: {
              id: true,
              finalAmount: true,
              guestName: true,
              guestPhone: true,
              game: { select: { name: true } },
              user: { select: { name: true, phone: true } },
            },
          },
          snackOrder: {
            select: {
              id: true,
              amount: true,
              guestName: true,
              guestPhone: true,
              user: { select: { name: true, phone: true } },
            },
          },
        },
      },
      prepaidTransactions: {
        select: {
          id: true,
          amount: true,
          moneyGiven: true,
          description: true,
        },
      },
      tournamentParticipants: {
        include: {
          tournament: { select: { title: true } },
          user: { select: { name: true, phone: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate totals
  let totalCash = 0;
  let totalOnline = 0;

  let gameRevenue = 0;
  let snackRevenue = 0;
  let creditRevenue = 0;
  let tournamentRevenue = 0;

  for (const p of payments) {
    totalCash += Number(p.cashAmount || 0);
    totalOnline += Number(p.onlineAmount || 0);

    for (const alloc of p.allocations) {
      if (alloc.booking) {
        gameRevenue += Number(alloc.amount);
      } else if (alloc.snackOrder) {
        snackRevenue += Number(alloc.amount);
      }
    }

    for (const tx of p.prepaidTransactions) {
      creditRevenue += Number(tx.moneyGiven || 0);
    }

    if (p.tournamentParticipants.length > 0) {
      tournamentRevenue += Number(p.negotiatedAmount || 0);
    }
  }

  const netCollection = totalCash + totalOnline;

  const displayDateLabel = isToday
    ? "Today"
    : new Date(selectedDateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header & Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
            <Landmark className="w-3.5 h-3.5 text-violet-400" />
            <span>Financials & Shift Closing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Daily Settlement
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Read-only summary of cash, online collections, and daily revenue streams.
          </p>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1.5 rounded-xl border border-zinc-800 shadow-md">
            <a
              href={`/admin/daily-settlement?date=${prevDateStr}`}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </a>
            <span className="text-xs font-bold text-zinc-200 px-3 min-w-[100px] text-center select-none">
              {displayDateLabel}
            </span>
            <a
              href={`/admin/daily-settlement?date=${nextDateStr}`}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <form action="/admin/daily-settlement" method="GET" className="flex items-center gap-1.5">
            <input
              type="date"
              name="date"
              defaultValue={selectedDateStr}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500 [color-scheme:dark]"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 transition-colors"
            >
              Go
            </button>
          </form>

          {!isToday && (
            <a
              href="/admin/daily-settlement"
              className="px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-bold rounded-xl border border-violet-500/30 transition-all flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5" />
              Today
            </a>
          )}
        </div>
      </div>

      {/* Main Collection Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-card p-6 border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-zinc-900/60 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Expected Cash in Till
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-black text-white tracking-tight">
              {formatCurrency(totalCash)}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Physical cash collected from all transactions today
            </p>
          </div>
        </div>

        <div className="glass-card p-6 border-sky-500/20 bg-gradient-to-br from-sky-950/20 to-zinc-900/60 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
              Expected Online / UPI
            </span>
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-black text-white tracking-tight">
              {formatCurrency(totalOnline)}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              GPay, PhonePe, Paytm, and Card payments
            </p>
          </div>
        </div>

        <div className="glass-card p-6 border-violet-500/30 bg-gradient-to-br from-violet-950/30 to-zinc-900/80 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
              Net Total Collection
            </span>
            <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-black text-white tracking-tight">
              {formatCurrency(netCollection)}
            </p>
            <p className="text-xs text-violet-300/80 mt-1">
              Combined Cash + Online collection for {selectedDateStr}
            </p>
          </div>
        </div>
      </div>

      {/* Stream Breakdown */}
      <div className="glass-card p-6 border-zinc-800/80 bg-zinc-950/40">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-violet-400" />
          Revenue Stream Breakdown
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Console Games</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(gameRevenue)}</p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span>Snacks & Drinks</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(snackRevenue)}</p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Prepaid Top-ups</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(creditRevenue)}</p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <Trophy className="w-3.5 h-3.5 text-rose-400" />
              <span>Tournament Fees</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(tournamentRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Itemized Transactions Table */}
      <div className="glass-card overflow-hidden border-zinc-800/80 bg-zinc-950/40">
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Daily Transactions Ledger</h2>
            <p className="text-xs text-zinc-500">
              {payments.length} {payments.length === 1 ? "receipt" : "receipts"} issued on {selectedDateStr}
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm">
            No payment receipts logged on this date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table text-left">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Receipt ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Cash</th>
                  <th className="py-3 px-4">Online</th>
                  <th className="py-3 px-4 text-right">Total Settled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-xs">
                {payments.map((p) => {
                  const timeStr = new Date(p.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Kolkata",
                  });

                  const cashNum = Number(p.cashAmount || 0);
                  const onlineNum = Number(p.onlineAmount || 0);
                  const totalNum = cashNum + onlineNum;

                  const customerName = p.customerNames || p.user?.name || "Customer";
                  const phoneSet = new Set<string>();
                  if (p.user?.phone) phoneSet.add(p.user.phone);
                  for (const a of p.allocations) {
                    const phone = a.booking?.user?.phone || a.booking?.guestPhone || a.snackOrder?.user?.phone || a.snackOrder?.guestPhone;
                    if (phone) phoneSet.add(phone);
                  }
                  const phoneStr = Array.from(phoneSet).join(", ");

                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4 text-zinc-400 font-mono">{timeStr}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-violet-400">
                        #{p.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-white">{customerName}</p>
                        {phoneStr && <p className="text-[11px] text-zinc-500">{phoneStr}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                          p.paymentMethod === "CASH" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          p.paymentMethod === "ONLINE" ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                          "bg-violet-500/10 text-violet-300 border-violet-500/20"
                        )}>
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-mono">
                        {cashNum > 0 ? formatCurrency(cashNum) : "—"}
                      </td>
                      <td className="py-3 px-4 text-sky-400 font-mono">
                        {onlineNum > 0 ? formatCurrency(onlineNum) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white font-mono">
                        {formatCurrency(totalNum)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
