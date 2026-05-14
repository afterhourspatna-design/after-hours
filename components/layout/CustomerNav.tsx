"use client";

import { signOut } from "next-auth/react";
import { Gamepad2, LogOut } from "lucide-react";

interface CustomerNavProps {
  userName: string;
}

export default function CustomerNav({ userName }: CustomerNavProps) {
  return (
    <header className="h-14 flex items-center px-4 gap-3 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <Gamepad2 className="w-5 h-5 text-violet-400" />
        <span className="text-sm font-bold text-white">After Hours</span>
      </div>
      <span className="text-xs text-zinc-600 ml-1">/ My Bookings</span>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-zinc-400">{userName}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-zinc-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
