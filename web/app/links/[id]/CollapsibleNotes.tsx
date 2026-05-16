"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function CollapsibleNotes({ markdown }: { markdown: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className={`relative overflow-hidden ${expanded ? "" : "max-h-52"}`}>
        <div className="prose prose-sm max-w-none
          prose-headings:text-slate-800 prose-headings:font-semibold prose-headings:mt-5 prose-headings:mb-2
          prose-h2:text-sm prose-h2:uppercase prose-h2:tracking-wide prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-1
          prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-1.5
          prose-li:text-slate-700 prose-li:my-0.5
          prose-strong:text-slate-900 prose-strong:font-semibold
          prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:rounded prose-code:px-1 prose-code:text-xs prose-code:font-normal
          prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:text-xs
          prose-blockquote:border-indigo-400 prose-blockquote:text-slate-600 prose-blockquote:not-italic prose-blockquote:bg-slate-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-xl
          prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
          prose-hr:border-slate-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        {expanded ? "↑ Collapse" : "↓ Show full notes"}
      </button>
    </div>
  );
}
