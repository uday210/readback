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
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 min-h-[160px] flex flex-col justify-between cursor-pointer select-none hover:border-indigo-800/60 hover:bg-indigo-950/10 transition-all"
        onClick={() => setFlipped((f) => !f)}
      >
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${flipped ? "bg-emerald-950/60 text-emerald-400" : "bg-indigo-950/60 text-indigo-400"}`}>
            {flipped ? "Answer" : "Question"}
          </span>
          <span className="text-xs text-gray-600">tap to flip</span>
        </div>
        <p className="text-base text-gray-100 leading-relaxed">{flipped ? card.a : card.q}</p>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false); }}
          disabled={index === 0}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 disabled:opacity-30 hover:border-white/10 hover:text-gray-200 transition-all"
        >
          ← Prev
        </button>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setFlipped(false); }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === index ? "bg-indigo-400 w-3" : "bg-gray-700 hover:bg-gray-500"}`}
            />
          ))}
        </div>
        <button
          onClick={() => { setIndex((i) => Math.min(cards.length - 1, i + 1)); setFlipped(false); }}
          disabled={index === cards.length - 1}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 disabled:opacity-30 hover:border-white/10 hover:text-gray-200 transition-all"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
