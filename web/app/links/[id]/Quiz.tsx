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
          <div key={qi} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-800 mb-4 leading-relaxed">
              <span className="text-indigo-600 font-bold mr-2">{qi + 1}.</span>
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
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : isPicked
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-slate-50 border-slate-200 text-slate-400";
                } else {
                  cls += isPicked
                    ? "bg-indigo-50 border-indigo-300 text-indigo-800"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-white";
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
                  className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
                  onClick={() => setRevealed((r) => ({ ...r, [qi]: true }))}
                >
                  Check answer →
                </button>
              )}
              {show && (
                <p className="text-xs text-slate-500">
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
