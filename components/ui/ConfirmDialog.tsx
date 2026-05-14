"use client";

import { useEffect, useRef } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  destructive?: boolean;
}

export default function ConfirmDialog({
  open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel",
  onConfirm, onCancel, loading = false, destructive = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && !loading) onConfirm();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel, onConfirm, loading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        ref={dialogRef}
        className="relative glass-card p-6 w-full max-w-sm animate-scale-in"
      >
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
          destructive ? "bg-red-500/10" : "bg-violet-500/10"
        )}>
          {destructive ? (
            <AlertTriangle className="w-6 h-6 text-red-400" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-violet-400" />
          )}
        </div>

        <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-zinc-500 mb-6 leading-relaxed">{description}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-700 text-zinc-300
                       text-sm font-medium hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl",
              "text-sm font-medium transition-all disabled:opacity-50",
              destructive
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-violet-600 hover:bg-violet-500 text-white"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
