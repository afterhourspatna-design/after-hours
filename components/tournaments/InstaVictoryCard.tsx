"use client";

import { useState } from "react";
import { Trophy, Download, Sparkles, Flame, Check, Copy, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Winner {
  place: 1 | 2 | 3;
  name: string;
  prize?: string | null;
  scoreInfo?: string;
}

interface InstaVictoryCardProps {
  tournamentTitle: string;
  gameName: string;
  dateStr: string;
  winners: Winner[];
  onClose?: () => void;
}

export default function InstaVictoryCard({
  tournamentTitle,
  gameName,
  dateStr,
  winners,
  onClose
}: InstaVictoryCardProps) {
  const [activeSlide, setActiveSlide] = useState<0 | 1 | 2 | 3>(0); // 0 = Full Podium, 1 = 1st, 2 = 2nd, 3 = 3rd
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const champion = winners.find(w => w.place === 1) || { name: "Champion Player", prize: "₹1,000 Cash" };
  const runnerUp = winners.find(w => w.place === 2) || { name: "Runner Up", prize: "₹500 Cash" };
  const thirdPlace = winners.find(w => w.place === 3) || { name: "2nd Runner Up", prize: "₹250 Credits" };

  const slides = [
    { title: "All Winners Podium", id: "slide-all" },
    { title: "1st Place Champion", id: "slide-1st" },
    { title: "2nd Place Runner Up", id: "slide-2nd" },
    { title: "3rd Place Winner", id: "slide-3rd" },
  ];

  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const cardElement = document.getElementById("insta-story-card");
      if (!cardElement) return;

      const canvas = await html2canvas(cardElement, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#09090b",
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      const slideTag = activeSlide === 0 ? "Podium" : `${activeSlide}st_Place`;
      link.download = `${tournamentTitle.replace(/\s+/g, "_")}_${slideTag}.png`;
      link.click();
      toast.success(`Downloaded ${slides[activeSlide].title} card!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate image download");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyText = () => {
    let text = "";
    if (activeSlide === 0) {
      text = `🏆 *${tournamentTitle} — WINNERS* 🏆\n🎮 Game: ${gameName}\n\n🥇 1ST PLACE: ${champion.name} (${champion.prize || "Champion"})\n🥈 2ND PLACE: ${runnerUp.name} (${runnerUp.prize || "Runner Up"})\n🥉 3RD PLACE: ${thirdPlace.name} (${thirdPlace.prize || "3rd Place"})\n\n⚡ Hosted at After Hours Gaming Parlour! 🔥`;
    } else if (activeSlide === 1) {
      text = `🥇 *${tournamentTitle} CHAMPION* 🥇\n👑 Player: ${champion.name}\n🎁 Prize Won: ${champion.prize || "1st Prize"}\n🎮 Game: ${gameName}\n\n⚡ Hosted at After Hours Gaming Parlour! 🔥`;
    } else if (activeSlide === 2) {
      text = `🥈 *${tournamentTitle} RUNNER UP* 🥈\n⭐ Player: ${runnerUp.name}\n🎁 Prize Won: ${runnerUp.prize || "2nd Prize"}\n🎮 Game: ${gameName}\n\n⚡ Hosted at After Hours Gaming Parlour! 🔥`;
    } else {
      text = `🥉 *${tournamentTitle} 3RD PLACE* 🥉\n✨ Player: ${thirdPlace.name}\n🎁 Prize Won: ${thirdPlace.prize || "3rd Prize"}\n🎮 Game: ${gameName}\n\n⚡ Hosted at After Hours Gaming Parlour! 🔥`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Caption copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="flex flex-col items-center space-y-4 max-w-sm w-full py-6">

        {/* Header Controls */}
        <div className="w-full flex items-center justify-between text-white px-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Insta Story Swipe Tiles</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition-all"
            >
              Close
            </button>
          )}
        </div>

        {/* Slide Selector Tabs */}
        <div className="w-full flex items-center justify-between bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-800">
          <button
            onClick={() => setActiveSlide((prev) => (prev > 0 ? (prev - 1) as any : 3))}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveSlide(idx as any)}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase transition-all",
                  activeSlide === idx
                    ? "bg-amber-500 text-black shadow-md shadow-amber-950/50"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                {idx === 0 ? "Podium" : `${idx}st`}
              </button>
            ))}
          </div>
          <button
            onClick={() => setActiveSlide((prev) => (prev < 3 ? (prev + 1) as any : 0))}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 9:16 Aspect Ratio Poster Canvas */}
        <div
          id="insta-story-card"
          className="relative w-full aspect-[9/16] rounded-3xl bg-zinc-950 border-2 border-amber-500/30 overflow-hidden shadow-2xl flex flex-col justify-between p-6 select-none transition-all"
          style={{
            backgroundImage: activeSlide === 1
              ? "radial-gradient(circle at 50% 30%, rgba(245, 158, 11, 0.35), transparent 75%), radial-gradient(circle at 50% 80%, rgba(124, 58, 237, 0.25), transparent 75%)"
              : activeSlide === 2
              ? "radial-gradient(circle at 50% 30%, rgba(156, 163, 175, 0.3), transparent 75%), radial-gradient(circle at 50% 80%, rgba(37, 99, 235, 0.25), transparent 75%)"
              : activeSlide === 3
              ? "radial-gradient(circle at 50% 30%, rgba(180, 83, 9, 0.3), transparent 75%), radial-gradient(circle at 50% 80%, rgba(217, 119, 6, 0.25), transparent 75%)"
              : "radial-gradient(circle at 50% 20%, rgba(124, 58, 237, 0.25), transparent 70%), radial-gradient(circle at 50% 80%, rgba(245, 158, 11, 0.2), transparent 70%)"
          }}
        >
          {/* Top Branding Banner */}
          <div className="text-center space-y-1 pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-[10px] font-extrabold uppercase tracking-widest">
              <Flame className="w-3 h-3 text-amber-400" /> AFTER HOURS ESPORTS
            </div>
            <h1 className="text-xl font-black text-white tracking-tight leading-tight line-clamp-2 uppercase drop-shadow-md">
              {tournamentTitle}
            </h1>
            <p className="text-[11px] font-bold text-amber-400/90 tracking-wider uppercase">
              {gameName} · {dateStr}
            </p>
          </div>

          {/* Dynamic Content Body based on activeSlide */}
          {activeSlide === 0 && (
            /* ── ALL PODIUM SLIDE ── */
            <div className="my-auto space-y-3.5 py-4">
              {/* 🥇 1st Place */}
              <div className="relative group p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-2 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.25)] text-center space-y-1.5">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[9px] font-black uppercase tracking-widest shadow-md flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> CHAMPION 🥇
                </div>
                <p className="text-lg font-black text-white pt-1 tracking-wide uppercase drop-shadow">
                  {champion.name}
                </p>
                {champion.prize && (
                  <p className="text-xs font-extrabold text-amber-300 bg-amber-950/60 border border-amber-500/40 py-1 px-3 rounded-xl inline-block">
                    Prize: {champion.prize}
                  </p>
                )}
              </div>

              {/* 🥈 2nd Place */}
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-400/40 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-zinc-400/20 border border-zinc-400/40 flex items-center justify-center text-xs font-black text-zinc-300">
                    🥈
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">RUNNER UP</p>
                    <p className="text-xs font-bold text-white uppercase">{runnerUp.name}</p>
                  </div>
                </div>
                {runnerUp.prize && (
                  <span className="text-[10px] font-bold text-zinc-300 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
                    {runnerUp.prize}
                  </span>
                )}
              </div>

              {/* 🥉 3rd Place */}
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-amber-700/40 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-700/20 border border-amber-700/40 flex items-center justify-center text-xs font-black text-amber-500">
                    🥉
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">3RD PLACE</p>
                    <p className="text-xs font-bold text-white uppercase">{thirdPlace.name}</p>
                  </div>
                </div>
                {thirdPlace.prize && (
                  <span className="text-[10px] font-bold text-amber-400 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
                    {thirdPlace.prize}
                  </span>
                )}
              </div>
            </div>
          )}

          {activeSlide === 1 && (
            /* ── 1ST PLACE INDIVIDUAL TILE ── */
            <div className="my-auto text-center space-y-5 py-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 p-1 mx-auto shadow-[0_0_40px_rgba(245,158,11,0.5)] flex items-center justify-center animate-bounce">
                <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center text-4xl">
                  🥇
                </div>
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black uppercase tracking-widest">
                  TOURNAMENT CHAMPION
                </span>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight drop-shadow-lg pt-1">
                  {champion.name}
                </h2>
                {champion.prize && (
                  <div className="pt-2">
                    <span className="text-sm font-extrabold text-black bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-2 rounded-2xl shadow-lg inline-block">
                      🏆 WINNER PRIZE: {champion.prize}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSlide === 2 && (
            /* ── 2ND PLACE INDIVIDUAL TILE ── */
            <div className="my-auto text-center space-y-5 py-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-zinc-400 to-slate-200 p-1 mx-auto shadow-[0_0_35px_rgba(156,163,175,0.4)] flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center text-4xl">
                  🥈
                </div>
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-zinc-500/20 border border-zinc-500/40 text-zinc-300 text-xs font-black uppercase tracking-widest">
                  RUNNER UP
                </span>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight drop-shadow-lg pt-1">
                  {runnerUp.name}
                </h2>
                {runnerUp.prize && (
                  <div className="pt-2">
                    <span className="text-sm font-bold text-white bg-zinc-800 border border-zinc-600 px-4 py-2 rounded-2xl shadow-lg inline-block">
                      🎁 PRIZE: {runnerUp.prize}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSlide === 3 && (
            /* ── 3RD PLACE INDIVIDUAL TILE ── */
            <div className="my-auto text-center space-y-5 py-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 p-1 mx-auto shadow-[0_0_35px_rgba(180,83,9,0.4)] flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center text-4xl">
                  🥉
                </div>
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-amber-700/20 border border-amber-700/40 text-amber-500 text-xs font-black uppercase tracking-widest">
                  3RD PLACE WINNER
                </span>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight drop-shadow-lg pt-1">
                  {thirdPlace.name}
                </h2>
                {thirdPlace.prize && (
                  <div className="pt-2">
                    <span className="text-sm font-bold text-amber-300 bg-amber-950/80 border border-amber-700/50 px-4 py-2 rounded-2xl shadow-lg inline-block">
                      🎁 PRIZE: {thirdPlace.prize}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Card Info */}
          <div className="text-center space-y-1.5 pb-2">
            <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent w-3/4 mx-auto" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              AFTER HOURS GAMING CAFE · PATNA
            </p>
            <p className="text-[9px] text-zinc-600 font-mono">
              @afterhours.in · Book your slot now
            </p>
          </div>
        </div>

        {/* Download & Copy Buttons */}
        <div className="w-full grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleDownloadImage}
            disabled={downloading}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all shadow-lg shadow-violet-900/30 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Saving..." : `Save ${slides[activeSlide].title.split(" ")[0]} PNG`}
          </button>
          <button
            onClick={handleCopyText}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold text-xs transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied Text!" : "Copy Caption"}
          </button>
        </div>

      </div>
    </div>
  );
}
