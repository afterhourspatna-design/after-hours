"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gamepad2, User, Phone, Mail, Lock, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (formData.name.length < 3) newErrors.name = "Name must be at least 3 characters";
    if (formData.phone.length !== 10) newErrors.phone = "Phone must be exactly 10 digits";
    if (formData.password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (formData.email && (!formData.email.includes("@") || !formData.email.includes("."))) {
      newErrors.email = "Invalid email address (must include @ and .)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.toLowerCase().includes("phone")) {
          setErrors({ phone: "This phone number is already registered" });
        } else if (data.error?.toLowerCase().includes("email")) {
          setErrors({ email: "This email is already registered" });
        } else {
          toast.error(data.error ?? "Signup failed");
        }
        return;
      }

      toast.success("Account created successfully! Please sign in.");
      router.push("/login");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-zinc-950">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-4 shadow-lg shadow-violet-900/30">
            <Gamepad2 className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">After Hours</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Join the ultimate gaming community</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8 border-zinc-800/50 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Create Account</h2>
            <p className="text-zinc-500 text-sm mt-0.5 font-medium">Sign up to book your gaming sessions</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Full Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full Name"
                  className={cn("input-field pl-10", errors.name && "border-red-500/50 bg-red-500/5")}
                  disabled={isLoading}
                />
              </div>
              {errors.name && <p className="text-[10px] text-red-400 font-bold mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-bold">+92</span>
                <input
                  required
                  type="tel"
                  maxLength={10}
                  value={formData.phone}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: val });
                  }}
                  placeholder="3000000000"
                  className={cn("input-field pl-20", errors.phone && "border-red-500/50 bg-red-500/5")}
                  disabled={isLoading}
                />
              </div>
              {errors.phone && <p className="text-[10px] text-red-400 font-bold mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.phone}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Email (Optional)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  className={cn("input-field pl-10", errors.email && "border-red-500/50 bg-red-500/5")}
                  disabled={isLoading}
                />
              </div>
              {errors.email && <p className="text-[10px] text-red-400 font-bold mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  required
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className={cn("input-field pl-10", errors.password && "border-red-500/50 bg-red-500/5")}
                  disabled={isLoading}
                />
              </div>
              {errors.password && <p className="text-[10px] text-red-400 font-bold mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-4
                         bg-violet-600 hover:bg-violet-500 active:scale-[0.98]
                         text-white font-bold text-sm rounded-xl
                         transition-all duration-200 shadow-lg shadow-violet-900/40
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account…</>
              ) : (
                <><ArrowRight className="w-4 h-4" /> Sign Up</>
              )}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-zinc-900">
            <p className="text-sm text-zinc-500 font-medium">
              Already have an account?{" "}
              <Link href="/login" className="text-violet-400 hover:text-violet-300 font-bold">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
