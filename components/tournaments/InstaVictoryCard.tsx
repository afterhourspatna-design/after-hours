"use client";

import { useState } from "react";
import { Trophy, Medal, Download, Share2, Sparkles, Flame, Check, Copy } from "lucide-react";
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
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const champion = winners.find(w => w.place === 1) || { name: "Champion Player", prize: "₹1,000 Cash" };
  const runnerUp = winners.find(w => w.place === 2) || { name: "Runner Up", prize: "₹500 Cash" };
  const thirdPlace = winners.find(w => w.place === 3) || { name: "2nd Runner Up", prize: "₹250 Credits" };

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
      link.download = `${tournamentTitle.replace(/\s+/g, "_")}_Winners.png`;
      link.click();
      toast.success("Downloaded Instagram Story card!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate image download");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyText = () => {
    const text = `🏆 *${tournamentTitle} — WINNERS* 🏆\n🎮 Game: ${gameName}\n\n🥇 1ST PLACE: ${champion.name} (${champion.prize || "Champion"})\n🥈 2ND PLACE: ${runnerUp.name} (${runnerUp.prize || "Runner Up"})\n🥉 3RD PLACE: ${thirdPlace.name} (${thirdPlace.prize || "3rd Place"})\n\n⚡ Hosted at After Hours Gaming Parlour! 🔥`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Victory announcement copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="flex flex-col items-center space-y-4 max-w-sm w-full py-6">

        {/* Action Controls Header */}
        <div className="w-full flex items-center justify-between text-white px-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Insta Story Ready</span>
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

        {/* 9:16 Aspect Ratio Poster Canvas */}
        <div
          id="insta-story-card"
          className="relative w-full aspect-[9/16] rounded-3xl bg-zinc-950 border-2 border-amber-500/30 overflow-hidden shadow-2xl flex flex-col justify-between p-6 select-none"
          style={{
            backgroundImage: "radial-gradient(circle at 50% 20%, rgba(124, 58, 237, 0.25), transparent 70%), radial-gradient(circle at 50% 80%, rgba(245, 158, 11, 0.2), transparent 70%)"
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

          {/* Central Podium Animation Card */}
          <div className="my-auto space-y-3.5 py-4">

            {/* 🥇 1st Place Champion */}
            <div className="relative group p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-2 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.25)] text-center space-y-1.5 transform hover:scale-[1.02] transition-all">
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

            {/* 🥈 2nd Place Runner Up */}
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
            {downloading ? "Saving..." : "Save Poster PNG"}
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
