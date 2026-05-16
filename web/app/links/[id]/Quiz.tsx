"use client";

import { useState } from "react";

type Question = { question: string; options: string[]; answer: string };

export default function Quiz({ questions }: { questions: Question[] }) {
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  if (!questions.length) return null;

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => {
        const picked = selected[qi];
        const show = revealed[qi];
        const correct = q.answer;
        return (
          <div key={qi} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-sm font-medium text-gray-100 mb-4 leading-relaxed">
              <span className="text-indigo-400 font-bold mr-2">{qi + 1}.</span>
              {q.question}
            </p>
            <div className="grid gap-2">
              {q.options.map((opt) => {
                const letter = opt[0];
                const isCorrect = letter === correct;
                const isPicked = picked === letter;
                let cls = "text-left w-full text-sm px-4 py-2.5 rounded-xl border transition-all ";
                if (show) {
                  cls += isCorrect
                    ? "bg-emerald-950/50 border-emerald-700/60 text-emerald-300"
                    : isPicked
                    ? "bg-red-950/50 border-red-800/60 text-red-400"
                    : "bg-white/[0.02] border-white/[0.04] text-gray-600";
                } else {
                  cls += isPicked
                    ? "bg-indigo-950/60 border-indigo-700/60 text-indigo-200"
                    : "bg-white/[0.02] border-white/[0.06] text-gray-300 hover:border-white/10 hover:bg-white/[0.04]";
                }
                return (
                  <button key={opt} className={cls} onClick={() => setSelected((s) => ({ ...s, [qi]: letter }))} disabled={show}>
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between">
              {picked && !show && (
                <button
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  onClick={() => setRevealed((r) => ({ ...r, [qi]: true }))}
                >
                  Check answer →
                </button>
              )}
              {show && (
                <p className="text-xs text-gray-500">
                  {picked === correct
                    ? "✅ Correct!"
                    : `❌ Correct: ${correct}`}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
