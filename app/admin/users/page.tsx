"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Search, Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight, Phone, Mail, User, AlertCircle, Loader2 } from "lucide-react";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface AppUser {
  id: string; name: string; phone: string; email?: string | null;
  notes?: string | null; isActive: boolean; createdAt: string; role: string;
  referredByPhone?: string | null; referredBy?: { name: string } | null;
}

interface UserModalProps {
  user?: AppUser | null;
  onClose: () => void;
  onSaved: () => void;
}

function UserModal({ user, onClose, onSaved }: UserModalProps) {
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [notes, setNotes] = useState(user?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // OTP Verification Wizard States
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (name.length < 3) newErrors.name = "Name must be at least 3 characters";
    if (phone.length !== 10) newErrors.phone = "Phone must be exactly 10 digits";
    if (email && (!email.includes("@") || !email.includes("."))) {
      newErrors.email = "Invalid email address (must include @ and .)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Send WhatsApp OTP logic
  async function triggerOtpSend() {
    setLoading(true);
    setErrors({});
    try {
      const res = await fetch("/api/users/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes("exists")) {
          setErrors({ phone: "This phone number is already registered" });
        } else {
          toast.error(data.error ?? "Failed to send verification code");
        }
        return false;
      }
      toast.success("Verification code sent to WhatsApp!");
      setShowOtpScreen(true);
      setOtpError("");
      return true;
    } catch {
      toast.error("Failed to connect to the server");
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Handle direct registration submit or initiating OTP flow
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (user) {
      // Editing an existing user — standard save (no OTP)
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, email: email || null, notes: notes || null }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error?.includes("phone")) {
            setErrors({ phone: "This phone number is already registered" });
          } else {
            toast.error(data.error ?? "Failed to update user");
          }
          return;
        }
        toast.success("User updated!");
        onSaved();
      } catch {
        toast.error("Something went wrong");
      } finally {
        setLoading(false);
      }
    } else {
      // Creating a new user — initiate OTP flow
      await triggerOtpSend();
    }
  }

  // Handle OTP verification and user creation
  async function handleVerifyAndCreate() {
    if (otpCode.length < 4) {
      setOtpError("Please enter a valid OTP code");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      // 1. Verify the code
      const verifyRes = await fetch("/api/users/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otpCode }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setOtpError(verifyData.error ?? "Invalid code");
        return;
      }

      // 2. Code is verified, create the user
      await createUser(true);
    } catch {
      setOtpError("Server connection error during verification");
    } finally {
      setOtpLoading(false);
    }
  }

  // Helper method to make the final user creation request
  async function createUser(isPhoneVerified: boolean) {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email || null,
          notes: notes || null,
          isPhoneVerified,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to onboard customer");
        return;
      }
      toast.success(isPhoneVerified ? "User verified & added!" : "User added (skipped verification)!");
      onSaved();
    } catch {
      toast.error("Something went wrong during user creation");
    }
  }

  // Handle skipping OTP flow
  async function handleSkipVerification() {
    setOtpLoading(true);
    try {
      await createUser(false);
    } finally {
      setOtpLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-md animate-scale-in">
        {!showOtpScreen ? (
          <>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              {user ? <Edit2 className="w-5 h-5 text-violet-400" /> : <Plus className="w-5 h-5 text-violet-400" />}
              {user ? "Edit User" : "Add New User"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Full Name *</label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Ahmed Ali" 
                  className={cn("input-field", errors.name && "border-red-500/50 bg-red-500/5")} 
                />
                {errors.name && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.name}</p>}
              </div>
              
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Phone Number (10 Digits) *</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-bold">+91</span>
                   <input 
                     type="tel"
                     maxLength={10}
                     value={phone} 
                     onChange={e => {
                       const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                       setPhone(val);
                     }} 
                     placeholder="3000000000" 
                     className={cn("input-field pl-12", errors.phone && "border-red-500/50 bg-red-500/5")} 
                   />
                </div>
                {errors.phone && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.phone}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Email Address</label>
                <input 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  type="email" 
                  placeholder="customer@example.com" 
                  className={cn("input-field", errors.email && "border-red-500/50 bg-red-500/5")} 
                />
                {errors.email && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.email}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Internal Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-field resize-none" placeholder="Any special requests or details..." />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-bold hover:bg-zinc-900 transition-all">Cancel</button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-900/20 active:scale-95 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : user ? "Update" : "Add User"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Phone className="w-5 h-5 text-violet-400" />
                Verify Phone Number
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                We have sent a 6-digit verification code via WhatsApp to <span className="text-white font-bold">+91 {phone}</span>.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Verification Code</label>
                <input 
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className={cn("input-field tracking-[0.5em] text-center text-lg font-bold", otpError && "border-red-500/55 bg-red-500/5")}
                />
                {otpError && (
                  <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {otpError}
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <button 
                  type="button" 
                  onClick={handleVerifyAndCreate}
                  disabled={otpLoading || otpCode.length < 4}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-900/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Onboard"}
                </button>

                <button 
                  type="button" 
                  onClick={handleSkipVerification}
                  disabled={otpLoading}
                  className="w-full py-3 rounded-xl border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900 text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                >
                  Skip Verification
                </button>
              </div>

              <div className="flex justify-between items-center text-xs pt-4 border-t border-zinc-900">
                <button 
                  type="button" 
                  onClick={() => setShowOtpScreen(false)}
                  className="text-zinc-500 hover:text-zinc-300 font-semibold"
                >
                  ← Edit Details
                </button>
                <button 
                  type="button" 
                  onClick={triggerOtpSend}
                  disabled={loading}
                  className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1"
                >
                  {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Resend OTP
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalUser, setModalUser] = useState<AppUser | null | undefined>(undefined); // undefined=closed, null=new
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const LIMIT = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...(search ? { q: search } : {}) });
      const res = await fetch(`/api/users?${params}`);
      if (res.ok) { const d = await res.json(); setUsers(d.users); setTotal(d.total); }
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      toast.success("User deleted"); setDeleteId(null); fetchUsers();
    } catch { toast.error("Failed to delete"); }
    finally { setDeleting(false); }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Users</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">{total} registered customers in your database</p>
        </div>
        <button onClick={() => setModalUser(null)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or phone…" className="input-field pl-10" />
        </div>
        <button onClick={fetchUsers} className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all active:rotate-180 duration-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="glass-card overflow-hidden border-zinc-900/50 shadow-2xl">
        {loading ? <TableSkeleton rows={8} /> : users.length === 0 ? (
          <EmptyState icon={User} title="No users found"
            description={search ? "Try a different search" : "Your customer database is empty."}
            action={<button onClick={() => setModalUser(null)} className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl"><Plus className="w-4 h-4" /> Add your first user</button>} />
        ) : (
          <div className="divide-y divide-zinc-900">
            {users.map(u => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-zinc-900/40 transition-colors group">
                {/* Mobile Top Row: Avatar, Name, Actions */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/20 group-hover:border-violet-500/30 transition-all duration-300">
                    <span className="text-sm font-bold text-violet-400">{getInitials(u.name)}</span>
                  </div>
                  <div className="flex-1 sm:hidden">
                    <p className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors duration-300">{u.name}</p>
                  </div>
                  <div className="flex gap-1 sm:hidden">
                    <button onClick={() => setModalUser(u)} className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-all"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(u.id)} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 pl-14 sm:pl-0">
                  <p className="hidden sm:block text-sm font-bold text-white group-hover:text-violet-400 transition-colors duration-300">{u.name}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium"><Phone className="w-3 h-3 text-zinc-600" /> +91 {u.phone}</span>
                      {u.email && <span className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium"><Mail className="w-3 h-3 text-zinc-600" /> {u.email}</span>}
                    </div>
                    {u.referredByPhone && (
                      <span className="inline-flex w-fit items-center gap-1.5 text-[11px] text-emerald-500/80 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10">
                        Referred by: {u.referredBy?.name ? `${u.referredBy.name} (${u.referredByPhone})` : u.referredByPhone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Desktop Date & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4 pl-14 sm:pl-0 mt-1 sm:mt-0">
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="text-[10px] font-bold text-zinc-500 sm:text-zinc-600 uppercase tracking-widest">{formatRelative(u.createdAt)}</p>
                  </div>
                  <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModalUser(u)} className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteId(u.id)} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-900 bg-zinc-950/20">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{total} total users · page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg text-zinc-500 hover:text-white disabled:opacity-20 hover:bg-zinc-900 transition-all"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg text-zinc-500 hover:text-white disabled:opacity-20 hover:bg-zinc-900 transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {modalUser !== undefined && (
        <UserModal user={modalUser} onClose={() => setModalUser(undefined)} onSaved={() => { setModalUser(undefined); fetchUsers(); }} />
      )}
      <ConfirmDialog open={!!deleteId} title="Delete User" description="This will permanently delete the user. Past bookings linked to them will not be deleted." confirmLabel="Delete User" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} destructive />
    </div>
  );
}
