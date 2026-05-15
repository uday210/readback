"use client";

import { useState } from "react";

type Question = { question: string; options: string[]; answer: string };

export default function Quiz({ questions }: { questions: Question[] }) {
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  if (!questions.length) return null;

  return (
    <div className="mb-8">
      <p className="text-sm font-semibold mb-3 text-gray-200">Quiz ({questions.length} questions)</p>
      <div className="space-y-5">
        {questions.map((q, qi) => {
          const picked = selected[qi];
          const show = revealed[qi];
          const correct = q.answer;
          return (
            <div key={qi} className="bg-gray-900 rounded-xl p-4 border border-gray-700">
              <p className="text-sm text-gray-100 mb-3 font-medium">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const letter = opt[0];
                  const isCorrect = letter === correct;
                  const isPicked = picked === letter;
                  let cls = "text-left w-full text-sm px-3 py-2 rounded-lg border transition-colors ";
                  if (show) {
                    cls += isCorrect
                      ? "bg-green-900 border-green-600 text-green-200"
                      : isPicked
                      ? "bg-red-900 border-red-700 text-red-300"
                      : "bg-gray-800 border-gray-700 text-gray-400";
                  } else {
                    cls += isPicked
                      ? "bg-indigo-900 border-indigo-600 text-indigo-200"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500";
                  }
                  return (
                    <button
                      key={opt}
                      className={cls}
                      onClick={() => setSelected((s) => ({ ...s, [qi]: letter }))}
                      disabled={show}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {picked && !show && (
                <button
                  className="mt-3 text-xs text-indigo-400 hover:text-indigo-300"
                  onClick={() => setRevealed((r) => ({ ...r, [qi]: true }))}
                >
                  Check answer
                </button>
              )}
              {show && (
                <p className="mt-2 text-xs text-gray-400">
                  {picked === correct ? "✅ Correct!" : `❌ Correct answer: ${correct}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
