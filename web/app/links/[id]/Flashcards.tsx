"use client";

import { useState } from "react";

type Card = { q: string; a: string };

export default function Flashcards({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) return null;
  const card = cards[index];

  return (
    <div>
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 min-h-[160px] flex flex-col justify-between cursor-pointer select-none hover:border-indigo-300 hover:shadow-md transition-all shadow-sm"
        onClick={() => setFlipped((f) => !f)}
      >
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${flipped ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"}`}>
            {flipped ? "Answer" : "Question"}
          </span>
          <span className="text-xs text-slate-400">tap to flip</span>
        </div>
        <p className="text-base text-slate-800 leading-relaxed">{flipped ? card.a : card.q}</p>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false); }}
          disabled={index === 0}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
        >
          ← Prev
        </button>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setFlipped(false); }}
              className={`h-1.5 rounded-full transition-all ${i === index ? "bg-indigo-500 w-3" : "bg-slate-300 w-1.5 hover:bg-slate-400"}`}
            />
          ))}
        </div>
        <button
          onClick={() => { setIndex((i) => Math.min(cards.length - 1, i + 1)); setFlipped(false); }}
          disabled={index === cards.length - 1}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
