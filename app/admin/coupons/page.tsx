"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Tag, Plus, Trash2, Edit, CheckSquare, Square, 
  Loader2, Search, AlertCircle, Percent, ToggleLeft, ToggleRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Coupon {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string | number;
  minBookingAmount: string | number;
  maxDiscountAmount: string | number | null;
  allowedRoles: string[];
  isActive: boolean;
  usedCount: number;
  createdAt: string;
}

export default function CouponsManagementPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    minBookingAmount: "0",
    maxDiscountAmount: "",
    allowedRoles: ["CUSTOMER"],
    isActive: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/coupons");
      if (res.ok) {
        const data = await res.json();
        setCoupons(data);
      } else {
        toast.error("Failed to load coupons");
      }
    } catch (error) {
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleRoleToggle = (role: string) => {
    const current = [...form.allowedRoles];
    const index = current.indexOf(role);
    if (index > -1) {
      // Don't allow empty roles list
      if (current.length === 1) {
        toast.warning("At least one role must be allowed for this coupon");
        return;
      }
      current.splice(index, 1);
    } else {
      current.push(role);
    }
    setForm({ ...form, allowedRoles: current });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.code.trim()) newErrors.code = "Coupon code is required";
    if (form.code.trim().length < 3) newErrors.code = "Code must be at least 3 characters";
    
    const value = parseFloat(form.discountValue);
    if (isNaN(value) || value <= 0) {
      newErrors.discountValue = "Discount value must be a positive number";
    } else if (form.discountType === "PERCENTAGE" && value > 100) {
      newErrors.discountValue = "Percentage discount cannot exceed 100%";
    }

    const minAmount = parseFloat(form.minBookingAmount);
    if (isNaN(minAmount) || minAmount < 0) {
      newErrors.minBookingAmount = "Minimum booking amount must be 0 or more";
    }

    if (form.maxDiscountAmount) {
      const maxAmount = parseFloat(form.maxDiscountAmount);
      if (isNaN(maxAmount) || maxAmount <= 0) {
        newErrors.maxDiscountAmount = "Max discount cap must be a positive number";
      }
    }

    if (form.allowedRoles.length === 0) {
      newErrors.allowedRoles = "At least one role must be ticked";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const isEdit = !!editingCoupon;
      const url = isEdit ? `/api/admin/coupons/${editingCoupon.id}` : "/api/admin/coupons";
      const method = isEdit ? "PUT" : "POST";

      const payload = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        minBookingAmount: parseFloat(form.minBookingAmount),
        maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : null,
        allowedRoles: form.allowedRoles,
        isActive: form.isActive,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEdit ? "Coupon updated successfully" : "Coupon created successfully");
        setIsAdding(false);
        setEditingCoupon(null);
        resetForm();
        fetchCoupons();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save coupon");
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  const startEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minBookingAmount: String(coupon.minBookingAmount),
      maxDiscountAmount: coupon.maxDiscountAmount ? String(coupon.maxDiscountAmount) : "",
      allowedRoles: coupon.allowedRoles,
      isActive: coupon.isActive,
    });
    setIsAdding(true);
    setErrors({});
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon? If it has been used in bookings, it will be deactivated instead.")) return;

    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Coupon deleted successfully");
        fetchCoupons();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete coupon");
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  const toggleCouponStatus = async (coupon: Coupon) => {
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...coupon,
          isActive: !coupon.isActive,
        }),
      });

      if (res.ok) {
        toast.success(`Coupon ${!coupon.isActive ? "activated" : "deactivated"}`);
        fetchCoupons();
      } else {
        toast.error("Failed to toggle coupon status");
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  const resetForm = () => {
    setForm({
      code: "",
      discountType: "PERCENTAGE",
      discountValue: "",
      minBookingAmount: "0",
      maxDiscountAmount: "",
      allowedRoles: ["CUSTOMER"],
      isActive: true,
    });
    setErrors({});
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Coupon Management</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Create and manage coupon codes with role-based restrictions</p>
        </div>
        <button 
          onClick={() => { 
            if (isAdding) {
              setIsAdding(false);
              setEditingCoupon(null);
              resetForm();
            } else {
              setIsAdding(true);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95 animate-in fade-in"
        >
          {isAdding ? <Tag className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? "View Coupons" : "Create Coupon"}
        </button>
      </div>

      {isAdding ? (
        <div className="glass-card p-6 max-w-xl mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-white mb-6">
            {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create Coupon"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Coupon Code *</label>
                <input 
                  required
                  value={form.code} 
                  onChange={e => setForm({...form, code: e.target.value})}
                  className={cn("input-field uppercase font-mono tracking-widest", errors.code && "border-red-500/50 bg-red-500/5")} 
                  placeholder="e.g. WELCOME50" 
                  disabled={!!editingCoupon}
                />
                {errors.code && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.code}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Discount Type *</label>
                  <select 
                    value={form.discountType}
                    onChange={e => {
                      setForm({
                        ...form, 
                        discountType: e.target.value as any, 
                        maxDiscountAmount: e.target.value === "FIXED" ? "" : form.maxDiscountAmount 
                      });
                    }}
                    className="input-field"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (Rs.)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">
                    Discount Value *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-bold">
                      {form.discountType === "PERCENTAGE" ? <Percent className="w-3.5 h-3.5" /> : "Rs."}
                    </span>
                    <input 
                      required
                      type="number"
                      step="any"
                      value={form.discountValue} 
                      onChange={e => setForm({...form, discountValue: e.target.value})}
                      className={cn("input-field pl-10", errors.discountValue && "border-red-500/50 bg-red-500/5")} 
                      placeholder={form.discountType === "PERCENTAGE" ? "10" : "100"} 
                    />
                  </div>
                  {errors.discountValue && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.discountValue}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Min Purchase Value *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold">Rs.</span>
                    <input 
                      required
                      type="number"
                      step="any"
                      value={form.minBookingAmount} 
                      onChange={e => setForm({...form, minBookingAmount: e.target.value})}
                      className={cn("input-field pl-10", errors.minBookingAmount && "border-red-500/50 bg-red-500/5")} 
                      placeholder="0" 
                    />
                  </div>
                  {errors.minBookingAmount && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.minBookingAmount}</p>}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">
                    Max Discount Cap {form.discountType === "FIXED" && "(N/A)"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold">Rs.</span>
                    <input 
                      type="number"
                      step="any"
                      disabled={form.discountType === "FIXED"}
                      value={form.maxDiscountAmount} 
                      onChange={e => setForm({...form, maxDiscountAmount: e.target.value})}
                      className={cn("input-field pl-10 disabled:opacity-40 disabled:cursor-not-allowed", errors.maxDiscountAmount && "border-red-500/50 bg-red-500/5")} 
                      placeholder="e.g. 200" 
                    />
                  </div>
                  {errors.maxDiscountAmount && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.maxDiscountAmount}</p>}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5 block">Allowed Booking Roles *</label>
                <div className="flex flex-wrap gap-6 bg-zinc-950/40 p-4 rounded-xl border border-zinc-900">
                  {["ADMIN", "STAFF", "CUSTOMER"].map((role) => {
                    const isChecked = form.allowedRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleToggle(role)}
                        className="flex items-center gap-2 text-xs font-bold text-white hover:text-violet-400 transition-colors"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-violet-500" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-700" />
                        )}
                        <span>{role}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.allowedRoles && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.allowedRoles}</p>}
              </div>

              <div className="flex items-center justify-between bg-zinc-950/40 p-4 rounded-xl border border-zinc-900">
                <div>
                  <h3 className="text-xs font-bold text-white">Active Status</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Allows this coupon to be redeemed if enabled</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  {form.isActive ? (
                    <ToggleRight className="w-10 h-10 text-violet-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-zinc-700" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingCoupon(null);
                  resetForm();
                }}
                className="w-1/2 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="w-1/2 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-900/20 active:scale-95"
              >
                {editingCoupon ? "Save Changes" : "Create Coupon"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search coupons by code..." 
              className="input-field pl-10 font-mono uppercase"
            />
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950/20">
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Code & Type</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Discount</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Restrictions</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Usage</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-20 text-center">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-zinc-500">Loading coupons...</p>
                      </td>
                    </tr>
                  ) : filteredCoupons.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-20 text-center text-zinc-500">
                        <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No coupons found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCoupons.map(c => (
                      <tr key={c.id} className="hover:bg-zinc-900/40 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center border",
                              c.isActive 
                                ? "bg-violet-600/10 border-violet-500/20 text-violet-400"
                                : "bg-zinc-900 border-zinc-800 text-zinc-600"
                            )}>
                              <Tag className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold font-mono text-white uppercase tracking-wider group-hover:text-violet-400 transition-colors">
                                {c.code}
                              </p>
                              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
                                {c.discountType}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-white flex items-center gap-0.5">
                              {c.discountType === "PERCENTAGE" ? (
                                <>{c.discountValue}% <span className="text-zinc-600 font-normal">Off</span></>
                              ) : (
                                <>Rs. {c.discountValue} <span className="text-zinc-600 font-normal">Off</span></>
                              )}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              Min Booking: Rs. {c.minBookingAmount}
                              {c.maxDiscountAmount && ` • Cap: Rs. ${c.maxDiscountAmount}`}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {c.allowedRoles.map((role) => (
                              <span 
                                key={role}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[9px] font-bold uppercase border tracking-tight",
                                  role === "ADMIN" && "text-violet-400 bg-violet-500/5 border-violet-500/10",
                                  role === "STAFF" && "text-blue-400 bg-blue-500/5 border-blue-500/10",
                                  role === "CUSTOMER" && "text-emerald-400 bg-emerald-500/5 border-emerald-500/10"
                                )}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-white">{c.usedCount} Redemptions</p>
                            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Usage counter</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => toggleCouponStatus(c)}
                            className="flex items-center gap-1.5"
                          >
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              c.isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-600"
                            )} />
                            <span className={cn(
                              "text-xs font-bold uppercase tracking-tight",
                              c.isActive ? "text-emerald-400" : "text-zinc-600"
                            )}>
                              {c.isActive ? "Active" : "Inactive"}
                            </span>
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => startEdit(c)}
                              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
                              title="Edit Coupon"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(c.id)}
                              className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              title="Delete Coupon"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
