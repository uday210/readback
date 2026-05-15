"use client";

import { useState } from "react";

type Card = { q: string; a: string };

export default function Flashcards({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) return null;
  const card = cards[index];

  return (
    <div className="mb-8">
      <p className="text-sm font-semibold mb-3 text-gray-200">Flashcards ({cards.length})</p>

      <div
        className="bg-gray-900 rounded-xl p-6 min-h-[140px] flex flex-col justify-between cursor-pointer select-none border border-gray-700 hover:border-indigo-600 transition-colors"
        onClick={() => setFlipped((f) => !f)}
      >
        <p className="text-xs text-gray-500 mb-2">{flipped ? "Answer" : "Question"} — tap to flip</p>
        <p className="text-base text-gray-100 leading-relaxed">{flipped ? card.a : card.q}</p>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false); }}
          disabled={index === 0}
          className="text-sm px-3 py-1 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-30 hover:bg-gray-700 transition-colors"
        >
          ← Prev
        </button>
        <span className="text-xs text-gray-500">{index + 1} / {cards.length}</span>
        <button
          onClick={() => { setIndex((i) => Math.min(cards.length - 1, i + 1)); setFlipped(false); }}
          disabled={index === cards.length - 1}
          className="text-sm px-3 py-1 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-30 hover:bg-gray-700 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
