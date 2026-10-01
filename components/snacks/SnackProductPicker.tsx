"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SnackProduct {
  id: string;
  name: string;
  price: string | number;
  category?: { id: string; name: string } | null;
}

export interface SnackItemPayload {
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string | null;
}

interface SnackProductPickerProps {
  onAdd: (item: SnackItemPayload) => Promise<void> | void;
  disabled?: boolean;
  addLabel?: string;
}

/** Type-to-search product combobox + quantity + editable unit price. Typing a
 * name that doesn't match anything on the menu is treated as a new item —
 * the server creates it on submit, so the catalog grows as it's used. */
export default function SnackProductPicker({ onAdd, disabled, addLabel = "Add" }: SnackProductPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SnackProduct[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState<SnackProduct | null>(null);
  const [unitPriceInput, setUnitPriceInput] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected || query.trim().length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/snack-products?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) setResults(await res.json());
      } catch {
        // ignore, search is best-effort
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, selected]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProduct = (p: SnackProduct) => {
    setSelected(p);
    setQuery(p.name);
    setUnitPriceInput(String(p.price));
    setShowResults(false);
    setResults([]);
  };

  const handleClearSelection = () => {
    setSelected(null);
    setQuery("");
    setUnitPriceInput("");
  };

  const isNewProduct = !selected && query.trim().length > 0;
  const unitPriceVal = Number(unitPriceInput) || 0;
  const canAdd = query.trim().length > 0 && unitPriceVal > 0 && quantity > 0 && !submitting && !disabled;

  const handleAdd = async () => {
    if (!canAdd) return;
    setSubmitting(true);
    try {
      await onAdd({
        productId: selected?.id ?? null,
        productName: query.trim(),
        unitPrice: unitPriceVal,
        quantity,
        notes: notesInput.trim() || null,
      });
      // Reset for the next item
      setSelected(null);
      setQuery("");
      setUnitPriceInput("");
      setQuantity(1);
      setNotesInput("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <div className="flex gap-1.5 sm:gap-2">
        <div className="relative flex-1" ref={containerRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          {selected ? (
            <div className="input-field pl-9 flex items-center justify-between">
              <span className="text-xs sm:text-sm text-white truncate">{selected.name}</span>
              <button type="button" onClick={handleClearSelection} disabled={submitting || disabled}>
                <X className="w-4 h-4 text-zinc-500 hover:text-white flex-shrink-0" />
              </button>
            </div>
          ) : (
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              disabled={submitting || disabled}
              placeholder="Search or type a new item…"
              className="input-field pl-9 text-xs sm:text-sm"
            />
          )}
          {showResults && !selected && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProduct(p)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-left hover:bg-zinc-800 transition-colors flex items-center justify-between text-xs sm:text-sm gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-white truncate">{p.name}</span>
                    {p.category && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                        {p.category.name}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] sm:text-xs text-zinc-500 shrink-0">₹{Number(p.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center border border-zinc-700 rounded-xl bg-zinc-950/40 shrink-0">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={submitting || disabled}
            className="px-1.5 sm:px-2 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
          <span className="w-4 sm:w-6 text-center text-xs sm:text-sm font-semibold text-white">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            disabled={submitting || disabled}
            className="px-1.5 sm:px-2 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 sm:gap-2">
        <div className="relative w-16 sm:w-28 shrink-0">
          <span className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs text-zinc-500 font-bold">₹</span>
          <input
            type="number"
            value={unitPriceInput}
            onChange={(e) => setUnitPriceInput(e.target.value)}
            disabled={submitting || disabled}
            placeholder="Price"
            className="input-field pl-5 sm:pl-6 text-xs sm:text-sm"
          />
        </div>
        <input
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          disabled={submitting || disabled}
          placeholder="Note (optional)"
          className="input-field text-xs sm:text-sm flex-1 min-w-0"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          title={addLabel}
          className={cn(
            "px-2.5 sm:px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
          )}
        >
          {submitting ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">{addLabel}</span>
        </button>
      </div>

      {isNewProduct && (
        <p className="text-[10px] sm:text-[11px] text-amber-500/90">
          "{query.trim()}" isn't on the menu yet — adding it will create a new item at ₹{unitPriceVal || "…"}.
        </p>
      )}
    </div>
  );
}
