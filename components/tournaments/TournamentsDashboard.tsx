"use client";

import { useState, useEffect } from "react";
import { Trophy, Plus, Users, Swords, Award, Calendar, Sparkles, RefreshCw, Loader2, X, Trash2, Search, UserCheck, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import InstaVictoryCard from "@/components/tournaments/InstaVictoryCard";

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function TournamentsDashboard() {
  const [activeTab, setActiveTab] = useState<"tournaments" | "bracket" | "hall">("tournaments");
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [games, setGames] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [showInstaCard, setShowInstaCard] = useState(false);

  // Customer Search Filter inside Register Modal
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Form States
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    gameId: "",
    startDate: new Date().toISOString().slice(0, 16),
    endDate: "",
    entryFee: "" as string | number,
    prizePool: "" as string | number,
    prize1st: "",
    prize2nd: "",
    prize3rd: "",
    maxParticipants: 32 as string | number,
    rules: "",
  });

  const [registerForm, setRegisterForm] = useState({
    userId: "",
    playerName: "",
    playerPhone: "",
    paymentMethod: "FREE",
    paidAmount: "" as string | number,
  });

  const [scoreForm, setScoreForm] = useState({ scoreP1: 0, scoreP2: 0, winnerId: "" });
  const [submitting, setSubmitting] = useState(false);

  // Fetch Tournaments, Games & Users
  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const [resT, resG, resU] = await Promise.all([
        fetch("/api/tournaments"),
        fetch("/api/games"),
        fetch("/api/users?limit=200")
      ]);
      if (resT.ok) setTournaments(await resT.json());
      if (resG.ok) setGames(await resG.json());
      if (resU.ok) {
        const uData = await resU.json();
        setUsers(uData.users ?? uData ?? []);
      }
    } catch {
      toast.error("Failed to load tournament data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const loadSingleTournament = async (id: string) => {
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTournament(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          startDate: new Date(createForm.startDate).toISOString(),
          endDate: createForm.endDate ? new Date(createForm.endDate).toISOString() : null,
          entryFee: Number(createForm.entryFee) || 0,
          prizePool: Number(createForm.prizePool) || 0,
          maxParticipants: Number(createForm.maxParticipants) || 32,
        }),
      });
      if (res.ok) {
        toast.success("Tournament created successfully!");
        setShowCreateModal(false);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create tournament");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTournament = async (tournamentId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Tournament deleted!");
        if (selectedTournament?.id === tournamentId) setSelectedTournament(null);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete tournament");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleRegisterPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${selectedTournament.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...registerForm,
          paidAmount: Number(registerForm.paidAmount) || 0,
        }),
      });
      if (res.ok) {
        toast.success("Player registered!");
        setShowRegisterModal(false);
        setUserSearchQuery("");
        loadSingleTournament(selectedTournament.id);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Registration failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteParticipant = async (participantId: string, name: string) => {
    if (!selectedTournament) return;
    if (!confirm(`Remove ${name} from this tournament?`)) return;
    try {
      const res = await fetch(`/api/tournaments/${selectedTournament.id}/participants/${participantId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Player removed from tournament");
        loadSingleTournament(selectedTournament.id);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove player");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleGenerateBracket = async () => {
    if (!selectedTournament) return;
    if (!confirm("Generate knockout bracket? This will randomize all registered players into pairings.")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${selectedTournament.id}/generate-bracket`, { method: "POST" });
      if (res.ok) {
        toast.success("Knockout bracket generated successfully!");
        loadSingleTournament(selectedTournament.id);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to generate bracket");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament || !selectedMatch) return;
    if (!scoreForm.winnerId) {
      toast.error("Please select a match winner");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${selectedTournament.id}/matches/${selectedMatch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scoreForm),
      });
      if (res.ok) {
        toast.success("Match score updated & winner advanced!");
        setShowScoreModal(false);
        loadSingleTournament(selectedTournament.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update score");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter users by search query in Register modal
  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.phone?.includes(userSearchQuery)
  );

  // Group matches by round number
  const roundsMap: Record<number, any[]> = {};
  if (selectedTournament?.matches) {
    selectedTournament.matches.forEach((m: any) => {
      if (!roundsMap[m.roundNumber]) roundsMap[m.roundNumber] = [];
      roundsMap[m.roundNumber].push(m);
    });
  }

  const roundNames: Record<number, string> = {
    1: "Round 1",
    2: "Quarter Finals",
    3: "Semi Finals",
    4: "Grand Final",
  };

  // Extract winners list for Insta Poster
  const finalsMatch = selectedTournament?.matches?.find((m: any) => m.nextMatchId === null && m.status === "COMPLETED");
  const winnersList = [];
  if (finalsMatch && finalsMatch.winner) {
    const winnerName = finalsMatch.winner.user?.name || finalsMatch.winner.playerName || "Champion";
    const runnerUpMatch = finalsMatch.player1Id === finalsMatch.winnerId ? finalsMatch.player2 : finalsMatch.player1;
    const runnerUpName = runnerUpMatch?.user?.name || runnerUpMatch?.playerName || "Runner Up";

    winnersList.push({ place: 1 as const, name: winnerName, prize: selectedTournament.prize1st || formatCurrency(Number(selectedTournament.prizePool) * 0.6) });
    winnersList.push({ place: 2 as const, name: runnerUpName, prize: selectedTournament.prize2nd || formatCurrency(Number(selectedTournament.prizePool) * 0.3) });
    winnersList.push({ place: 3 as const, name: selectedTournament.prize3rd || "Semifinalist", prize: formatCurrency(Number(selectedTournament.prizePool) * 0.1) });
  }

  return (
    <div className="space-y-6 py-4">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 border-violet-500/20 bg-gradient-to-r from-violet-950/40 via-zinc-900 to-amber-950/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400 animate-bounce" />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Tournaments & Esports Hub</h1>
          </div>
          <p className="text-xs text-zinc-400">
            Organize knockouts, register players with search, update live match scores, and share victory poster tiles!
          </p>
        </div>
        <button
          onClick={() => {
            if (games.length > 0) setCreateForm(prev => ({ ...prev, gameId: games[0].id }));
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-violet-900/30"
        >
          <Plus className="w-4 h-4" /> Create Tournament
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        {[
          { id: "tournaments", label: "Tournaments List", icon: Trophy },
          { id: "bracket", label: "Live Knockout Bracket", icon: Swords },
          { id: "hall", label: "Hall of Champions", icon: Award },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                active
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              )}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: Tournaments List ── */}
      {activeTab === "tournaments" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            </div>
          ) : tournaments.length === 0 ? (
            <div className="glass-card p-12 text-center space-y-3">
              <Trophy className="w-12 h-12 text-zinc-600 mx-auto" />
              <p className="text-base font-bold text-white">No tournaments created yet</p>
              <p className="text-xs text-zinc-500">Create your first tournament to start managing knockouts</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tournaments.map(t => (
                <div
                  key={t.id}
                  className={cn(
                    "glass-card p-5 space-y-4 border transition-all hover:border-violet-500/50 cursor-pointer relative group",
                    selectedTournament?.id === t.id ? "border-violet-500 bg-violet-950/10" : "border-zinc-800"
                  )}
                  onClick={() => {
                    loadSingleTournament(t.id);
                    setActiveTab("bracket");
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase tracking-wide">
                        {t.game?.name || "Gaming"}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1.5">{t.title}</h3>
                      <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" /> {formatDate(t.startDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black px-2.5 py-1 rounded-full uppercase border",
                        t.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        t.status === "IN_PROGRESS" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      )}>
                        {t.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTournament(t.id, t.title);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 transition-all"
                        title="Delete Tournament"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800/60 text-center text-xs">
                    <div className="bg-zinc-950 p-2 rounded-xl">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold">Entry Fee</p>
                      <p className="font-extrabold text-white">{Number(t.entryFee) === 0 ? "FREE" : formatCurrency(Number(t.entryFee))}</p>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded-xl">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold">Prize Pool</p>
                      <p className="font-extrabold text-amber-400">{formatCurrency(Number(t.prizePool))}</p>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded-xl">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold">Players</p>
                      <p className="font-extrabold text-white">{t._count?.participants || 0} / {t.maxParticipants}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        loadSingleTournament(t.id);
                        setRegisterForm({ userId: "", playerName: "", playerPhone: "", paymentMethod: Number(t.entryFee) > 0 ? "CASH" : "FREE", paidAmount: Number(t.entryFee) });
                        setShowRegisterModal(true);
                      }}
                      className="text-xs font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1"
                    >
                      <Users className="w-3.5 h-3.5" /> + Register Player
                    </button>
                    <span className="text-xs font-bold text-zinc-400 flex items-center gap-1 group-hover:text-white">
                      View Bracket →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Live Knockout Bracket & Scorecards ── */}
      {activeTab === "bracket" && (
        <div className="space-y-6">
          {/* Tournament Selector Bar */}
          <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <select
                value={selectedTournament?.id || ""}
                onChange={(e) => loadSingleTournament(e.target.value)}
                className="bg-zinc-950 text-white font-bold text-sm border border-zinc-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 w-full"
              >
                <option value="" disabled>-- Select a Tournament --</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.title} ({t.game?.name})</option>
                ))}
              </select>
            </div>

            {selectedTournament && (
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => {
                    setRegisterForm({ userId: "", playerName: "", playerPhone: "", paymentMethod: Number(selectedTournament.entryFee) > 0 ? "CASH" : "FREE", paidAmount: Number(selectedTournament.entryFee) });
                    setShowRegisterModal(true);
                  }}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" /> Add Player ({selectedTournament.participants?.length || 0})
                </button>
                <button
                  onClick={handleGenerateBracket}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-violet-900/30"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Auto Bracket
                </button>
                {selectedTournament.status === "COMPLETED" && (
                  <button
                    onClick={() => setShowInstaCard(true)}
                    className="px-3 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-amber-900/30"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Share Insta Poster
                  </button>
                )}
                <button
                  onClick={() => handleDeleteTournament(selectedTournament.id, selectedTournament.title)}
                  className="px-3 py-2 bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-rose-800/40"
                  title="Delete Tournament"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Registered Players List & Management Section */}
          {selectedTournament && selectedTournament.participants && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-violet-400" /> Registered Participants ({selectedTournament.participants.length})
                </h3>
              </div>
              {selectedTournament.participants.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">No players registered yet.</p>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto custom-scroll pb-2">
                  {selectedTournament.participants.map((p: any) => {
                    const pName = p.user?.name || p.playerName || "Player";
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-white flex-shrink-0 group"
                      >
                        <span className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 font-extrabold text-[10px] flex items-center justify-center">
                          #{p.seedNumber || "1"}
                        </span>
                        <span>{pName}</span>
                        <button
                          onClick={() => handleDeleteParticipant(p.id, pName)}
                          className="text-zinc-600 hover:text-rose-400 p-0.5 rounded transition-colors ml-1"
                          title="Remove Player"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!selectedTournament ? (
            <div className="glass-card p-12 text-center space-y-2">
              <Swords className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-400 font-medium">Select a tournament above to view the live knockout tree</p>
            </div>
          ) : !selectedTournament.matches || selectedTournament.matches.length === 0 ? (
            <div className="glass-card p-12 text-center space-y-4">
              <Swords className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Knockout Bracket Not Generated Yet</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Registered participants: <strong>{selectedTournament.participants?.length || 0}</strong>. Click below to generate randomized pairings.
                </p>
              </div>
              <button
                onClick={handleGenerateBracket}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition-all shadow-xl shadow-violet-900/30"
              >
                Generate Knockout Bracket Now
              </button>
            </div>
          ) : (
            /* Visual Knockout Bracket Diagram */
            <div className="glass-card p-6 overflow-x-auto custom-scroll">
              <div className="flex gap-8 min-w-[700px] py-4">
                {Object.keys(roundsMap).map((rStr) => {
                  const rNum = Number(rStr);
                  const roundMatches = roundsMap[rNum];
                  const roundTitle = roundNames[rNum] || `Round ${rNum}`;

                  return (
                    <div key={rNum} className="flex-1 flex flex-col justify-around space-y-6">
                      <div className="text-center pb-2 border-b border-zinc-800">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                          {roundTitle}
                        </span>
                      </div>

                      <div className="space-y-6 my-auto">
                        {roundMatches.map((m: any) => {
                          const p1Name = m.player1?.user?.name || m.player1?.playerName || (m.status === "BYE" ? "BYE" : "TBD");
                          const p2Name = m.player2?.user?.name || m.player2?.playerName || (m.status === "BYE" ? "BYE" : "TBD");
                          const isCompleted = m.status === "COMPLETED" || m.status === "BYE";

                          return (
                            <div
                              key={m.id}
                              onClick={() => {
                                if (m.status !== "BYE" && m.player1Id && m.player2Id) {
                                  setSelectedMatch(m);
                                  setScoreForm({ scoreP1: m.scoreP1 || 0, scoreP2: m.scoreP2 || 0, winnerId: m.winnerId || m.player1Id });
                                  setShowScoreModal(true);
                                }
                              }}
                              className={cn(
                                "rounded-xl border p-3 space-y-2 transition-all shadow-lg relative group",
                                isCompleted ? "bg-zinc-900/90 border-zinc-700" : "bg-zinc-950 border-violet-500/40 hover:border-violet-500 cursor-pointer"
                              )}
                            >
                              <div className="text-[9px] font-bold text-zinc-500 flex justify-between">
                                <span>MATCH #{m.matchNumber}</span>
                                <span className={isCompleted ? "text-emerald-400" : "text-amber-400"}>{m.status}</span>
                              </div>

                              {/* Player 1 Slot */}
                              <div className={cn(
                                "flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all",
                                m.winnerId && m.winnerId === m.player1Id ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-zinc-900 text-zinc-300"
                              )}>
                                <span className="truncate pr-2">{p1Name}</span>
                                <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded text-white">{m.scoreP1}</span>
                              </div>

                              {/* Player 2 Slot */}
                              <div className={cn(
                                "flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all",
                                m.winnerId && m.winnerId === m.player2Id ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-zinc-900 text-zinc-300"
                              )}>
                                <span className="truncate pr-2">{p2Name}</span>
                                <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded text-white">{m.scoreP2}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Hall of Champions ── */}
      {activeTab === "hall" && (
        <div className="space-y-4">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" /> Champions Hall of Fame
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tournaments.filter(t => t.status === "COMPLETED").length === 0 ? (
                <p className="text-xs text-zinc-500">No completed tournaments yet. Finish a tournament to see winners featured here!</p>
              ) : (
                tournaments.filter(t => t.status === "COMPLETED").map(t => (
                  <div key={t.id} className="p-4 rounded-2xl bg-zinc-900 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                        {t.game?.name}
                      </span>
                      <span className="text-xs text-zinc-500">{formatDate(t.startDate)}</span>
                    </div>
                    <h3 className="font-bold text-white">{t.title}</h3>
                    <button
                      onClick={() => {
                        loadSingleTournament(t.id);
                        setShowInstaCard(true);
                      }}
                      className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> View Victory Card
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Create Tournament ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card max-w-md w-full p-6 space-y-5 border-zinc-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Create New Tournament</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTournament} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-bold mb-1">Tournament Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FC 24 Weekend Championship"
                  value={createForm.title}
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Game</label>
                  <select
                    value={createForm.gameId}
                    onChange={e => setCreateForm(f => ({ ...f, gameId: e.target.value }))}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
                  >
                    {games.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={createForm.startDate}
                    onChange={e => setCreateForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Entry Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={createForm.entryFee}
                    onChange={e => setCreateForm(f => ({ ...f, entryFee: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Prize Pool (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={createForm.prizePool}
                    onChange={e => setCreateForm(f => ({ ...f, prizePool: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Max Players</label>
                  <input
                    type="number"
                    min="2"
                    max="512"
                    placeholder="32"
                    value={createForm.maxParticipants}
                    onChange={e => setCreateForm(f => ({ ...f, maxParticipants: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">1st Prize</label>
                  <input
                    type="text"
                    placeholder="₹1,000 Cash"
                    value={createForm.prize1st}
                    onChange={e => setCreateForm(f => ({ ...f, prize1st: e.target.value }))}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-2 py-1.5 focus:outline-none focus:border-violet-500 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">2nd Prize</label>
                  <input
                    type="text"
                    placeholder="₹500 Cash"
                    value={createForm.prize2nd}
                    onChange={e => setCreateForm(f => ({ ...f, prize2nd: e.target.value }))}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-2 py-1.5 focus:outline-none focus:border-violet-500 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">3rd Prize</label>
                  <input
                    type="text"
                    placeholder="₹250 Credit"
                    value={createForm.prize3rd}
                    onChange={e => setCreateForm(f => ({ ...f, prize3rd: e.target.value }))}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-2 py-1.5 focus:outline-none focus:border-violet-500 text-[11px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-900/30"
              >
                {submitting ? "Creating..." : "Create Tournament"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Register Player (with Search) ── */}
      {showRegisterModal && selectedTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card max-w-sm w-full p-6 space-y-4 border-zinc-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Register Player</h3>
              <button onClick={() => setShowRegisterModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRegisterPlayer} className="space-y-3 text-xs">
              
              {/* User Search Input & Results List */}
              <div className="space-y-2">
                <label className="block text-zinc-400 font-bold">Search Existing Customer</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Type name or phone number..."
                    value={userSearchQuery}
                    onChange={async (e) => {
                      const query = e.target.value;
                      setUserSearchQuery(query);
                      if (query.trim().length >= 1) {
                        try {
                          const res = await fetch(`/api/users?q=${encodeURIComponent(query)}&limit=20`);
                          if (res.ok) {
                            const data = await res.json();
                            setUsers(data.users ?? data ?? []);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-violet-500"
                  />
                  {userSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserSearchQuery("");
                        fetch("/api/users?limit=100").then(r => r.json()).then(d => setUsers(d.users ?? d ?? []));
                      }}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Quick Select Customer Cards */}
                <div className="max-h-36 overflow-y-auto custom-scroll space-y-1 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterForm(f => ({ ...f, userId: "", playerName: "", playerPhone: "" }));
                    }}
                    className={cn(
                      "w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-all",
                      !registerForm.userId ? "bg-violet-600/20 text-violet-300 border border-violet-500/40" : "hover:bg-zinc-900 text-zinc-400"
                    )}
                  >
                    <span className="font-bold">+ New / Walk-in Player</span>
                    {!registerForm.userId && <UserCheck className="w-3.5 h-3.5 text-violet-400" />}
                  </button>

                  {filteredUsers.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 text-center py-2">No matching customers found</p>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = registerForm.userId === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setRegisterForm(f => ({ ...f, userId: u.id, playerName: u.name || "", playerPhone: u.phone || "" }));
                          }}
                          className={cn(
                            "w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-all border",
                            isSelected
                              ? "bg-violet-600/20 text-white border-violet-500/40 font-bold"
                              : "bg-zinc-900/50 border-transparent hover:bg-zinc-900 text-zinc-300"
                          )}
                        >
                          <div>
                            <p className="font-bold text-white leading-tight">{u.name}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">{u.phone}</p>
                          </div>
                          {isSelected && <UserCheck className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Player Name</label>
                <input
                  type="text"
                  required
                  value={registerForm.playerName}
                  onChange={e => setRegisterForm(f => ({ ...f, playerName: e.target.value }))}
                  className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={registerForm.playerPhone}
                  onChange={e => setRegisterForm(f => ({ ...f, playerPhone: e.target.value }))}
                  className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2"
                />
              </div>

              {Number(selectedTournament.entryFee) > 0 && (
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Entry Fee Payment Method</label>
                  <select
                    value={registerForm.paymentMethod}
                    onChange={e => setRegisterForm(f => ({ ...f, paymentMethod: e.target.value }))}
                    className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2"
                  >
                    <option value="CASH">Cash (₹{Number(selectedTournament.entryFee)})</option>
                    <option value="ONLINE">UPI / Online (₹{Number(selectedTournament.entryFee)})</option>
                    <option value="FREE">Waived / Free</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all"
              >
                {submitting ? "Registering..." : "Confirm Registration"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Update Match Score ── */}
      {showScoreModal && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card max-w-sm w-full p-6 space-y-4 border-zinc-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Update Match Score</h3>
              <button onClick={() => setShowScoreModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateScore} className="space-y-4 text-xs">
              <div className="space-y-2">
                {/* Player 1 Score */}
                <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="font-bold text-white truncate max-w-[150px]">
                    {selectedMatch.player1?.user?.name || selectedMatch.player1?.playerName}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={scoreForm.scoreP1}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setScoreForm(f => ({ ...f, scoreP1: val, winnerId: val > f.scoreP2 ? selectedMatch.player1Id : selectedMatch.player2Id }));
                    }}
                    className="w-16 text-center font-mono font-bold bg-zinc-900 text-white border border-zinc-700 rounded-lg p-1.5 text-sm"
                  />
                </div>

                {/* Player 2 Score */}
                <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="font-bold text-white truncate max-w-[150px]">
                    {selectedMatch.player2?.user?.name || selectedMatch.player2?.playerName}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={scoreForm.scoreP2}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setScoreForm(f => ({ ...f, scoreP2: val, winnerId: val > f.scoreP1 ? selectedMatch.player2Id : selectedMatch.player1Id }));
                    }}
                    className="w-16 text-center font-mono font-bold bg-zinc-900 text-white border border-zinc-700 rounded-lg p-1.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-bold mb-1">Winner Advances</label>
                <select
                  value={scoreForm.winnerId}
                  onChange={e => setScoreForm(f => ({ ...f, winnerId: e.target.value }))}
                  className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2 font-bold"
                >
                  <option value={selectedMatch.player1Id}>{selectedMatch.player1?.user?.name || selectedMatch.player1?.playerName} (P1)</option>
                  <option value={selectedMatch.player2Id}>{selectedMatch.player2?.user?.name || selectedMatch.player2?.playerName} (P2)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
              >
                {submitting ? "Updating..." : "Save Match Score"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Insta Story Export Poster Modal (with Swipable Individual Tiles) ── */}
      {showInstaCard && selectedTournament && (
        <InstaVictoryCard
          tournamentTitle={selectedTournament.title}
          gameName={selectedTournament.game?.name || "Gaming"}
          dateStr={formatDate(selectedTournament.startDate)}
          winners={winnersList}
          onClose={() => setShowInstaCard(false)}
        />
      )}
    </div>
  );
}
