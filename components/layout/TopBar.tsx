"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

interface TopBarProps {
  title: string;
  userName: string;
  holdCount?: number;
}

export default function TopBar({ title, userName, holdCount = 0 }: TopBarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const handleSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && searchQuery.trim()) {
        router.push(`/admin/bookings?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchQuery("");
      }
    },
    [searchQuery, router]
  );

  return (
    <header className="h-14 lg:h-16 flex items-center gap-4 px-4 lg:px-6 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30 mt-14 lg:mt-0">
      {/* Page title */}
      <h1 className="text-base lg:text-lg font-semibold text-white hidden lg:block truncate">{title}</h1>

      {/* Search */}
      <div className={cn(
        "flex-1 max-w-md lg:max-w-sm relative transition-all duration-200",
        searchFocused ? "max-w-md" : ""
      )}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search bookings, users…"
          className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl
                     pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder:text-zinc-600
                     focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40
                     transition-all duration-200"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 lg:gap-3">
        {/* Hold notification bell */}
        <button
          onClick={() => router.push("/admin/bookings?status=HOLD")}
          className="relative p-2 rounded-xl hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-200 transition-all"
          title="View holds"
        >
          <Bell className="w-4 h-4 lg:w-5 lg:h-5" />
          {holdCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">{holdCount > 9 ? "9+" : holdCount}</span>
            </span>
          )}
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-violet-400">{getInitials(userName)}</span>
        </div>
      </div>
    </header>
  );
}
