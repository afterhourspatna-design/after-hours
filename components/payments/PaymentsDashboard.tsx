"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { toast } from "sonner";
import {
  Search, Download, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, CreditCard, X, Info, Coins, CheckCircle, Plus, Coffee, Pencil
} from "lucide-react";
import {
  cn, formatCurrency, formatDate, formatTimeRange, formatDuration, getISTDayRelative,
} from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import SnackProductPicker, { SnackItemPayload } from "@/components/snacks/SnackProductPicker";
import SnackTabModal from "@/components/snacks/SnackTabModal";

function formatDateOnly(date: Date | string) {
  return new Date(date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

interface SnackLine {
  id: string;
  name: string;
  note: string | null;
  quantity: number;
  amount: number;
}

interface Booking {
  id: string;
  userId?: string | null;
  guestName: string | null;
  guestPhone: string | null;
  startDateTime: string;
  endDateTime: string;
  durationMinutes: number;
  bookingStatus: string;
  paymentStatus: string;
  finalAmount: number;
  negotiatedAmount: number | null;
  paymentMethod: string | null;
  cashAmount: number | null;
  onlineAmount: number | null;
  source: string;
  game: { name: string; tag: string };
  resourceUnit: { unitName: string } | null;
  user: { name: string; phone: string } | null;
  updatedAt: string | null;
  paymentId: string | null;
  snacksAmount: number | null;
  couponId: string | null;
  couponDiscount?: number | string | null;
  allocations?: any[];
  isNewUser?: boolean;
  allocatedAmount?: number;
  snackItems?: SnackLine[];
}

interface Coupon {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  minBookingAmount: number;
  maxDiscountAmount: number | null;
}

interface PaymentGroup {
  paymentId: string;
  updatedAt: string;
  paymentMethod: string;
  totalActual: number;
  totalNegotiated: number;
  totalCash: number;
  totalOnline: number;
  totalSnacks: number;
  customerNames: string;
  customerPhones: string;
  bookings: Booking[];
}

interface PaymentsDashboardProps {
  role: "ADMIN" | "STAFF";
}

export default function PaymentsDashboard({ role }: PaymentsDashboardProps) {
  const [activeTab, setActiveTab] = useState<"UNPAID" | "PAID">("UNPAID");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [includeAdvanceBookings, setIncludeAdvanceBookings] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentHistory, setPaymentHistory] = useState<PaymentGroup[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Payment Form States
  const [negotiatedInput, setNegotiatedInput] = useState("");
  const [amountPayingNowInput, setAmountPayingNowInput] = useState("");
  const [snacksInput, setSnacksInput] = useState(""); // lump-sum, edit-existing-payment mode only
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE" | "MIXED">("ONLINE");
  const [cashInput, setCashInput] = useState("");
  const [onlineInput, setOnlineInput] = useState("");
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<PaymentGroup | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  // History defaults to today's settlements only (for both admin and staff);
  // admin can still widen/clear the range via the date filter, which is
  // hidden for staff, so staff always sees just today's history.
  const getTodayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [startDate, setStartDate] = useState(getTodayIST);
  const [endDate, setEndDate] = useState(getTodayIST);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCouponCode, setSelectedCouponCode] = useState("");

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  useEffect(() => {
    async function fetchCoupons() {
      try {
        const res = await fetch("/api/coupons/available");
        if (res.ok) {
          const data = await res.json();
          setCoupons(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch coupons", err);
      }
    }
    fetchCoupons();
  }, []);

  useEffect(() => {
    setStartDate(getTodayIST());
    setEndDate(getTodayIST());
    setPage(1);
  }, [activeTab]);


  const LIMIT = 15;

  // Wait for a pause in typing before querying, instead of one request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "UNPAID") {
        const params = new URLSearchParams({
          page: "1",
          limit: "1000", // Unpaid tabs shouldn't be paginated so we can batch settle everything at once
          includeSnacks: "1",
          includeAdvance: includeAdvanceBookings ? "1" : "0",
          // Staff's role-based visibility elsewhere in the app hides past
          // bookings, but here they still need to settle yesterday's unpaid
          // tabs — only Payment History (the PAID tab) is meant to stay
          // restricted to the present day for staff.
          includePastForStaff: "1",
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          paymentStatus: "UNPAID",
        });
        const res = await fetch(`/api/bookings?${params}`);
        if (res.ok) {
          const data = await res.json();
          const list: Booking[] = (data.bookings ?? []).filter((b: Booking) => !["CANCELLED", "EXPIRED"].includes(b.bookingStatus));
          setBookings(list);
          setTotal(list.length);
        }
      } else {
        // PAID tab -> Fetch from /api/payments
        const params = new URLSearchParams({
          page: String(page),
          limit: String(LIMIT),
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          ...(startDate ? { from: `${startDate}T00:00:00.000Z` } : {}),
          ...(endDate ? { to: `${endDate}T23:59:59.999Z` } : {}),
        });
        const res = await fetch(`/api/payments?${params}`);
        if (res.ok) {
          const data = await res.json();
          const mappedGroups: PaymentGroup[] = (data.payments ?? []).map((p: any) => {
            const bookings: any[] = [];
            const snackBookings: any[] = [];

            for (const alloc of p.allocations || []) {
              if (alloc.booking) {
                bookings.push({ ...alloc.booking, allocatedAmount: Number(alloc.amount) });
              }
              if (alloc.snackOrder) {
                const snack = alloc.snackOrder;
                snackBookings.push({
                  id: `SNACK_${snack.id}`,
                  guestName: snack.guestName,
                  guestPhone: snack.guestPhone,
                  startDateTime: p.createdAt,
                  endDateTime: p.createdAt,
                  durationMinutes: 0,
                  bookingStatus: "COMPLETED",
                  paymentStatus: "PAID",
                  finalAmount: snack.amount,
                  negotiatedAmount: snack.amount,
                  paymentMethod: p.paymentMethod,
                  cashAmount: 0,
                  onlineAmount: 0,
                  source: "WALK_IN",
                  game: { name: "Snacks", tag: "SNACK" },
                  resourceUnit: null,
                  user: snack.user,
                  updatedAt: p.createdAt,
                  paymentId: p.id,
                  snacksAmount: snack.amount,
                  allocatedAmount: Number(alloc.amount),
                  couponId: null,
                });
              }
            }
            const creditBookings: any[] = [];
            for (const tx of p.prepaidTransactions || []) {
              creditBookings.push({
                id: `CREDIT_${tx.id}`,
                guestName: p.customerNames || "Customer",
                guestPhone: "",
                startDateTime: p.createdAt,
                endDateTime: p.createdAt,
                durationMinutes: 0,
                bookingStatus: "COMPLETED",
                paymentStatus: "PAID",
                finalAmount: tx.amount,
                negotiatedAmount: tx.amount,
                paymentMethod: p.paymentMethod,
                cashAmount: 0,
                onlineAmount: 0,
                source: "WALK_IN",
                game: { name: "Credits", tag: "CREDITS" },
                resourceUnit: null,
                user: null,
                updatedAt: p.createdAt,
                paymentId: p.id,
                snacksAmount: 0,
                allocatedAmount: Number(tx.amount),
                couponId: null,
              });
            }

            const allBookings = [...bookings, ...snackBookings, ...creditBookings];
            const totalActual = allBookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);
            const totalSnacks = (p.allocations || [])
              .filter((a: any) => a.snackOrder)
              .reduce((sum: number, a: any) => sum + Number(a.amount), 0);

            const phoneSet = new Set<string>();
            for (const b of allBookings) {
              if (b.user?.phone) phoneSet.add(b.user.phone);
              else if (b.guestPhone) phoneSet.add(b.guestPhone);
            }

            return {
              paymentId: p.id,
              updatedAt: p.createdAt,
              paymentMethod: p.paymentMethod,
              totalActual,
              totalNegotiated: Number(p.negotiatedAmount),
              totalCash: Number(p.cashAmount),
              totalOnline: Number(p.onlineAmount),
              totalSnacks,
              customerNames: p.customerNames,
              customerPhones: Array.from(phoneSet).join(", "),
              bookings: allBookings,
            };
          });
          setPaymentHistory(mappedGroups);
          setTotal(data.total ?? 0);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, activeTab, startDate, endDate, includeAdvanceBookings]);

  useEffect(() => {
    fetchBookings();
    setSelectedIds(new Set());
  }, [fetchBookings]);

  // Handle select all checkbox
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const ids = new Set(bookings.map((b) => b.id));
      setSelectedIds(ids);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Per-customer groups start collapsed; their individual booking rows only
  // render once the group's arrow is expanded.
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
  const toggleGroupExpanded = (key: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Group unpaid bookings/snack tabs by customer so settling one person's
  // whole balance doesn't mean hunting for their rows across a flat list.
  // Key: phone number (registered or guest) when we have one, otherwise the
  // row's own id (so items with no phone at all just sit in their own group).
  interface BookingGroup {
    key: string;
    name: string;
    phone: string;
    items: Booking[];
    total: number;
    earliest: string;
  }

  const groupedBookings = useMemo<BookingGroup[]>(() => {
    const groups = new Map<string, BookingGroup>();
    for (const b of bookings) {
      const phone = b.user?.phone || b.guestPhone || "";
      const key = phone || `single:${b.id}`;
      const name = b.user?.name ?? b.guestName ?? "Guest";
      let group = groups.get(key);
      if (!group) {
        group = { key, name, phone, items: [], total: 0, earliest: b.startDateTime };
        groups.set(key, group);
      }
      group.items.push(b);
      group.total += Number(b.finalAmount);
      if (new Date(b.startDateTime) < new Date(group.earliest)) group.earliest = b.startDateTime;
    }
    return Array.from(groups.values()).sort(
      (a, b) => new Date(a.earliest).getTime() - new Date(b.earliest).getTime()
    );
  }, [bookings]);

  const handleSelectGroup = (group: BookingGroup) => {
    const groupIds = group.items.map((b) => b.id);
    const allSelected = groupIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      groupIds.forEach((id) => next.delete(id));
    } else {
      groupIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  // Quick-add snacks for a customer directly from their group — no trip to
  // the Snacks page, no searching for them again, since we already know who
  // they are from their booking.
  const [snackQuickAddGroup, setSnackQuickAddGroup] = useState<BookingGroup | null>(null);
  // The tab this modal session is adding to. Resolved once when the modal
  // opens (from whatever tab already exists in the group, if any), then
  // pinned to whatever the first add's response says — never re-derived from
  // `bookings`/`groupedBookings` mid-session, since those only refresh after
  // a round trip and would otherwise make a second add in the same session
  // miss the tab the first add just created.
  const [quickAddOrderId, setQuickAddOrderId] = useState<string | null>(null);

  const handleOpenQuickAddSnack = (group: BookingGroup) => {
    // Only a snack tab created today (IST) is reused — opened as the same
    // Snack Tab view (with its item list, edit and delete) as the Snacks
    // page's Info button. If the customer has several from today, take the
    // latest. Otherwise (none, or only older days) quickAddOrderId stays
    // null and a brand-new tab is created on first add.
    const todaysSnackRows = group.items
      .filter((b) => b.id.startsWith("SNACK_") && getISTDayRelative(new Date(b.startDateTime)) === "today")
      .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
    const existingSnackRow = todaysSnackRows[0];
    setQuickAddOrderId(existingSnackRow ? existingSnackRow.id.replace("SNACK_", "") : null);
    setSnackQuickAddGroup(group);
  };

  const handleCloseQuickAddSnack = () => {
    setSnackQuickAddGroup(null);
    setQuickAddOrderId(null);
  };

  const handleQuickAddSnackItem = async (item: SnackItemPayload) => {
    if (!snackQuickAddGroup) return;
    const itemPayload = {
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      notes: item.notes,
    };

    let res: Response;
    if (quickAddOrderId) {
      res = await fetch(`/api/snacks/${quickAddOrderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemPayload),
      });
    } else {
      const sample = snackQuickAddGroup.items[0];
      const payload: any = { ...itemPayload };
      if (sample.userId) {
        payload.userId = sample.userId;
      } else {
        payload.guestName = sample.user?.name ?? sample.guestName ?? snackQuickAddGroup.name;
        payload.guestPhone = sample.user?.phone ?? sample.guestPhone ?? snackQuickAddGroup.phone ?? null;
      }
      res = await fetch("/api/snacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to add item");
      throw new Error(err.error || "Failed to add item");
    }

    const updatedOrder = await res.json();
    setQuickAddOrderId(updatedOrder.id);
    toast.success("Added to tab");
    fetchBookings();
  };

  // Math totals for checkout
  const selectedBookings = editPaymentId
    ? paymentHistory.find(p => p.paymentId === editPaymentId)?.bookings || []
    : bookings.filter((b) => selectedIds.has(b.id));

  // Game bookings in the settle modal grouped per customer: name, then their games.
  const gameDetailGroups = (() => {
    const groups = new Map<string, { key: string; name: string; total: number; bookings: Booking[] }>();
    for (const b of selectedBookings) {
      if (b.id.startsWith("SNACK_") || b.game?.tag === "SNACK") continue;
      const phone = b.user?.phone || b.guestPhone || "";
      const key = phone || `single:${b.id}`;
      let g = groups.get(key);
      if (!g) {
        g = { key, name: b.user?.name ?? b.guestName ?? "Guest", total: 0, bookings: [] };
        groups.set(key, g);
      }
      g.bookings.push(b);
      g.total += Number(b.finalAmount);
    }
    return Array.from(groups.values());
  })();

  const isCreditsPayment = selectedBookings.some((b) => b.game?.tag === "CREDITS");

  const totalActualAmount = selectedBookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);
  const totalActualGamesAmount = selectedBookings
    .filter((b) => !b.id.startsWith("SNACK_"))
    .reduce((sum, b) => sum + Number(b.finalAmount), 0);
  const totalActualSnacksAmount = selectedBookings
    .filter((b) => b.id.startsWith("SNACK_"))
    .reduce((sum, b) => sum + Number(b.finalAmount), 0);

  const totalBalanceDueGames = selectedBookings
    .filter((b) => !b.id.startsWith("SNACK_"))
    .reduce((sum, b) => {
      const paid = b.allocations?.reduce((s: any, a: any) => s + Number(a.amount), 0) || 0;
      return sum + Math.max(0, Number(b.finalAmount) - paid);
    }, 0);

  const totalBalanceDueSnacks = selectedBookings
    .filter((b) => b.id.startsWith("SNACK_"))
    .reduce((sum, b) => {
      const paid = b.allocations?.reduce((s: any, a: any) => s + Number(a.amount), 0) || 0;
      return sum + Math.max(0, Number(b.finalAmount) - paid);
    }, 0);

  const totalPreviouslyPaidGames = totalActualGamesAmount - totalBalanceDueGames;
  const totalPreviouslyPaidSnacks = totalActualSnacksAmount - totalBalanceDueSnacks;
  const previouslyPaidTotal = totalPreviouslyPaidGames + totalPreviouslyPaidSnacks;

  // Dynamic Coupon Discount Calculation
  const eligibleBookings = selectedBookings.filter((b) => !b.couponId && !b.id.startsWith("SNACK_"));
  const eligibleBaseAmount = eligibleBookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);

  // The coupon's total discount on the eligible bookings: percentage (capped)
  // or fixed, then rounded UP to a whole rupee, and never above what's owed.
  const computeCouponDiscount = (coupon: Coupon | undefined, base: number) => {
    if (!coupon || base <= 0 || base < Number(coupon.minBookingAmount)) return 0;
    let discount: number;
    if (coupon.discountType === "PERCENTAGE") {
      discount = base * (Number(coupon.discountValue) / 100);
      if (coupon.maxDiscountAmount) discount = Math.min(discount, Number(coupon.maxDiscountAmount));
    } else {
      discount = Number(coupon.discountValue);
    }
    return Math.min(Math.ceil(discount - 1e-9), base);
  };

  const dynamicCouponDiscount =
    !editPaymentId && selectedCouponCode
      ? computeCouponDiscount(coupons.find((c) => c.code === selectedCouponCode), eligibleBaseAmount)
      : 0;

  // Each un-couponed game booking's share of the coupon discount, split in
  // proportion to its amount, with the last one taking the rounding remainder
  // so the shares add up exactly to the whole-rupee discount.
  const couponShares = new Map<string, number>();
  if (dynamicCouponDiscount > 0 && eligibleBaseAmount > 0) {
    let remaining = dynamicCouponDiscount;
    eligibleBookings.forEach((b, i) => {
      // Whole-rupee shares: each is its ratio of the discount rounded up, and
      // the last booking gets whatever is left.
      const share = i === eligibleBookings.length - 1
        ? remaining
        : Math.min(Math.ceil((Number(b.finalAmount) / eligibleBaseAmount) * dynamicCouponDiscount - 1e-9), remaining);
      remaining -= share;
      couponShares.set(b.id, share);
    });
  }

  // Price before any coupon (a coupon already applied earlier is added back),
  // and the price after it — including a coupon being previewed right now.
  const bookingInitial = (b: Booking) => Number(b.finalAmount) + (b.couponId ? Number(b.couponDiscount ?? 0) : 0);
  const bookingCurrent = (b: Booking) => Number(b.finalAmount) - (couponShares.get(b.id) ?? 0);

  const handleCouponChange = (code: string) => {
    setSelectedCouponCode(code);
    const discount = computeCouponDiscount(coupons.find((c) => c.code === code), eligibleBaseAmount);
    const newGamesAmount = Math.max(0, totalActualGamesAmount - discount);
    setNegotiatedInput(String(newGamesAmount));

    // Auto-update Amount Paying Now to reflect the new discount while accounting for prior payments
    const newTotalToPay = newGamesAmount + snacksVal - (editPaymentId ? 0 : previouslyPaidTotal);
    setAmountPayingNowInput(String(Math.max(0, newTotalToPay)));
  };

  // Open modal and pre-fill values
  const handleOpenPayModal = () => {
    if (selectedIds.size === 0) return;
    setNegotiatedInput(String(totalActualGamesAmount));
    setAmountPayingNowInput(String(totalBalanceDueGames + totalBalanceDueSnacks));
    setPaymentMethod("ONLINE");
    setCashInput("");
    setOnlineInput("");
    setEditPaymentId(null);
    setSelectedCouponCode("");
    setShowPayModal(true);
  };

  const handleOpenEditModal = (p: PaymentGroup) => {
    setEditPaymentId(p.paymentId);
    const bookingIds = p.bookings.map((b) => b.id);
    setSelectedIds(new Set(bookingIds));
    setNegotiatedInput(String(p.totalNegotiated));
    setSnacksInput(String(p.totalSnacks));
    setAmountPayingNowInput(String(p.totalCash + p.totalOnline));
    setPaymentMethod(p.paymentMethod as "CASH" | "ONLINE" | "MIXED");
    setCashInput(p.totalCash ? String(p.totalCash) : "");
    setOnlineInput(p.totalOnline ? String(p.totalOnline) : "");
    setShowPayModal(true);
  };


  const handleClosePayModal = () => {
    setShowPayModal(false);
    setEditPaymentId(null);
    setSelectedIds(new Set());
  };

  // Real-time values
  const totalNegotiatedVal = Number(negotiatedInput) || 0;
  // Edit-existing-payment mode uses the lump-sum field; new-payment mode is
  // always the sum of whatever's already on the selected tab(s) — snacks are
  // added to a customer's tab from the Unpaid list directly, not here, so
  // there's nothing left to type in at settle time.
  const snacksVal = editPaymentId ? (Number(snacksInput) || 0) : totalActualSnacksAmount;
  const cashVal = Number(cashInput) || 0;
  const onlineVal = Number(onlineInput) || 0;
  const totalWithSnacks = totalNegotiatedVal + snacksVal;
  const amountPayingNowVal = Number(amountPayingNowInput) || 0;

  // Real-time validations
  const isSplitInvalid = paymentMethod === "MIXED" && Math.abs(cashVal + onlineVal - amountPayingNowVal) > 0.01;
  const isNegotiatedInvalid = totalNegotiatedVal < 0;
  const isSnacksInvalid = snacksVal < 0;
  const isAmountPayingNowInvalid = amountPayingNowVal < 0;
  const isSubmitDisabled = isNegotiatedInvalid || isSnacksInvalid || isSplitInvalid || isAmountPayingNowInvalid || submittingPayment;

  // Auto-fill simple Cash/Online values when Amount Paying Now changes
  useEffect(() => {
    if (paymentMethod === "CASH") {
      setCashInput(String(amountPayingNowVal));
      setOnlineInput("");
    } else if (paymentMethod === "ONLINE") {
      setOnlineInput(String(amountPayingNowVal));
      setCashInput("");
    }
  }, [amountPayingNowVal, paymentMethod]);

  const handleConfirmPayment = async () => {
    if (isSubmitDisabled) return;
    setSubmittingPayment(true);

    try {
      const payload = editPaymentId
        ? {
          paymentId: editPaymentId,
          negotiatedAmount: totalNegotiatedVal,
          snacksAmount: snacksVal,
          amountPayingNow: amountPayingNowVal,
          paymentMethod,
          cashAmount: paymentMethod === "MIXED" ? cashVal : paymentMethod === "CASH" ? amountPayingNowVal : 0,
          onlineAmount: paymentMethod === "MIXED" ? onlineVal : paymentMethod === "ONLINE" ? amountPayingNowVal : 0,
        }
        : {
          bookingIds: Array.from(selectedIds),
          negotiatedAmount: totalNegotiatedVal,
          snacksAmount: snacksVal,
          amountPayingNow: amountPayingNowVal,
          paymentMethod,
          cashAmount: paymentMethod === "MIXED" ? cashVal : paymentMethod === "CASH" ? amountPayingNowVal : 0,
          onlineAmount: paymentMethod === "MIXED" ? onlineVal : paymentMethod === "ONLINE" ? amountPayingNowVal : 0,
          couponCode: selectedCouponCode || null,
        };

      const method = editPaymentId ? "PUT" : "POST";
      const res = await fetch("/api/bookings/batch-pay", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed to process payment");

      toast.success(editPaymentId ? "Successfully updated payment!" : `Successfully processed payment for ${result.count} bookings!`);
      handleClosePayModal();
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || "Payment process failed");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const currentLimit = activeTab === "UNPAID" ? 1000 : LIMIT;
  const totalPages = Math.ceil(total / currentLimit);

  return (
    <div className="space-y-6 pb-28">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Payments</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Payments</h1>
          <p className="text-sm text-zinc-500 font-medium">Track unpaid balances, settle tabs, and review payment history.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("UNPAID")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === "UNPAID"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/20"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            Unpaid
          </button>
          <button
            onClick={() => setActiveTab("PAID")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === "PAID"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/20"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            Payment History
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-row gap-3 items-center">

          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search customer, phone, notes…"
              className="input-field pl-9"
            />
          </div>
          <button
            onClick={fetchBookings}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all self-stretch flex items-center justify-center"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {activeTab === "UNPAID" && (
          <label className={cn(
            "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs whitespace-nowrap w-fit transition-colors",
            includeAdvanceBookings
              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
              : "border-zinc-800 bg-zinc-900/60 text-zinc-300"
          )}>
            <input
              type="checkbox"
              checked={includeAdvanceBookings}
              onChange={(e) => {
                setIncludeAdvanceBookings(e.target.checked);
                setPage(1);
              }}
              className="rounded border-zinc-700 text-cyan-500 focus:ring-cyan-500 bg-zinc-900 h-4 w-4"
            />
            Include advance bookings
          </label>
        )}

        {/* Date Filter Row for History tab (admin only) */}
        {activeTab === "PAID" && role === "ADMIN" && (
          <div className="flex flex-col min-[500px]:flex-row min-[500px]:flex-wrap min-[500px]:items-center gap-2 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/60 animate-fade-in">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Filter Date Range:</span>
            <div className="flex flex-row items-center gap-1.5 w-full min-[500px]:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-xs flex-1 min-w-0 min-[500px]:flex-none min-[500px]:w-36 py-1.5 animate-fade-in"
              />
              <span className="text-xs text-zinc-500 flex-shrink-0">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field text-xs flex-1 min-w-0 min-[500px]:flex-none min-[500px]:w-36 py-1.5 animate-fade-in"
                min={startDate || undefined}
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="w-full min-[500px]:w-auto px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-700 transition-all active:scale-95"
              >
                Clear Range
              </button>
            )}
          </div>
        )}
      </div>

      {/* Payments Table */}
      <div className="glass-card overflow-hidden relative">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : (activeTab === "UNPAID" ? bookings.length === 0 : paymentHistory.length === 0) ? (
          <EmptyState
            title={activeTab === "UNPAID" ? "All settled up!" : "No payments history yet"}
            description={
              activeTab === "UNPAID"
                ? "All active bookings have been fully paid."
                : "Once you settle bookings, they will show up in this history list."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            {activeTab === "UNPAID" ? (
              // A real CSS grid (not a <table>) so every "cell" is a genuine
              // grid item under one shared column template — header and body
              // columns are guaranteed to line up pixel-for-pixel, which a
              // <table>/colgroup/colSpan mix kept failing to do reliably.
              // Each logical row is a `display: contents` wrapper (so its
              // children become direct grid items) that still works as a
              // normal DOM node for click handling and group-hover.
              <div className="grid grid-cols-[40px_1.8fr_1.3fr_0.8fr_1.1fr_0.8fr] w-full min-w-[720px]">
                {/* Header */}
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={bookings.length > 0 && selectedIds.size === bookings.length}
                    onChange={handleSelectAll}
                    className="rounded border-zinc-700 text-violet-600 focus:ring-violet-500 bg-zinc-900 h-4 w-4"
                  />
                </div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4 text-center">Game / Unit</div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4 text-center">Date & Time</div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4 text-center">Duration</div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4 text-center">Total / Balance Due</div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider py-3 px-4 text-center">Status</div>

                {groupedBookings.map((group) => {
                  const groupChecked = group.items.every((b) => selectedIds.has(b.id));
                  const groupPartiallyChecked = !groupChecked && group.items.some((b) => selectedIds.has(b.id));
                  const isExpanded = expandedGroupKeys.has(group.key);
                  const groupCell = "bg-zinc-900/60 border-t border-zinc-800/60 py-3 px-4 flex items-center justify-center";

                  return (
                    <Fragment key={group.key}>
                      {/* Group summary row */}
                      <div className={groupCell} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={groupChecked}
                          ref={(el) => { if (el) el.indeterminate = groupPartiallyChecked; }}
                          onChange={() => handleSelectGroup(group)}
                          className="rounded border-zinc-700 text-violet-600 focus:ring-violet-500 bg-zinc-900 h-4 w-4"
                          title="Select all for this customer"
                        />
                      </div>
                      <div
                        className={cn(groupCell, "col-span-2 justify-start gap-2 cursor-pointer overflow-hidden")}
                        onClick={() => toggleGroupExpanded(group.key)}
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleGroupExpanded(group.key); }}
                          className="p-0.5 rounded hover:bg-zinc-800 transition-colors flex-shrink-0"
                          title={isExpanded ? "Hide bookings" : "Show bookings"}
                        >
                          <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", isExpanded && "rotate-180")} />
                        </button>
                        <span className="font-semibold text-white text-sm truncate">{group.name}</span>
                        {group.phone && <span className="text-xs text-zinc-500 whitespace-nowrap flex-shrink-0">{group.phone}</span>}
                        <span className="text-xs text-zinc-600 whitespace-nowrap flex-shrink-0">· {group.items.length} {group.items.length === 1 ? "item" : "items"}</span>
                      </div>
                      <div className={groupCell} />
                      <div className={groupCell}>
                        <span
                          className="text-sm font-black text-emerald-400 whitespace-nowrap"
                          onClick={(e) => { e.stopPropagation(); handleSelectGroup(group); }}
                        >
                          {formatCurrency(group.total)}
                        </span>
                      </div>
                      <div className={groupCell}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenQuickAddSnack(group); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 transition-colors"
                          title="Add a snack to this customer's tab"
                        >
                          <Coffee className="w-3 h-3" />
                          Snack
                        </button>
                      </div>

                      {/* Booking rows */}
                      {isExpanded && group.items.map((b) => {
                        const isChecked = selectedIds.has(b.id);
                        const cell = cn(
                          "border-t border-zinc-800/60 py-3 px-4 flex items-center justify-center text-center",
                          isChecked && "bg-violet-900/10"
                        );

                        return (
                          <div key={b.id} className="contents group cursor-pointer select-none" onClick={() => handleSelectRow(b.id)}>
                            <div className={cn(cell, "group-hover:bg-zinc-800/30")} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(b.id)}
                                className="rounded border-zinc-700 text-violet-600 focus:ring-violet-500 bg-zinc-900 h-4 w-4"
                              />
                            </div>
                            <div className={cn(cell, "group-hover:bg-zinc-800/30 flex-col gap-0")}>
                              <div className="flex items-center justify-center gap-2 w-full">
                                <p className="text-sm text-zinc-200 truncate">{b.game.name}</p>
                                {b.isNewUser && (
                                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-emerald-500/30 flex-shrink-0">
                                    New
                                  </span>
                                )}
                              </div>
                              {b.resourceUnit && <p className="text-xs text-zinc-600 truncate w-full">{b.resourceUnit.unitName}</p>}
                            </div>
                            <div className={cn(cell, "group-hover:bg-zinc-800/30 flex-col gap-0 whitespace-nowrap")}>
                              <p className="text-sm text-zinc-200 w-full">{formatDate(b.startDateTime)}</p>
                              <p className="text-xs text-zinc-600 w-full">{formatTimeRange(b.startDateTime, b.endDateTime)}</p>
                            </div>
                            <div className={cn(cell, "group-hover:bg-zinc-800/30 text-sm text-zinc-400 whitespace-nowrap")}>
                              {formatDuration(b.durationMinutes)}
                            </div>
                            <div className={cn(cell, "group-hover:bg-zinc-800/30 text-sm font-medium text-white whitespace-nowrap")}>
                              {b.paymentStatus === "PARTIAL" ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-zinc-500 line-through text-xs">{formatCurrency(Number(b.finalAmount))}</span>
                                  <span className="text-amber-400 font-bold">{formatCurrency(Number(b.finalAmount) - (b.allocations?.reduce((s: any, a: any) => s + Number(a.amount), 0) || 0))}</span>
                                </div>
                              ) : b.couponId && Number(b.couponDiscount ?? 0) > 0 ? (
                                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                  <span className="text-zinc-500 line-through text-xs">{formatCurrency(bookingInitial(b))}</span>
                                  <span className="text-emerald-400 font-bold">{formatCurrency(Number(b.finalAmount))}</span>
                                </div>
                              ) : (
                                formatCurrency(Number(b.finalAmount))
                              )}
                            </div>
                            <div className={cn(cell, "group-hover:bg-zinc-800/30")}>
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase border",
                                b.paymentStatus === "PARTIAL"
                                  ? "bg-amber-600/10 text-amber-400 border-amber-600/20"
                                  : "bg-red-600/10 text-red-400 border-red-600/20"
                              )}>
                                {b.paymentStatus}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </div>
            ) : (
              <table className="w-full min-w-[1000px] data-table table-fixed">
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[18%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="!text-center">Payment ID</th>
                    <th className="!text-center">Customer(s)</th>
                    <th className="!text-center">Bookings Count</th>
                    <th className="!text-center">Actual Total</th>
                    <th className="!text-center">Settled Total</th>
                    <th className="!text-center">Method</th>
                    <th className="!text-center">Settle Date</th>
                    <th className="!text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((p) => {
                    const amountPaid = p.totalCash + p.totalOnline;
                    const batchTotal = p.totalNegotiated + p.totalSnacks;
                    const updatedAtDate = new Date(p.updatedAt);
                    const dayRelative = getISTDayRelative(updatedAtDate);
                    const dayLabel = dayRelative === "other"
                      ? updatedAtDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })
                      : dayRelative.charAt(0).toUpperCase() + dayRelative.slice(1);
                    const timeLabel = updatedAtDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
                    return (
                      <tr
                        key={p.paymentId}
                        onClick={() => setSelectedPaymentDetail(p)}
                        className="cursor-pointer hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="text-center">
                          <p className="font-bold text-violet-400 font-mono" title={p.paymentId}>
                            {p.paymentId.startsWith("LEGACY-")
                              ? "#LEGACY"
                              : `#${p.paymentId.substring(0, 8).toUpperCase()}`}
                          </p>
                        </td>
                        <td className="text-center">
                          <div className="min-w-0">
                            <p className="font-medium text-white text-sm truncate" title={p.customerNames}>{p.customerNames}</p>
                            {p.customerPhones && <p className="text-xs text-zinc-600 truncate">{p.customerPhones}</p>}
                          </div>
                        </td>
                        <td className="text-center">
                          <p className="text-sm text-zinc-300">
                            {p.bookings.length} {p.bookings.length === 1 ? "booking" : "bookings"}
                          </p>
                        </td>
                        <td className="text-sm text-zinc-400 text-center whitespace-nowrap">
                          {formatCurrency(p.totalActual)}
                        </td>
                        <td className="text-xs text-zinc-300 text-center whitespace-nowrap">
                          <p className="text-sm font-semibold text-emerald-400">{formatCurrency(amountPaid)}</p>
                          {Math.abs(amountPaid - batchTotal) > 0.01 && (
                            <p className="text-[10px] text-amber-500 font-medium">Invoice: {formatCurrency(batchTotal)}</p>
                          )}
                          {p.totalSnacks > 0 ? (
                            <p className="text-[10px] text-zinc-500">
                              {p.bookings.some(b => b.game?.tag === "CREDITS") ? "Credits" : "Games"}: {formatCurrency(p.totalNegotiated)} | Snacks: {formatCurrency(p.totalSnacks)}
                            </p>
                          ) : p.bookings.some(b => b.game?.tag === "CREDITS") && (
                            <p className="text-[10px] text-zinc-500">Credits: {formatCurrency(p.totalNegotiated)}</p>
                          )}
                        </td>
                        <td className="text-center">
                          <div className="text-xs">
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700 uppercase">
                              {p.paymentMethod}
                            </span>
                            {p.paymentMethod === "MIXED" && (
                              <p className="text-[10px] text-zinc-500 mt-1 whitespace-nowrap">
                                C: {formatCurrency(p.totalCash)} | O: {formatCurrency(p.totalOnline)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="text-xs text-zinc-500 text-center whitespace-nowrap">
                          <span className="block">{dayLabel}</span>
                          <span className="block">{timeLabel}</span>
                        </td>
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedPaymentDetail(p)}
                              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors flex-shrink-0"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/60">
            <p className="text-xs text-zinc-500">
              {total} total · page {page} of {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-zinc-800 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-zinc-800 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating checkout banner for unpaid selection */}
      {activeTab === "UNPAID" && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-full px-4 z-40 animate-slide-in-right">
          <div className="bg-zinc-900 border border-violet-500/30 shadow-2xl rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 sm:gap-4 backdrop-blur-md bg-opacity-95">
            <div className="flex items-center justify-between sm:contents">
              <div>
                <p className="text-xs text-zinc-400">Selected</p>
                <p className="text-sm font-bold text-white">
                  {selectedIds.size} {selectedIds.size === 1 ? "item" : "items"}
                </p>
              </div>

              <div className="text-right sm:text-left">
                <p className="text-xs text-zinc-400">Total Amount</p>
                <p className="text-base font-extrabold text-violet-400">
                  {formatCurrency(totalActualAmount)}
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenPayModal}
              className="flex items-center justify-center gap-2 px-6 py-2.5 w-full sm:w-auto bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold shadow-lg shadow-violet-900/30 hover:shadow-violet-800/40 transition-all text-sm"
            >
              <CreditCard className="w-4 h-4" />
              Settle Payment ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Pay Modal (bg page dim) */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          {/* Backdrop dim */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => !submittingPayment && handleClosePayModal()}
          />

          {/* Modal Container */}
          <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl z-10 p-3 sm:p-6 space-y-3 sm:space-y-5 animate-scale-in max-h-[90vh] custom-scroll overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2 sm:pb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />
                <h3 className="text-sm sm:text-lg font-bold text-white">{editPaymentId ? "Edit Payment" : "Settle Payment"}</h3>
              </div>
              <button
                onClick={() => handleClosePayModal()}
                disabled={submittingPayment}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Game Details */}
            <div className="bg-zinc-950/40 rounded-xl p-2.5 sm:p-3 border border-zinc-800/40 space-y-1.5 sm:space-y-2">
              <p className="text-[11px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Game Details</p>
              <div className="divide-y divide-zinc-800/40 max-h-40 overflow-y-auto custom-scroll pr-1">
                {gameDetailGroups.map((g) => (
                  <div key={g.key} className="py-1.5 sm:py-2 text-[11px] sm:text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-zinc-300 truncate min-w-0">{g.name}</p>
                      {(() => {
                        const initial = g.bookings.reduce((s, b) => s + bookingInitial(b), 0);
                        const current = g.bookings.reduce((s, b) => s + bookingCurrent(b), 0);
                        return initial - current > 0.009 ? (
                          <p className="font-bold text-zinc-300 whitespace-nowrap flex-shrink-0">
                            <span className="text-zinc-600 line-through font-normal mr-1.5">{formatCurrency(initial)}</span>
                            <span className="text-emerald-400">{formatCurrency(current)}</span>
                          </p>
                        ) : (
                          <p className="font-bold text-zinc-300">{formatCurrency(current)}</p>
                        );
                      })()}
                    </div>
                    <ul className="space-y-1 pl-2 border-l border-zinc-800">
                      {g.bookings.map((b) => (
                        <li key={b.id} className="text-zinc-500">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1 min-w-0">
                              <span className="truncate text-zinc-400">
                                {b.game.name}
                                {b.resourceUnit && <span className="text-zinc-600"> ({b.resourceUnit.unitName})</span>}
                              </span>
                              {b.couponId && <span className="flex-shrink-0 bg-violet-500/20 text-violet-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border border-violet-500/30">Coupon</span>}
                            </span>
                            {bookingInitial(b) - bookingCurrent(b) > 0.009 ? (
                              <span className="whitespace-nowrap flex-shrink-0">
                                <span className="text-zinc-600 line-through mr-1.5">{formatCurrency(bookingInitial(b))}</span>
                                <span className="text-emerald-400">{formatCurrency(bookingCurrent(b))}</span>
                              </span>
                            ) : (
                              <span className="flex-shrink-0">{formatCurrency(bookingCurrent(b))}</span>
                            )}
                          </div>
                          <p className="text-zinc-600">{formatDate(b.startDateTime)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Snacks */}
            {totalActualSnacksAmount > 0 && (
              <div className="bg-zinc-950/40 rounded-xl p-2.5 sm:p-3 border border-zinc-800/40 space-y-1.5 sm:space-y-2">
                <p className="text-[11px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Snacks</p>
                <div className="divide-y divide-zinc-800/40 max-h-32 overflow-y-auto custom-scroll pr-1">
                  {selectedBookings.filter((b) => b.id.startsWith("SNACK_") || b.game?.tag === "SNACK").map((b) => (
                    <div key={b.id} className="py-1.5 sm:py-2 text-[11px] sm:text-xs space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold text-zinc-300">{b.user?.name ?? b.guestName ?? "Guest"}</p>
                          <p className="text-[10px] text-zinc-600">{formatDateOnly(b.startDateTime)}</p>
                        </div>
                        <p className="font-bold text-zinc-300">{formatCurrency(Number(b.finalAmount))}</p>
                      </div>
                      {b.snackItems && b.snackItems.length > 0 && (
                        <ul className="space-y-0.5 pl-2 border-l border-zinc-800">
                          {b.snackItems.map((it) => (
                            <li key={it.id} className="flex justify-between gap-2 text-zinc-500">
                              <span>
                                {it.name}{it.quantity > 1 ? ` × ${it.quantity}` : ""}
                                {it.note && <span className="text-zinc-600"> ({it.note})</span>}
                              </span>
                              <span>{formatCurrency(it.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editable price section */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <div>
                <label className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1 sm:mb-1.5">Final Games Price</label>
                <input
                  type="number"
                  value={negotiatedInput}
                  onChange={(e) => {
                    setNegotiatedInput(e.target.value);
                    const newGamesAmount = Number(e.target.value) || 0;
                    const t = newGamesAmount + snacksVal - (editPaymentId ? 0 : previouslyPaidTotal);
                    setAmountPayingNowInput(String(Math.max(0, t)));
                  }}
                  disabled={submittingPayment}
                  placeholder="Games Price"
                  className="input-field text-xs sm:text-sm font-semibold w-full"
                  title="Final Games Price"
                />
              </div>
              <div>
                <label className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1 sm:mb-1.5">Final Snacks Price</label>
                {editPaymentId ? (
                  <input
                    type="number"
                    value={snacksInput}
                    onChange={(e) => {
                      setSnacksInput(e.target.value);
                      const newSnacksAmount = Number(e.target.value) || 0;
                      const t = totalNegotiatedVal + newSnacksAmount - (editPaymentId ? 0 : previouslyPaidTotal);
                      setAmountPayingNowInput(String(Math.max(0, t)));
                    }}
                    disabled={submittingPayment}
                    placeholder="Snacks Price"
                    className="input-field text-xs sm:text-sm font-semibold w-full"
                    title="Final Snacks Price"
                  />
                ) : (
                  <div
                    className="input-field text-xs sm:text-sm font-semibold w-full text-zinc-300 flex items-center"
                    title="Total from the customer's open snack tab(s) selected above. Add snacks to a tab from the Unpaid list itself."
                  >
                    {formatCurrency(snacksVal)}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-400 font-bold block mb-1 sm:mb-1.5">Amount Paying Now</label>
              <input
                type="number"
                value={amountPayingNowInput}
                onChange={(e) => setAmountPayingNowInput(e.target.value)}
                disabled={submittingPayment}
                placeholder="Total to Pay Today"
                className="input-field text-base sm:text-lg font-bold text-emerald-400 bg-emerald-400/5 border-emerald-400/30 w-full py-2 sm:py-2.5"
              />
            </div>

            {/* Discount */}
            {!editPaymentId && (
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-[11px] sm:text-xs text-zinc-500 font-medium block">Discount (Coupon)</label>
                <select
                  value={selectedCouponCode}
                  onChange={(e) => handleCouponChange(e.target.value)}
                  disabled={submittingPayment || coupons.length === 0}
                  className="input-field text-xs w-full"
                >
                  <option value="">{coupons.length === 0 ? "No coupons available" : "No Coupon"}</option>
                  {coupons.map(c => (
                    <option key={c.id} value={c.code}>
                      {c.code} - {c.discountType === "PERCENTAGE" ? `${c.discountValue}% off` : `₹${c.discountValue} off`}
                    </option>
                  ))}
                </select>
                {coupons.length === 0 && (
                  <p className="text-[10px] text-zinc-500 mt-1">There are no active coupons yet. Add one from the Coupons page and it will show up here.</p>
                )}
                {dynamicCouponDiscount > 0 && (
                  <p className="text-[10px] text-emerald-400 font-medium mt-1 animate-fade-in">
                    Coupon applied! Discount: ₹{dynamicCouponDiscount.toFixed(2)} (on un-couponed bookings)
                  </p>
                )}
                {selectedCouponCode && dynamicCouponDiscount === 0 && eligibleBookings.length === 0 && (
                  <p className="text-[10px] text-amber-500 font-medium mt-1 animate-fade-in">
                    Cannot apply: All selected bookings already have coupons applied.
                  </p>
                )}
                {selectedCouponCode && dynamicCouponDiscount === 0 && eligibleBookings.length > 0 && (
                  <p className="text-[10px] text-amber-500 font-medium mt-1 animate-fade-in">
                    Coupon not applicable (min amount not met on the un-couponed bookings).
                  </p>
                )}
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-[11px] sm:text-xs text-zinc-500 font-medium block">Way of Payment</label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {(["ONLINE", "CASH", "MIXED"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    disabled={submittingPayment}
                    className={cn(
                      "py-2 sm:py-3 rounded-xl border text-[10px] sm:text-xs font-semibold uppercase transition-all flex flex-col items-center justify-center gap-1.5",
                      paymentMethod === method
                        ? "bg-violet-600/10 border-violet-500 text-violet-400 shadow-md shadow-violet-950/20"
                        : "bg-zinc-800/30 border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                    )}
                  >
                    <span>{method === "MIXED" ? "Cash + Online" : method.toLowerCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mixed payment split input options */}
            {paymentMethod === "MIXED" && (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 bg-zinc-950/20 p-2.5 sm:p-4 border border-zinc-800/60 rounded-xl animate-fade-in">
                <div>
                  <label className="text-[11px] sm:text-xs text-zinc-500 font-medium block mb-1">Cash Amount</label>
                  <input
                    type="number"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    disabled={submittingPayment}
                    placeholder="Cash amount"
                    className="input-field text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] sm:text-xs text-zinc-500 font-medium block mb-1">Online Amount</label>
                  <input
                    type="number"
                    value={onlineInput}
                    onChange={(e) => setOnlineInput(e.target.value)}
                    disabled={submittingPayment}
                    placeholder="Online amount"
                    className="input-field text-xs sm:text-sm"
                  />
                </div>

                {/* Validation check message */}
                <div className="col-span-2 flex items-start gap-2 text-[10px] sm:text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/10 p-2 sm:p-2.5 rounded-lg">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Note: Combined sum of Cash (₹{cashVal}) + Online (₹{onlineVal}) must exactly equal the Amount Paying Now (₹{amountPayingNowVal}).
                  </p>
                </div>
              </div>
            )}

            {/* Final Amount */}
            <div className="flex flex-col gap-1 sm:gap-1.5 bg-zinc-950/20 p-2.5 sm:p-3 border border-zinc-800/60 rounded-xl">
              <p className="text-[9px] sm:text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-0.5 sm:mb-1">Final Amount</p>
              {dynamicCouponDiscount > 0 && (
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-zinc-400">
                  <span>Games Total:</span>
                  <span className="font-semibold text-zinc-300">{formatCurrency(totalActualGamesAmount)}</span>
                </div>
              )}
              {dynamicCouponDiscount > 0 && (
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-emerald-400 font-medium">
                  <span>Coupon Discount{selectedCouponCode ? ` (${selectedCouponCode})` : ""}:</span>
                  <span className="font-semibold">-{formatCurrency(dynamicCouponDiscount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-zinc-400">
                <span>{isCreditsPayment ? "Credits" : "Games"} Invoice:</span>
                <span className="font-semibold text-white">{formatCurrency(totalNegotiatedVal)}</span>
              </div>
              {snacksVal > 0 && (
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-zinc-400">
                  <span>Snacks Invoice:</span>
                  <span className="font-semibold text-white">{formatCurrency(snacksVal)}</span>
                </div>
              )}
              {previouslyPaidTotal > 0 && !editPaymentId && (
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-emerald-400/80">
                  <span>Previously Paid:</span>
                  <span className="font-semibold">-{formatCurrency(previouslyPaidTotal)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] sm:text-xs text-zinc-400 border-t border-zinc-800/40 pt-1.5 mt-0.5">
                <span>Balance Due:</span>
                <span className="font-semibold text-white">
                  {formatCurrency(Math.max(0, totalWithSnacks - (editPaymentId ? 0 : previouslyPaidTotal)))}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-zinc-300">
                <span>Amount Paying Today:</span>
                <span className="text-xs sm:text-sm text-emerald-400 font-extrabold">{formatCurrency(amountPayingNowVal)}</span>
              </div>

              {amountPayingNowVal > Math.max(0, totalWithSnacks - (editPaymentId ? 0 : previouslyPaidTotal)) && (
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-amber-400 border-t border-amber-500/20 pt-1.5 mt-0.5 bg-amber-500/5 -mx-2.5 sm:-mx-3 -mb-2.5 sm:-mb-3 px-2.5 sm:px-3 pb-2.5 sm:pb-3 rounded-b-xl">
                  <span>Excess / Tip (Unallocated Revenue):</span>
                  <span className="font-bold">+{formatCurrency(amountPayingNowVal - Math.max(0, totalWithSnacks - (editPaymentId ? 0 : previouslyPaidTotal)))}</span>
                </div>
              )}
            </div>

            {/* Warning alert if sum is wrong */}
            {isSplitInvalid && (
              <div className="flex items-start gap-2 p-2.5 sm:p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[11px] sm:text-xs">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Mathematical error: Cash + Online (₹{(cashVal + onlineVal).toFixed(2)}) does not match Amount Paying Now (₹{amountPayingNowVal.toFixed(2)}).
                </p>
              </div>
            )}


            {/* Actions */}
            <div className="flex gap-2 border-t border-zinc-800/60 pt-3 sm:pt-4">
              <button
                type="button"
                onClick={() => handleClosePayModal()}
                disabled={submittingPayment}
                className="flex-1 py-2 sm:py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs sm:text-sm font-semibold rounded-xl hover:text-white hover:bg-zinc-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isSubmitDisabled}
                className={cn(
                  "flex-1 py-2 sm:py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2",
                  isSubmitDisabled
                    ? "opacity-50 cursor-not-allowed"
                    : "shadow-violet-900/30 hover:shadow-violet-800/40"
                )}
              >
                {submittingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saddling...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPaymentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedPaymentDetail(null)}
          />

          {(() => {
            const isCreditsModal = selectedPaymentDetail.bookings.some(b => b.game?.tag === "CREDITS");
            const actualGamesList = selectedPaymentDetail.bookings.filter(b => !b.id.startsWith("SNACK_") && b.game?.tag !== "SNACK" && b.game?.tag !== "CREDITS");
            const actualSnacksList = selectedPaymentDetail.bookings.filter(b => b.id.startsWith("SNACK_") || b.game?.tag === "SNACK");
            const totalActualGamesPrice = actualGamesList.reduce((sum, b) => sum + Number(b.finalAmount), 0);

            return (
              <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl z-10 p-3 sm:p-6 space-y-3 sm:space-y-5 animate-scale-in max-h-[90vh] custom-scroll overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2 sm:pb-3">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400 flex-shrink-0" />
                    <h3 className="text-sm sm:text-lg font-bold text-white font-mono truncate">
                      Payment Details: {selectedPaymentDetail.paymentId.startsWith("LEGACY-") ? "#LEGACY" : selectedPaymentDetail.paymentId}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedPaymentDetail(null)}
                    className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                {/* Payment Info Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-zinc-950/40 p-4 border border-zinc-900 rounded-xl">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Settled Date</p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {formatDate(selectedPaymentDetail.updatedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Payment Method</p>
                    <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-tight border border-zinc-700 mt-1">
                      {selectedPaymentDetail.paymentMethod}
                    </span>
                  </div>
                  {!isCreditsModal && (
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Actual Games</p>
                      <p className="text-xs font-bold text-zinc-400 mt-1">
                        {formatCurrency(totalActualGamesPrice)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">{isCreditsModal ? "Credits" : "Games"} Invoice</p>
                    <p className="text-xs font-bold text-zinc-200 mt-1">
                      {formatCurrency(selectedPaymentDetail.totalNegotiated)}
                    </p>
                  </div>
                  {!isCreditsModal && (
                    <div>
                      <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Snacks Invoice</p>
                      <p className="text-xs font-bold text-zinc-200 mt-1">
                        {formatCurrency(selectedPaymentDetail.totalSnacks)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Overall settled total */}
                <div className="flex items-center justify-between text-xs bg-amber-500/5 p-3 border border-amber-500/10 rounded-xl">
                  <p className="text-amber-400 font-bold">{isCreditsModal ? "Credits" : "Overall Transaction Invoice (Games + Snacks)"}:</p>
                  <p className="text-sm font-extrabold text-amber-400">
                    {formatCurrency(selectedPaymentDetail.totalNegotiated + selectedPaymentDetail.totalSnacks)}
                  </p>
                </div>

                {/* Amount Paid */}
                <div className="flex items-center justify-between text-xs bg-emerald-500/10 p-3 border border-emerald-500/20 rounded-xl">
                  <p className="text-emerald-400 font-bold">Amount Paid in this Transaction:</p>
                  <p className="text-sm font-extrabold text-emerald-400">
                    {formatCurrency(selectedPaymentDetail.totalCash + selectedPaymentDetail.totalOnline)}
                  </p>
                </div>

                {/* Split breakdown for MIXED payments */}
                {selectedPaymentDetail.paymentMethod === "MIXED" && (
                  <div className="flex items-center gap-6 text-xs bg-zinc-950/20 p-3 border border-zinc-800/60 rounded-xl">
                    <p className="text-zinc-400 font-medium">Split Breakdown:</p>
                    <p className="text-zinc-300">
                      <span className="font-semibold text-white">Cash Amount:</span> {formatCurrency(selectedPaymentDetail.totalCash)}
                    </p>
                    <p className="text-zinc-300">
                      <span className="font-semibold text-white">Online Amount:</span> {formatCurrency(selectedPaymentDetail.totalOnline)}
                    </p>
                  </div>
                )}

                {/* Bookings Included (Games) */}
                {actualGamesList.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Bookings Included ({actualGamesList.length})</h4>
                    <div className="border border-zinc-800/60 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-zinc-300 divide-y divide-zinc-800/40">
                        <thead className="bg-zinc-950/40 font-bold text-zinc-500 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Game / Slot</th>
                            <th className="p-3 text-right">Actual Price</th>
                            <th className="p-3 text-right">Invoice Price</th>
                            <th className="p-3 text-right">Paid Now</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                          {actualGamesList.map((bk) => (
                            <tr key={bk.id} className="hover:bg-zinc-800/20 transition-colors">
                              <td className="p-3">
                                <p className="font-semibold text-white">{bk.user?.name ?? bk.guestName ?? "Guest"}</p>
                                {bk.user?.phone || bk.guestPhone ? (
                                  <p className="text-[10px] text-zinc-600 mt-0.5">{bk.user?.phone ?? bk.guestPhone}</p>
                                ) : null}
                              </td>
                              <td className="p-3">
                                <p className="font-medium text-zinc-200">{bk.game.name}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                  {formatDate(bk.startDateTime)} ({formatTimeRange(bk.startDateTime, bk.endDateTime)})
                                </p>
                              </td>
                              <td className="p-3 text-right text-zinc-400 font-medium">
                                {formatCurrency(Number(bk.finalAmount))}
                              </td>
                              <td className="p-3 text-right text-amber-500 font-medium">
                                {formatCurrency(Number(bk.negotiatedAmount ?? bk.finalAmount))}
                              </td>
                              <td className="p-3 text-right text-emerald-400 font-semibold">
                                {formatCurrency(Number(bk.allocatedAmount ?? 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Snacks Purchased */}
                {actualSnacksList.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Snacks Purchased ({actualSnacksList.length})</h4>
                    <div className="border border-zinc-800/60 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-zinc-300 divide-y divide-zinc-800/40">
                        <thead className="bg-zinc-950/40 font-bold text-zinc-500 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Item</th>
                            <th className="p-3">Date</th>
                            <th className="p-3 text-right">Invoice Price</th>
                            <th className="p-3 text-right">Paid Now</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                          {actualSnacksList.map((sn) => (
                            <tr key={sn.id} className="hover:bg-zinc-800/20 transition-colors">
                              <td className="p-3">
                                <p className="font-semibold text-white">{sn.user?.name ?? sn.guestName ?? "Guest"}</p>
                                {sn.user?.phone || sn.guestPhone ? (
                                  <p className="text-[10px] text-zinc-600 mt-0.5">{sn.user?.phone ?? sn.guestPhone}</p>
                                ) : null}
                              </td>
                              <td className="p-3">
                                <p className="font-medium text-zinc-200">Snacks</p>
                              </td>
                              <td className="p-3 text-zinc-500">
                                {formatDateOnly(sn.startDateTime)}
                              </td>
                              <td className="p-3 text-right text-amber-500 font-medium">
                                {formatCurrency(Number(sn.finalAmount))}
                              </td>
                              <td className="p-3 text-right text-emerald-400 font-semibold">
                                {formatCurrency(Number(sn.allocatedAmount ?? 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Credits */}
                {isCreditsModal && (() => {
                  const creditsList = selectedPaymentDetail.bookings.filter(b => b.game?.tag === "CREDITS");
                  return creditsList.length > 0 ? (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Credits Added ({creditsList.length})</h4>
                      <div className="border border-zinc-800/60 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs text-zinc-300 divide-y divide-zinc-800/40">
                          <thead className="bg-zinc-950/40 font-bold text-zinc-500 uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="p-3">Customer</th>
                              <th className="p-3">Description</th>
                              <th className="p-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/40">
                            {creditsList.map((cr) => (
                              <tr key={cr.id} className="hover:bg-zinc-800/20 transition-colors">
                                <td className="p-3">
                                  <p className="font-semibold text-white">{cr.guestName ?? "Customer"}</p>
                                </td>
                                <td className="p-3">
                                  <p className="font-medium text-violet-300">Prepaid Credit Top-up</p>
                                </td>
                                <td className="p-3 text-right text-emerald-400 font-semibold">
                                  {formatCurrency(Number(cr.finalAmount))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Actions */}
                <div className="flex border-t border-zinc-800/60 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentDetail(null)}
                    className="w-full py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl hover:text-white hover:bg-zinc-700 transition-all"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Quick-add snack for a customer group, no settlement involved. Once a
          tab exists (either it already existed, or the first item above just
          created one), land on the same Snack Tab popup the Snacks page's
          Info button opens, instead of a stripped-down one. */}
      {snackQuickAddGroup && quickAddOrderId && (
        <SnackTabModal
          orderId={quickAddOrderId}
          onClose={() => { handleCloseQuickAddSnack(); fetchBookings(); }}
          onChanged={fetchBookings}
        />
      )}

      {snackQuickAddGroup && !quickAddOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => handleCloseQuickAddSnack()}
          />
          <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl z-10 p-3 sm:p-6 space-y-3 sm:space-y-4 animate-scale-in max-h-[90vh] custom-scroll overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2 sm:pb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                <h3 className="text-sm sm:text-lg font-bold text-white">Add Snack to Tab</h3>
              </div>
              <button onClick={() => handleCloseQuickAddSnack()} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
              <p className="text-xs text-zinc-500 uppercase font-semibold mb-1">Adding to Tab For</p>
              <p className="text-sm text-white font-medium">{snackQuickAddGroup.name}</p>
              {snackQuickAddGroup.phone && <p className="text-xs text-zinc-400">{snackQuickAddGroup.phone}</p>}
            </div>

            <SnackProductPicker onAdd={handleQuickAddSnackItem} addLabel="Add to Tab" />

            <p className="text-[11px] text-zinc-500">
              Items land as UNPAID on this customer's tab, ready to be selected next time you settle their payment.
            </p>

            <div className="border-t border-zinc-800/60 pt-4">
              <button
                type="button"
                onClick={() => handleCloseQuickAddSnack()}
                className="w-full py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl hover:text-white hover:bg-zinc-700 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
