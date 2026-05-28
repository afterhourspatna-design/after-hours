"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, MessageSquare, Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function CustomerFeedbackPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitted(false);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Unable to submit feedback");
        return;
      }

      setTitle("");
      setDescription("");
      setSubmitted(true);
      toast.success("Feedback submitted");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 py-4">
      <Link
        href="/customer/bookings"
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-900 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to bookings
      </Link>

      <div>
        <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Customer / Feedback</p>
        <h1 className="text-xl font-bold text-white mt-1">Share Feedback</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Tell us what worked, what felt off, or what you would like improved.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <MessageSquare className="w-4 h-4 text-violet-400" />
          Feedback Details
        </div>

        {submitted && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            Your feedback has been saved.
          </div>
        )}

        <div>
          <label htmlFor="feedback-title" className="text-xs text-zinc-400 mb-1.5 block">
            Title
          </label>
          <input
            id="feedback-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
            placeholder="Short summary"
            minLength={3}
            maxLength={120}
            required
          />
        </div>

        <div>
          <label htmlFor="feedback-description" className="text-xs text-zinc-400 mb-1.5 block">
            Description
          </label>
          <textarea
            id="feedback-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field min-h-40 resize-none"
            placeholder="Write your feedback here..."
            minLength={10}
            maxLength={2000}
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Feedback
            </>
          )}
        </button>
      </form>
    </div>
  );
}
