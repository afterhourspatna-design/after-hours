"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Zap } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [identifier, setIdentifier] = useState("");
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
    if (!identifier || !password) {
      toast.error("Please enter your email/phone and password");
      return;
    }
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        identifier,
        password,
        redirect: false,
      });

      if (result?.ok && !result?.error) {
        toast.success("Welcome back!");
        router.push(callbackUrl);
        router.refresh();
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
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[22%] h-[22%] bg-orange-500/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="After Hours Gaming Cafe" className="w-48 h-48 mx-auto rounded-2xl shadow-lg shadow-orange-900/30" />
        </div>

        {/* Card */}
        <div className="glass-card p-8 border-zinc-800/50 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Sign in</h2>
            <p className="text-zinc-500 text-sm mt-0.5 font-medium">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Email or Phone Number
              </label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter your email or phone number"
                className="input-field focus:ring-orange-500/50 focus:border-orange-500/50"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Password
                </label>
                <a href="/forgot-password" className="text-[11px] font-bold text-orange-400 hover:text-orange-300">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-11 focus:ring-orange-500/50 focus:border-orange-500/50"
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
                         bg-orange-600 hover:bg-orange-500 active:scale-[0.98]
                         text-white font-bold text-sm rounded-xl
                         transition-all duration-200 shadow-lg shadow-orange-900/40
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
              <a href="/signup" className="text-orange-400 hover:text-orange-300 font-bold">
                Sign Up
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em] mt-8">
          After Hours Gaming Cafe — Internal Use Only
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
