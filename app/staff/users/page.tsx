"use client";

import { useState, useEffect } from "react";
import { Plus, Search, User, AlertCircle, Loader2 } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { toast } from "sonner";

interface AppUser { id: string; name: string; phone: string; email?: string | null; notes?: string | null; }

function UserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/users", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ name, phone, email: email || null }) 
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes("phone")) {
          setErrors({ phone: "This phone number is already registered" });
        } else {
          toast.error(data.error ?? "Failed to save");
        }
        return;
      }
      toast.success("User added successfully!"); 
      onSaved();
    } catch { 
      toast.error("Something went wrong"); 
    } finally { 
      setLoading(false); 
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-md animate-scale-in">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-violet-400" />
          Add New User
        </h2>
        <form onSubmit={submit} className="space-y-5">
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
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-bold">+92</span>
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

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-bold hover:bg-zinc-900 transition-all">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-900/20 active:scale-95 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch(`/api/users?q=${encodeURIComponent(search)}&limit=30`);
    if (res.ok) { const d = await res.json(); setUsers(d.users); }
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Users</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Search and manage customers</p>
        </div>
        <button onClick={() => setShowModal(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="relative max-w-sm group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…" className="input-field pl-10" />
      </div>

      <div className="glass-card overflow-hidden border-zinc-900/50">
        {loading ? <TableSkeleton rows={6} /> : (
          <div className="divide-y divide-zinc-900">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-900/40 transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-violet-600/10 border border-violet-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/20 group-hover:border-violet-500/30 transition-all duration-300">
                  <span className="text-xs font-bold text-violet-400">{getInitials(u.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors duration-300">{u.name}</p>
                  <p className="text-xs text-zinc-500 font-medium">+92 {u.phone}{u.email ? ` · ${u.email}` : ""}</p>
                </div>
                <a href={`/staff/bookings/new?userId=${u.id}`} 
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-violet-600/10 text-violet-400 border border-violet-500/10 hover:bg-violet-600 hover:text-white transition-all duration-300">
                  Book Now
                </a>
              </div>
            ))}
            {users.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                 <User className="w-12 h-12 text-zinc-800 mb-3" />
                 <p className="text-sm text-zinc-500 font-medium">No users found matching your search</p>
              </div>
            )}
          </div>
        )}
      </div>
      {showModal && <UserModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchUsers(); }} />}
    </div>
  );
}
