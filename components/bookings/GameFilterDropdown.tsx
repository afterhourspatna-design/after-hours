"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { GAME_COLOR_MAP, cn } from "@/lib/utils";

interface Game {
  id: string;
  name: string;
  tag: string;
  isActive: boolean;
}

interface GameFilterDropdownProps {
  value: string | null;
  onChange: (tag: string | null) => void;
}

export default function GameFilterDropdown({ value, onChange }: GameFilterDropdownProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchGames() {
      try {
        const res = await fetch("/api/games");
        if (res.ok) {
          const data = await res.json();
          setGames(data.filter((g: any) => g.isActive));
        }
      } catch (err) {
        console.error("Failed to fetch games for calendar filter:", err);
      }
    }
    fetchGames();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3.5 py-1.5 rounded-xl text-xs font-medium border bg-zinc-900/60 border-zinc-800/60 text-zinc-200 hover:border-zinc-700 transition-all flex items-center gap-2 min-w-[160px]"
      >
        {value ? (
          <>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: GAME_COLOR_MAP[value] ?? "#7c3aed" }}
            />
            <span className="truncate">{games.find((g) => g.tag === value)?.name ?? "All Games"}</span>
          </>
        ) : (
          <span className="truncate">All Games</span>
        )}
        <ChevronDown className={cn("w-3.5 h-3.5 ml-auto text-zinc-500 transition-transform flex-shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1.5 w-64 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto bg-zinc-950/95 border border-zinc-800 rounded-xl shadow-2xl backdrop-blur-md py-1.5">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900/80 transition-colors"
          >
            <Check className={cn("w-4 h-4 flex-shrink-0", value === null ? "opacity-100 text-orange-400" : "opacity-0")} />
            All Games
          </button>
          {games.map((g) => {
            const isSelected = value === g.tag;
            const gameColor = GAME_COLOR_MAP[g.tag] ?? "#7c3aed";
            return (
              <button
                key={g.id}
                onClick={() => {
                  onChange(g.tag);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900/80 transition-colors"
              >
                <Check className={cn("w-4 h-4 flex-shrink-0", isSelected ? "opacity-100 text-orange-400" : "opacity-0")} />
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: gameColor }} />
                <span className="truncate">{g.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
