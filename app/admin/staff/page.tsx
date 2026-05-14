"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Users, UserPlus, Trash2, Shield, Phone, Mail, 
  Loader2, Search, AlertCircle, Plus 
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "STAFF"
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users?role=STAFF&q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setStaff(data.users);
      }
    } catch (error) {
      toast.error("Failed to load staff members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchStaff, 300);
    return () => clearTimeout(t);
  }, [search]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (newStaff.name.length < 3) newErrors.name = "Name must be at least 3 characters";
    if (newStaff.phone.length !== 10) newErrors.phone = "Phone number must be exactly 10 digits";
    if (newStaff.password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (newStaff.email && (!newStaff.email.includes("@") || !newStaff.email.includes("."))) {
      newErrors.email = "Invalid email address (must include @ and .)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaff)
      });
      if (res.ok) {
        toast.success("Staff member added successfully");
        setIsAdding(false);
        setNewStaff({ name: "", phone: "", email: "", password: "", role: "STAFF" });
        setErrors({});
        fetchStaff();
      } else {
        const data = await res.json();
        if (data.error?.includes("phone")) {
          setErrors({ phone: "This phone number is already registered" });
        } else {
          toast.error(data.error || "Failed to add staff member");
        }
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  const handleRemoveStaff = async (id: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Staff member removed");
        fetchStaff();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove staff member");
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Staff Management</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage your parlour staff accounts</p>
        </div>
        <button 
          onClick={() => { setIsAdding(!isAdding); setErrors({}); }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95"
        >
          {isAdding ? <Users className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? "View All" : "Add Staff"}
        </button>
      </div>

      {isAdding ? (
        <div className="glass-card p-6 max-w-xl mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-white mb-6">Create Staff Account</h2>
          <form onSubmit={handleAddStaff} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Full Name *</label>
                <input 
                  required
                  value={newStaff.name} 
                  onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                  className={cn("input-field", errors.name && "border-red-500/50 bg-red-500/5")} 
                  placeholder="e.g. Bilal Khan" 
                />
                {errors.name && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.name}</p>}
              </div>
              
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Phone Number (10 Digits) *</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-bold">+92</span>
                   <input 
                     required
                     type="tel"
                     maxLength={10}
                     value={newStaff.phone} 
                     onChange={e => {
                       const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                       setNewStaff({...newStaff, phone: val});
                     }}
                     className={cn("input-field pl-12", errors.phone && "border-red-500/50 bg-red-500/5")} 
                     placeholder="3000000000" 
                   />
                </div>
                {errors.phone && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.phone}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Email (Optional)</label>
                <input 
                   type="email"
                   value={newStaff.email} 
                   onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                   className={cn("input-field", errors.email && "border-red-500/50 bg-red-500/5")} 
                   placeholder="staff@afterhours.pk" 
                />
                {errors.email && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.email}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Login Password *</label>
                <input 
                   required
                   type="password"
                   value={newStaff.password} 
                   onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                   className={cn("input-field", errors.password && "border-red-500/50 bg-red-500/5")} 
                   placeholder="Create a secure password" 
                />
                {errors.password && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.password}</p>}
              </div>
            </div>
            
            <div className="pt-4">
              <button type="submit" className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-900/20 active:scale-95">
                Create Staff Account
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
              placeholder="Search staff by name or phone..." 
              className="input-field pl-10"
            />
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950/20">
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Staff Member</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Contact</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Joined</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-20 text-center">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-zinc-500">Loading staff data...</p>
                      </td>
                    </tr>
                  ) : staff.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-20 text-center text-zinc-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No staff members found</p>
                      </td>
                    </tr>
                  ) : (
                    staff.map(u => (
                      <tr key={u.id} className="hover:bg-zinc-900/40 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
                              <Shield className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors">{u.name}</p>
                              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">
                                {u.role}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                              <Phone className="w-3 h-3 text-zinc-600" /> +92 {u.phone}
                            </div>
                            {u.email && (
                              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                <Mail className="w-3 h-3 text-zinc-600" /> {u.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[11px] font-bold text-zinc-600 uppercase tracking-tighter">
                          {format(new Date(u.createdAt), "MMM d, yyyy")}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button 
                            onClick={() => handleRemoveStaff(u.id)}
                            className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Remove Staff"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
