"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Gamepad2, Eye, EyeOff, Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ForcePasswordChangePage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const newErrors: Record<string, string> = {};
    if (newPassword.length < 8) newErrors.newPassword = "New password must be at least 8 characters";
    if (confirmPassword !== newPassword) newErrors.confirmPassword = "Passwords don't match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/complete-password-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to update password");
        return;
      }

      toast.success("Password updated — please sign in again");
      await signOut({ redirect: false });
      window.location.href = "/login";
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-zinc-950">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 mb-4 shadow-lg shadow-amber-900/30">
            <ShieldAlert className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Set Your Password</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium">For security, you need to set your own password before continuing</p>
        </div>

        <div className="glass-card p-8 border-zinc-800/50 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={cn("input-field pr-11", errors.newPassword && "border-red-500/50 bg-red-500/5")}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-[10px] text-red-400 font-bold mt-1">{errors.newPassword}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Confirm New Password
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className={cn("input-field", errors.confirmPassword && "border-red-500/50 bg-red-500/5")}
                disabled={isLoading}
              />
              {errors.confirmPassword && <p className="text-[10px] text-red-400 font-bold mt-1">{errors.confirmPassword}</p>}
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
                <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
              ) : (
                <><ArrowRight className="w-4 h-4" /> Set Password &amp; Continue</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em] mt-8">
          <Gamepad2 className="w-3 h-3 inline mr-1 -mt-0.5" />
          After Hours Gaming Parlour
        </p>
      </div>
    </div>
  );
}
