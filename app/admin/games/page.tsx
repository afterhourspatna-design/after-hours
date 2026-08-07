"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { 
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, 
  Check, X, Gamepad2, Info, Loader2 
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface ResourceUnit { id: string; unitName: string; isActive: boolean; }
interface Game {
  id: string; name: string; tag: string; description: string | null;
  basePrice: number; minTimeMinutes: number; maxTimeMinutes: number;
  deposit: number | null; isActive: boolean; totalUnits: number;
  resourceUnits: ResourceUnit[]; _count: { bookings: number };
}

const GAME_ICONS: Record<string, string> = {
  ps5: "🎮", ps4: "🎮", metaquest: "🥽", soccer: "⚽", tabletennis: "🏓",
  pool: "🎱", basketball: "🏀", foosball: "⚽", event: "🎉",
  carrom: "🎯", jenga: "🧱", cards: "🃏",
};

function GameRow({ game, onUpdate, onDelete }: { game: Game; onUpdate: () => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [basePrice, setBasePrice] = useState(String(game.basePrice));
  const [minTime, setMinTime] = useState(String(game.minTimeMinutes));
  const [maxTime, setMaxTime] = useState(String(game.maxTimeMinutes));
  const [saving, setSaving] = useState(false);

  async function saveChanges() {
    setSaving(true);
    try {
      const res = await fetch(`/api/games/${game.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePrice: Number(basePrice), minTimeMinutes: Number(minTime), maxTimeMinutes: Number(maxTime) }),
      });
      if (!res.ok) throw new Error();
      toast.success("Game updated"); setEditing(false); onUpdate();
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  }

  async function toggleActive() {
    await fetch(`/api/games/${game.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !game.isActive }),
    });
    onUpdate();
  }

  return (
    <div className={cn("border-b border-zinc-800/60 last:border-0", !game.isActive && "opacity-60")}>
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="text-2xl w-10 text-center flex-shrink-0">{GAME_ICONS[game.tag] ?? "🎯"}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{game.name}</p>
            {!game.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">Inactive</span>}
          </div>
          {game.description && <p className="text-xs text-zinc-600 mt-0.5 truncate">{game.description}</p>}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-zinc-500">{game.resourceUnits.length} unit{game.resourceUnits.length !== 1 ? "s" : ""}</span>
            <span className="text-xs text-zinc-600">{game._count.bookings} bookings</span>
          </div>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <div className="text-center">
              <label className="text-[10px] text-zinc-500 block mb-0.5">Rs/hr</label>
              <input value={basePrice} onChange={e => setBasePrice(e.target.value)} type="number"
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div className="text-center">
              <label className="text-[10px] text-zinc-500 block mb-0.5">Min (min)</label>
              <input value={minTime} onChange={e => setMinTime(e.target.value)} type="number"
                className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div className="text-center">
              <label className="text-[10px] text-zinc-500 block mb-0.5">Max (min)</label>
              <input value={maxTime} onChange={e => setMaxTime(e.target.value)} type="number"
                className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <button onClick={saveChanges} disabled={saving}
              className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-600/20 transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</button>
            <button onClick={() => setEditing(false)} className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-all">
              <X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-white">{formatCurrency(Number(game.basePrice))}<span className="text-zinc-500 font-normal text-xs">/hr</span></p>
              <p className="text-xs text-zinc-600">{game.minTimeMinutes}–{game.maxTimeMinutes}min</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all" title="Edit pricing">
                <Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={toggleActive} className={cn("p-1.5 rounded-lg transition-all", game.isActive ? "text-emerald-400 hover:bg-emerald-500/10" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800")} title={game.isActive ? "Deactivate" : "Activate"}>
                {game.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}</button>
              <button onClick={() => onDelete(game.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                <Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newGame, setNewGame] = useState({
    name: "",
    tag: "",
    description: "",
    basePrice: 500,
    minTimeMinutes: 30,
    maxTimeMinutes: 120,
    totalUnits: 1
  });

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch("/api/games"); if (res.ok) setGames(await res.json()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true);
    try { await fetch(`/api/games/${deleteId}`, { method: "DELETE" }); toast.success("Game removed"); setDeleteId(null); fetchGames(); }
    catch { toast.error("Failed to delete"); } finally { setDeleting(false); }
  }

  async function handleAddGame(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGame)
      });
      if (res.ok) {
        toast.success("Game added successfully");
        setIsAdding(false);
        setNewGame({ name: "", tag: "", description: "", basePrice: 500, minTimeMinutes: 30, maxTimeMinutes: 120, totalUnits: 1 });
        fetchGames();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add game");
      }
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Games & Pricing</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Manage your parlour games and their hourly rates</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? "Cancel" : "Add Game"}
        </button>
      </div>

      {isAdding ? (
        <div className="glass-card p-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
           <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-violet-400" />
              Add New Game
           </h2>
           <form onSubmit={handleAddGame} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2 sm:col-span-1">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Game Name</label>
                    <input required value={newGame.name} onChange={e => setNewGame({...newGame, name: e.target.value})} className="input-field" placeholder="e.g. PlayStation 5" />
                 </div>
                 <div className="col-span-2 sm:col-span-1">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Slug / Tag (Unique)</label>
                    <input required value={newGame.tag} onChange={e => setNewGame({...newGame, tag: e.target.value.toLowerCase().replace(/\s+/g, '-')})} className="input-field" placeholder="e.g. ps5" />
                 </div>
                 <div className="col-span-2">
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Description</label>
                    <textarea value={newGame.description} onChange={e => setNewGame({...newGame, description: e.target.value})} className="input-field min-h-[80px]" placeholder="Brief details about the game/activity..." />
                 </div>
                 <div>
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Base Price (Rs/hr)</label>
                    <input required type="number" value={newGame.basePrice} onChange={e => setNewGame({...newGame, basePrice: Number(e.target.value)})} className="input-field text-center font-bold" />
                 </div>
                 <div>
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Total Units</label>
                    <input required type="number" value={newGame.totalUnits} onChange={e => setNewGame({...newGame, totalUnits: Number(e.target.value)})} className="input-field text-center font-bold" min="1" max="20" />
                 </div>
                 <div>
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Min Time (mins)</label>
                    <input required type="number" value={newGame.minTimeMinutes} onChange={e => setNewGame({...newGame, minTimeMinutes: Number(e.target.value)})} className="input-field text-center" />
                 </div>
                 <div>
                    <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Max Time (mins)</label>
                    <input required type="number" value={newGame.maxTimeMinutes} onChange={e => setNewGame({...newGame, maxTimeMinutes: Number(e.target.value)})} className="input-field text-center" />
                 </div>
              </div>
              <div className="pt-2">
                 <button type="submit" className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-900/20 active:scale-95">
                    Save Game Configuration
                 </button>
                 <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <Info className="w-4 h-4 text-zinc-500" />
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                       Adding a game will automatically create the specified number of resource units. You can deactivate individual units in the units management page.
                    </p>
                 </div>
              </div>
           </form>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {loading ? <TableSkeleton rows={8} /> : games.length === 0 ? (
            <EmptyState title="No games found" description="Click the 'Add Game' button above to create your first game activity." />
          ) : (
            <>
              <div className="px-5 py-3 border-b border-zinc-900 bg-zinc-950/20 flex items-center gap-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <span className="w-10" />
                <span className="flex-1">Game Details</span>
                <span className="w-48 text-right">Pricing & Limits</span>
                <span className="w-24 text-right">Actions</span>
              </div>
              <div className="divide-y divide-zinc-900">
                {games.map(g => <GameRow key={g.id} game={g} onUpdate={fetchGames} onDelete={setDeleteId} />)}
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog 
        open={!!deleteId} 
        title="Remove Game" 
        description="This will permanently remove the game. Existing bookings will be kept but unlinked. This action cannot be undone." 
        confirmLabel="Remove Game" 
        onConfirm={handleDelete} 
        onCancel={() => setDeleteId(null)} 
        loading={deleting} 
        destructive 
      />
    </div>
  );
}
