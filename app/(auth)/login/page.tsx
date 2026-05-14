"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Gamepad2, Eye, EyeOff, Loader2, Zap } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && error !== "unauthorized") {
      toast.error("Authentication error. Please sign in again.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password");
      return;
    }
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.ok) {
        toast.success("Welcome back!");
        window.location.href = callbackUrl;
      } else {
        const errorMsg = result?.error === "CredentialsSignin" 
          ? "Invalid email or password." 
          : "Authentication failed. Please try again.";
        toast.error(errorMsg);
      }
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
          <p className="text-zinc-500 text-sm mt-1 font-medium">Gaming Parlour Admin</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8 border-zinc-800/50 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Sign in</h2>
            <p className="text-zinc-500 text-sm mt-0.5 font-medium">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input-field"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-11"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                <><Zap className="w-4 h-4" /> Sign In</>
              )}
            </button>
          </form>

          {/* Signup Link */}
          <div className="mt-8 text-center pt-6 border-t border-zinc-900">
            <p className="text-sm text-zinc-500 font-medium">
              Don't have an account?{" "}
              <a href="/signup" className="text-violet-400 hover:text-violet-300 font-bold">
                Sign Up
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em] mt-8">
          After Hours Gaming Parlour — Internal Use Only
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
