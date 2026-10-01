import Link from "next/link";
import { MessageCircleOff, ArrowRight } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-zinc-950">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <img src="/logo-icon.svg" alt="After Hours" className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-lg shadow-orange-900/30" />
          <h1 className="text-2xl font-bold text-white tracking-tight">After Hours</h1>
        </div>

        <div className="glass-card p-8 border-zinc-800/50 shadow-2xl text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 mb-4">
            <MessageCircleOff className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-base font-bold text-white mb-2">Sign-Up Not Available</h2>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            Self-service sign-up isn't available right now. Please contact an admin or staff member at After Hours to create your account.
          </p>
          <Link href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-all">
            Back to Login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
