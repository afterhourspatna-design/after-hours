"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Plus, Search, Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Phone, Mail, User,
  AlertCircle, Loader2, Shield, KeyRound, Copy, Check, X, Power, Info,
} from "lucide-react";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Role = "ADMIN" | "STAFF" | "CUSTOMER";
type RoleTab = "ALL" | Role;

interface AppUser {
  id: string; name: string; phone: string; email?: string | null;
  notes?: string | null; isActive: boolean; createdAt: string; role: Role;
  referredByPhone?: string | null; referredBy?: { name: string } | null;
}

const ROLE_TABS: { value: RoleTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ADMIN", label: "Admins" },
  { value: "STAFF", label: "Staff" },
  { value: "CUSTOMER", label: "Customers" },
];

function GeneratedPasswordPanel({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative glass-card p-6 w-full max-w-sm animate-scale-in">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6 text-emerald-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Account created for {name}</h3>
        <p className="text-sm text-zinc-500 mb-4 leading-relaxed">
          Share this password with them directly. <span className="text-amber-400 font-semibold">It won't be shown again</span> — they'll be asked to set their own on first login.
        </p>
        <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 mb-5">
          <code className="flex-1 text-lg font-bold text-white tracking-wider">{password}</code>
          <button onClick={copy} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}

interface UserModalProps {
  user?: AppUser | null;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (created?: { name: string; generatedPassword: string }) => void;
  onToggleActive?: (u: AppUser) => Promise<void>;
  onResetPassword?: (u: AppUser) => Promise<void>;
  resettingId?: string | null;
}

function UserModal({ user, isAdmin, onClose, onSaved, onToggleActive, onResetPassword, resettingId }: UserModalProps) {
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [notes, setNotes] = useState(user?.notes ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "CUSTOMER");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [referrerQuery, setReferrerQuery] = useState("");
  const [referrerResults, setReferrerResults] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [referrerSelected, setReferrerSelected] = useState<{ id: string; name: string; phone: string } | null>(
    user?.referredByPhone ? { id: "", name: user.referredBy?.name ?? "", phone: user.referredByPhone } : null
  );

  const showReferredBy = user ? user.role === "CUSTOMER" : role === "CUSTOMER";

  useEffect(() => {
    if (referrerSelected || referrerQuery.length < 2) {
      setReferrerResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users?q=${encodeURIComponent(referrerQuery)}&role=ALL&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setReferrerResults(data.users ?? []);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [referrerQuery, referrerSelected]);

  const [deactivating, setDeactivating] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"deactivate" | "reset" | null>(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggleActive() {
    if (!user || !onToggleActive) return;
    setDeactivating(true);
    try {
      await onToggleActive(user);
      setConfirmAction(null);
      onClose();
    } finally {
      setDeactivating(false);
    }
  }

  async function handleResetPassword() {
    if (!user || !onResetPassword) return;
    await onResetPassword(user);
    setConfirmAction(null);
    onClose();
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (user) {
        const res = await fetch(`/api/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, phone, email: email || null, notes: notes || null,
            ...(showReferredBy ? { referredBy: referrerSelected?.phone ?? null } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error?.toLowerCase().includes("referrer")) {
            setErrors({ referredBy: data.error });
          } else if (data.error?.includes("phone")) {
            setErrors({ phone: "This phone number is already registered" });
          } else {
            toast.error(data.error ?? "Failed to update user");
          }
          return;
        }
        toast.success("User updated!");
        onSaved();
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone,
            email: email || null,
            notes: notes || null,
            role: isAdmin ? role : "CUSTOMER",
            referredBy: referrerSelected?.phone ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error?.toLowerCase().includes("referrer")) {
            setErrors({ referredBy: data.error });
          } else if (data.error?.includes("phone")) {
            setErrors({ phone: "This phone number is already registered" });
          } else {
            toast.error(data.error ?? "Failed to onboard user");
          }
          return;
        }
        onSaved({ name: data.name, generatedPassword: data.generatedPassword });
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-4 sm:p-6 w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto">
        <h2 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
          {user ? <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" /> : <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />}
          {user ? "Edit User" : "Add New User"}
        </h2>

        {isAdmin && user && (
          <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-5">
            <button
              type="button"
              onClick={() => user.isActive ? setConfirmAction("deactivate") : handleToggleActive()}
              disabled={deactivating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-xl border border-zinc-800 text-[11px] sm:text-xs font-bold text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all disabled:opacity-50"
            >
              {deactivating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
              {user.isActive ? "Deactivate" : "Reactivate"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction("reset")}
              disabled={resettingId === user.id}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-xl border border-zinc-800 text-[11px] sm:text-xs font-bold text-zinc-400 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/10 transition-all disabled:opacity-50"
            >
              {resettingId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              Reset Password
            </button>
          </div>
        )}

        {user && (
          <ConfirmDialog
            open={confirmAction !== null}
            title={confirmAction === "reset" ? "Reset Password" : "Deactivate User"}
            description={
              confirmAction === "reset"
                ? `This generates a new temporary password for ${user.name} and signs them out of their current one. Share the new password with them directly.`
                : `${user.name} will no longer be able to log in until reactivated.`
            }
            confirmLabel={confirmAction === "reset" ? "Reset Password" : "Deactivate"}
            onConfirm={confirmAction === "reset" ? handleResetPassword : handleToggleActive}
            onCancel={() => setConfirmAction(null)}
            loading={confirmAction === "reset" ? resettingId === user.id : deactivating}
            destructive={confirmAction === "deactivate"}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {isAdmin && !user && (
                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Role</label>
                  <div className="relative" ref={roleDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setRoleDropdownOpen(o => !o)}
                      className="input-field flex items-center justify-between text-xs sm:text-sm font-bold uppercase tracking-tight cursor-pointer"
                    >
                      {role}
                      <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform flex-shrink-0", roleDropdownOpen && "rotate-180")} />
                    </button>
                    {roleDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
                        {(["CUSTOMER", "STAFF", "ADMIN"] as Role[]).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => { setRole(r); setRoleDropdownOpen(false); }}
                            className={cn(
                              "w-full text-left px-3.5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-tight transition-colors",
                              role === r ? "bg-orange-600 text-white" : "text-zinc-300 hover:bg-zinc-800"
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
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

              {showReferredBy && (
                <div className="relative">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Referred By (Optional)</label>
                  {referrerSelected ? (
                    <div className="flex items-center justify-between input-field">
                      <span className="text-sm text-white">
                        {referrerSelected.name || referrerSelected.phone}
                        {referrerSelected.name && <span className="text-zinc-500"> ({referrerSelected.phone})</span>}
                      </span>
                      <button type="button" onClick={() => { setReferrerSelected(null); setReferrerQuery(""); }} className="text-zinc-500 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        value={referrerQuery}
                        onChange={e => setReferrerQuery(e.target.value)}
                        placeholder="Search by name or phone"
                        className={cn("input-field pl-9", errors.referredBy && "border-red-500/50 bg-red-500/5")}
                      />
                    </div>
                  )}
                  {referrerResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                      {referrerResults.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setReferrerSelected(u); setReferrerResults([]); }}
                          className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                          {u.name} <span className="text-zinc-500 text-xs">({u.phone})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.referredBy && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.referredBy}</p>}
                </div>
              )}

              {isAdmin && (
                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Internal Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-field resize-none" placeholder="Any special requests or details..." />
                </div>
              )}

              {!user && (
                <p className="text-[11px] text-zinc-500 bg-zinc-950/40 border border-zinc-900 rounded-xl p-3 flex items-start gap-2">
                  <KeyRound className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                  A temporary password will be generated automatically — you'll see it once after creating this account.
                </p>
              )}

              <div className="flex gap-2 sm:gap-3 pt-2 sm:pt-4">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 sm:py-3 rounded-xl border border-zinc-800 text-zinc-400 text-xs sm:text-sm font-bold hover:bg-zinc-900 transition-all">Cancel</button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 sm:py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-orange-900/20 active:scale-95 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : user ? "Update" : "Add User"}
                </button>
              </div>
            </form>
      </div>
    </div>
  );
}

export default function UserManagementScreen({ viewerRole }: { viewerRole: "ADMIN" | "STAFF" }) {
  const isAdmin = viewerRole === "ADMIN";
  const [roleTab, setRoleTab] = useState<RoleTab>(isAdmin ? "ALL" : "CUSTOMER");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalUser, setModalUser] = useState<AppUser | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<{ name: string; password: string } | null>(null);
  const LIMIT = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        role: roleTab,
        ...(search ? { q: search } : {}),
      });
      const res = await fetch(`/api/users?${params}`);
      if (res.ok) { const d = await res.json(); setUsers(d.users); setTotal(d.total); }
    } finally {
      setLoading(false);
    }
  }, [page, search, roleTab]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function toggleActive(u: AppUser) {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: u.role, isActive: !u.isActive }),
      });
      if (res.ok) {
        toast.success(u.isActive ? "User deactivated" : "User reactivated");
        fetchUsers();
      } else {
        toast.error("Failed to update user");
      }
    } catch {
      toast.error("Something went wrong");
    }
  }

  async function resetPassword(u: AppUser) {
    setResettingId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setGeneratedPassword({ name: u.name, password: data.generatedPassword });
      } else {
        toast.error(data.error ?? "Failed to reset password");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setResettingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? "User removed");
        fetchUsers();
      } else {
        toast.error(data.error ?? "Failed to remove user");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Users</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Users</h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium">
            {total} {roleTab === "ALL" ? "" : roleTab.toLowerCase() + " "}account{total === 1 ? "" : "s"}
            {isAdmin ? " — manage accounts, roles and access" : " — browse customers and start a booking"}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full md:flex-row md:items-center md:w-auto">
          <div className="relative w-full md:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or phone…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all" />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button onClick={fetchUsers}
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all active:rotate-180 duration-500 flex-shrink-0">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setModalUser(null)}
              className="flex-1 md:flex-none justify-center bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2 active:scale-95">
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto">
          {ROLE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setRoleTab(t.value); setPage(1); }}
              className={cn(
                "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all border flex-shrink-0",
                roleTab === t.value ? "bg-orange-600 border-orange-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="glass-card overflow-hidden border-zinc-900/50 shadow-2xl">
        {loading ? <TableSkeleton rows={8} /> : users.length === 0 ? (
          <EmptyState icon={User} title="No users found"
            description={search ? "Try a different search" : "Nothing here yet."}
            action={<button onClick={() => setModalUser(null)} className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white text-sm font-bold rounded-xl"><Plus className="w-4 h-4" /> Add your first user</button>} />
        ) : (
          <div className="divide-y divide-zinc-900">
            {users.map(u => (
              <div key={u.id} className={cn(
                "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-4 transition-colors group",
                u.isActive ? "hover:bg-zinc-900/40" : "bg-red-950/20 hover:bg-red-950/30"
              )}>
                <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                  <div className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-300",
                    u.role === "ADMIN" ? "bg-violet-600/10 border-violet-500/10" : u.role === "STAFF" ? "bg-blue-600/10 border-blue-500/10" : "bg-emerald-600/10 border-emerald-500/10"
                  )}>
                    {u.role === "CUSTOMER" ? <span className="text-xs sm:text-sm font-bold text-emerald-400">{getInitials(u.name)}</span> : <Shield className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", u.role === "ADMIN" ? "text-violet-400" : "text-blue-400")} />}
                  </div>
                  <div className="flex-1 sm:hidden min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-white truncate">{u.name}</p>
                      {isAdmin && (
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded flex-shrink-0",
                          u.role === "ADMIN" ? "text-violet-400 bg-violet-500/10" : u.role === "STAFF" ? "text-blue-400 bg-blue-500/10" : "text-emerald-400 bg-emerald-500/10"
                        )}>{u.role}</span>
                      )}
                      {!u.isActive && <span className="text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded text-red-400 bg-red-500/10 flex-shrink-0">Inactive</span>}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0 pl-0 sm:pl-0">
                  <div className="hidden sm:flex items-center gap-2">
                    <p className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors duration-300">{u.name}</p>
                    {isAdmin && (
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded",
                        u.role === "ADMIN" ? "text-violet-400 bg-violet-500/10" : u.role === "STAFF" ? "text-blue-400 bg-blue-500/10" : "text-emerald-400 bg-emerald-500/10"
                      )}>{u.role}</span>
                    )}
                    {!u.isActive && <span className="text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded text-red-400 bg-red-500/10">Inactive</span>}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-0.5 sm:mt-1">
                    <div className="flex items-center justify-between gap-2 sm:contents">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
                        <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-400 font-medium"><Phone className="w-3 h-3 text-zinc-600 flex-shrink-0" /> +91 {u.phone}</span>
                        {u.email && <span className="flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-500 font-medium truncate"><Mail className="w-3 h-3 text-zinc-600 flex-shrink-0" /> {u.email}</span>}
                      </div>
                      <a href={`/${isAdmin ? "admin" : "staff"}/bookings/new?userId=${u.id}`}
                        className="sm:hidden text-[11px] font-bold px-3 py-1.5 rounded-xl bg-orange-600/10 text-orange-400 border border-orange-500/10 hover:bg-orange-600 hover:text-white transition-all duration-300 flex-shrink-0">
                        Book Now
                      </a>
                    </div>
                    {u.referredByPhone && (
                      <span className="inline-flex w-fit items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-500/80 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10">
                        Referred by: {u.referredBy?.name ? `${u.referredBy.name} (${u.referredByPhone})` : u.referredByPhone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pl-0 mt-0.5 sm:mt-0">
                  <p className="text-[9px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex-shrink-0">{formatRelative(u.createdAt)}</p>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <a href={`/${isAdmin ? "admin" : "staff"}/bookings/new?userId=${u.id}`}
                      className="hidden sm:inline-flex text-xs font-bold px-4 py-2 rounded-xl bg-orange-600/10 text-orange-400 border border-orange-500/10 hover:bg-orange-600 hover:text-white transition-all duration-300 flex-shrink-0">
                      Book Now
                    </a>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setModalUser(u)} className="p-1.5 sm:p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-all" title="Info">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(u)} className="p-1.5 sm:p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-900 bg-zinc-950/20">
            <p className="text-[9px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{total} total · page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 sm:p-2 rounded-lg text-zinc-500 hover:text-white disabled:opacity-20 hover:bg-zinc-900 transition-all"><ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 sm:p-2 rounded-lg text-zinc-500 hover:text-white disabled:opacity-20 hover:bg-zinc-900 transition-all"><ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {modalUser !== undefined && (
        <UserModal
          user={modalUser}
          isAdmin={isAdmin}
          onClose={() => setModalUser(undefined)}
          onSaved={(created) => {
            setModalUser(undefined);
            fetchUsers();
            if (created) setGeneratedPassword({ name: created.name, password: created.generatedPassword });
          }}
          onToggleActive={toggleActive}
          onResetPassword={resetPassword}
          resettingId={resettingId}
        />
      )}

      {generatedPassword && (
        <GeneratedPasswordPanel
          name={generatedPassword.name}
          password={generatedPassword.password}
          onClose={() => setGeneratedPassword(null)}
        />
      )}

      {isAdmin && (
        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete User"
          description="If they have past bookings, they'll be deactivated instead of deleted."
          confirmLabel="Delete User"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
          destructive
        />
      )}

    </div>
  );
}
